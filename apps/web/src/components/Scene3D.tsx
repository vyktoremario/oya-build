"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, OrbitControls, PointerLockControls } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Plan } from "@oya/schema";
import { type WallBox, boundingBox, centroid, indexPlan, roofMesh, topology, wallBoxes } from "@oya/geometry";
import { useStore } from "@/lib/store";

const M = (mm: number) => mm / 1000;
const EYE_ABOVE_FLOOR = 1.6;
const BODY_RADIUS = 0.25;
const WALK_SPEED = 2.2; // m/s

const COLORS = {
  external: new THREE.Color("#efe8da"),
  internal: new THREE.Color("#f6f2ea"),
  selected: new THREE.Color("#e2611b"),
  slab: "#c9c2b5",
  ground: "#d9dfcf",
  roof: "#a7b0b8",
  glass: "#8fc1e3",
  door: "#8a5a35",
};

function Walls({ boxes, selectedWallId, kinds }: { boxes: WallBox[]; selectedWallId: string | null; kinds: Map<string, string> }) {
  const group = useRef<THREE.Group>(null);
  const loadId = useStore((s) => s.loadId);
  const start = useRef<number | null>(null);
  useEffect(() => {
    start.current = null;
  }, [loadId]);
  // Walls rise over ~1.4 s when a new plan loads; edits don't replay it.
  useFrame(({ clock }) => {
    if (!group.current) return;
    if (start.current === null) start.current = clock.elapsedTime;
    const t = Math.min(1, (clock.elapsedTime - start.current) / 1.4);
    const eased = 1 - Math.pow(1 - t, 3);
    group.current.scale.y = Math.max(0.001, eased);
  });
  return (
    <group ref={group}>
      {boxes.map((b) => (
        <mesh
          key={b.key}
          position={[M(b.cx), M((b.z0 + b.z1) / 2), M(b.cy)]}
          rotation={[0, -b.angle, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[M(b.length), M(b.z1 - b.z0), M(b.thickness)]} />
          <meshStandardMaterial
            color={b.wallId === selectedWallId ? COLORS.selected : kinds.get(b.wallId) === "external" ? COLORS.external : COLORS.internal}
            roughness={0.92}
          />
        </mesh>
      ))}
    </group>
  );
}

function Openings({ plan }: { plan: Plan }) {
  const { openings } = useMemo(() => wallBoxes(plan), [plan]);
  return (
    <group>
      {openings.map((o) =>
        o.kind === "window" ? (
          <mesh key={o.openingId} position={[M(o.cx), M((o.z0 + o.z1) / 2), M(o.cy)]} rotation={[0, -o.angle, 0]}>
            <boxGeometry args={[M(o.width), M(o.z1 - o.z0), 0.02]} />
            <meshStandardMaterial color={COLORS.glass} transparent opacity={0.45} roughness={0.1} metalness={0.2} />
          </mesh>
        ) : (
          // Door leaf swung open ~75° about its hinge, so walkers can pass.
          <group key={o.openingId} position={[M(o.cx), 0, M(o.cy)]} rotation={[0, -o.angle, 0]}>
            <group position={[-M(o.width) / 2, 0, M(o.thickness) / 2]} rotation={[0, -1.3, 0]}>
              <mesh position={[M(o.width) / 2, M(o.z1) / 2, 0]}>
                <boxGeometry args={[M(o.width) - 0.02, M(o.z1) - 0.02, 0.04]} />
                <meshStandardMaterial color={COLORS.door} roughness={0.7} />
              </mesh>
            </group>
          </group>
        ),
      )}
    </group>
  );
}

function Slab({ plan }: { plan: Plan }) {
  const shape = useMemo(() => {
    const t = topology(plan);
    if (!t.footprintOuter) return null;
    const s = new THREE.Shape();
    t.footprintOuter.forEach((p, i) => (i === 0 ? s.moveTo(M(p.x), -M(p.y)) : s.lineTo(M(p.x), -M(p.y))));
    s.closePath();
    return s;
  }, [plan]);
  if (!shape) return null;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} receiveShadow>
      <extrudeGeometry args={[shape, { depth: M(plan.params.plinthHeight), bevelEnabled: false }]} />
      <meshStandardMaterial color={COLORS.slab} roughness={1} side={THREE.DoubleSide} />
    </mesh>
  );
}

function Roof({ plan }: { plan: Plan }) {
  const showRoof = useStore((s) => s.showRoof);
  const walk = useStore((s) => s.walk);
  const geometry = useMemo(() => {
    const r = roofMesh(plan);
    if (!r) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(r.positions.map(M), 3));
    g.setIndex(r.indices);
    g.computeVertexNormals();
    return g;
  }, [plan]);
  if (!geometry || !showRoof) return null;
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color={COLORS.roof} metalness={0.5} roughness={0.45} side={THREE.DoubleSide} transparent={walk} opacity={walk ? 0.35 : 1} />
    </mesh>
  );
}

function RoomLabels({ plan }: { plan: Plan }) {
  const rooms = useMemo(() => topology(plan).rooms, [plan]);
  const walk = useStore((s) => s.walk);
  const showRoof = useStore((s) => s.showRoof);
  if (showRoof && !walk) return null;
  return (
    <>
      {rooms.map((r) => (
        <Html key={r.id} position={[M(r.centre.x), walk ? 2.3 : 0.4, M(r.centre.y)]} center distanceFactor={walk ? 6 : 14} zIndexRange={[10, 0]}>
          <div className="pointer-events-none whitespace-nowrap rounded bg-white/85 px-1.5 py-0.5 text-[11px] font-medium text-[var(--ink)] shadow-sm">
            {r.name} · {(r.clearArea / 1e6).toFixed(1)} m²
          </div>
        </Html>
      ))}
    </>
  );
}

/** First-person walking: WASD/arrows with circle-vs-box collision against wall pieces below head height. */
function Walker({ plan, boxes }: { plan: Plan; boxes: WallBox[] }) {
  const { camera } = useThree();
  const EYE = M(plan.params.plinthHeight) + EYE_ABOVE_FLOOR;
  const keys = useRef(new Set<string>());
  const blockers = useMemo(() => boxes.filter((b) => b.z0 < 1700), [boxes]);

  useEffect(() => {
    // Start outside the entrance door, looking in; else in the largest room.
    const ix = indexPlan(plan);
    const t = topology(plan, ix);
    const centre = t.footprint ? centroid(t.footprint.polygon) : { x: 0, y: 0 };
    const doors = plan.openings.filter((o) => o.kind === "door" && ix.walls.get(o.wallId)?.kind === "external");
    const entrance = doors.find((d) => d.specId.includes("entrance")) ?? doors[0];
    if (entrance) {
      const w = ix.walls.get(entrance.wallId)!;
      const a = ix.nodes.get(w.a)!;
      const b = ix.nodes.get(w.b)!;
      const L = Math.hypot(b.x - a.x, b.y - a.y);
      const p = { x: a.x + ((b.x - a.x) * entrance.offset) / L, y: a.y + ((b.y - a.y) * entrance.offset) / L };
      let n = { x: -(b.y - a.y) / L, y: (b.x - a.x) / L };
      if ((centre.x - p.x) * n.x + (centre.y - p.y) * n.y > 0) n = { x: -n.x, y: -n.y };
      camera.position.set(M(p.x + n.x * 2000), EYE, M(p.y + n.y * 2000));
      camera.lookAt(M(p.x), EYE, M(p.y));
    } else {
      const big = [...t.rooms].sort((r, s) => s.clearArea - r.clearArea)[0];
      const c = big?.centre ?? centre;
      camera.position.set(M(c.x), EYE, M(c.y));
    }
    const down = (e: KeyboardEvent) => keys.current.add(e.key.toLowerCase());
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
    // Re-place only when walk mode starts, not on every edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((_, dt) => {
    const k = keys.current;
    const fwd = (k.has("w") || k.has("arrowup") ? 1 : 0) - (k.has("s") || k.has("arrowdown") ? 1 : 0);
    const side = (k.has("d") || k.has("arrowright") ? 1 : 0) - (k.has("a") || k.has("arrowleft") ? 1 : 0);
    if (!fwd && !side) return;
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    dir.y = 0;
    dir.normalize();
    const right = new THREE.Vector3(-dir.z, 0, dir.x);
    const step = Math.min(dt, 0.05) * WALK_SPEED;
    let x = camera.position.x + (dir.x * fwd + right.x * side) * step;
    let z = camera.position.z + (dir.z * fwd + right.z * side) * step;
    // Push out of every blocking wall piece (oriented rectangles in plan).
    for (let iter = 0; iter < 2; iter++) {
      for (const b of blockers) {
        const cx = M(b.cx);
        const cz = M(b.cy);
        const cos = Math.cos(b.angle);
        const sin = Math.sin(b.angle);
        const lx = (x - cx) * cos + (z - cz) * sin;
        const lz = -(x - cx) * sin + (z - cz) * cos;
        const hx = M(b.length) / 2;
        const hz = M(b.thickness) / 2;
        const qx = Math.max(-hx, Math.min(hx, lx));
        const qz = Math.max(-hz, Math.min(hz, lz));
        const dx = lx - qx;
        const dz = lz - qz;
        const d = Math.hypot(dx, dz);
        if (d < BODY_RADIUS) {
          let nx = dx;
          let nz = dz;
          let pen = BODY_RADIUS - d;
          if (d < 1e-6) {
            // Inside the box: push out along the shorter axis.
            if (hx - Math.abs(lx) < hz - Math.abs(lz)) {
              nx = Math.sign(lx) || 1;
              nz = 0;
              pen = hx - Math.abs(lx) + BODY_RADIUS;
            } else {
              nx = 0;
              nz = Math.sign(lz) || 1;
              pen = hz - Math.abs(lz) + BODY_RADIUS;
            }
          } else {
            nx /= d;
            nz /= d;
          }
          const plx = lx + nx * pen;
          const plz = lz + nz * pen;
          x = cx + plx * cos - plz * sin;
          z = cz + plx * sin + plz * cos;
        }
      }
    }
    camera.position.set(x, EYE, z);
  });

  return <PointerLockControls selector="#walk-start" />;
}

function Rig({ plan }: { plan: Plan }) {
  const walk = useStore((s) => s.walk);
  const loadId = useStore((s) => s.loadId);
  const { camera, size: viewport } = useThree();
  const controls = useRef<React.ComponentRef<typeof OrbitControls>>(null);
  const target = useMemo(() => {
    if (!plan.nodes.length) return new THREE.Vector3();
    const bb = boundingBox(plan.nodes);
    return new THREE.Vector3(M((bb.minX + bb.maxX) / 2), 0, M((bb.minY + bb.maxY) / 2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadId, walk]);

  useEffect(() => {
    if (walk || !plan.nodes.length) return;
    const bb = boundingBox(plan.nodes);
    const size = Math.max(M(bb.maxX - bb.minX), M(bb.maxY - bb.minY), 6);
    // Fit the building in whichever field of view is narrower (the pane is often portrait).
    const vfov = ((camera as THREE.PerspectiveCamera).fov * Math.PI) / 180;
    const aspect = viewport.width / Math.max(1, viewport.height);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
    const dist = (size * 1.25) / (2 * Math.tan(Math.min(vfov, hfov) / 2));
    const dir = new THREE.Vector3(0.45, 0.8, 0.95).normalize();
    camera.position.set(target.x + dir.x * dist, dir.y * dist, target.z + dir.z * dist);
    camera.lookAt(target);
    controls.current?.target.copy(target);
    controls.current?.update();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, walk, viewport.width, viewport.height]);

  if (walk) return <Walker plan={plan} boxes={wallBoxes(plan).walls} />;
  return <OrbitControls ref={controls} makeDefault target={target} maxPolarAngle={Math.PI / 2.05} minDistance={3} maxDistance={150} enableDamping />;
}

export default function Scene3D() {
  const plan = useStore((s) => s.plan);
  const selection = useStore((s) => s.selection);
  const walk = useStore((s) => s.walk);
  const { walls } = useMemo(() => wallBoxes(plan), [plan]);
  const kinds = useMemo(() => new Map(plan.walls.map((w) => [w.id, w.kind])), [plan]);
  const selectedWallId = selection?.kind === "wall" ? selection.id : null;

  return (
    <div className="relative h-full w-full" data-testid="scene-3d">
      <Canvas shadows dpr={[1, 2]} camera={{ fov: walk ? 70 : 45, near: 0.05, far: 500, position: [15, 15, 20] }} gl={{ preserveDrawingBuffer: true }}>
        <color attach="background" args={["#eef0ea"]} />
        <hemisphereLight args={["#ffffff", "#b9b09c", 1.1]} />
        <directionalLight position={[12, 20, 8]} intensity={1.6} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-25} shadow-camera-right={25} shadow-camera-top={25} shadow-camera-bottom={-25} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]} receiveShadow>
          <planeGeometry args={[400, 400]} />
          <meshStandardMaterial color={COLORS.ground} roughness={1} />
        </mesh>
        <group position={[0, 0, 0]}>
          <Slab plan={plan} />
          <group position={[0, M(plan.params.plinthHeight), 0]}>
            <Walls boxes={walls} selectedWallId={selectedWallId} kinds={kinds} />
            <Openings plan={plan} />
            <Roof plan={plan} />
            <RoomLabels plan={plan} />
          </group>
        </group>
        <Rig plan={plan} />
      </Canvas>
      {walk && (
        <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-4">
          <div className="pointer-events-auto rounded-lg bg-black/60 px-3 py-2 text-center text-xs text-white">
            <button id="walk-start" className="font-semibold underline">Click here to look around</button>
            <div>WASD / arrows to walk · Esc releases the mouse</div>
          </div>
        </div>
      )}
    </div>
  );
}
