import { describe, expect, it } from "vitest";
import { area, measuredLengths, normalizePlan, splitCrossings, topology, wallBoxes, classifyWallKinds, addWall, moveNode, splitWall, removeSpurs } from "../src";
import { makePlan, rect } from "./helpers";

describe("topology", () => {
  it("finds one room in a rectangle, with clear and outer areas from wall thickness", () => {
    const t = topology(rect(4000, 3000));
    expect(t.rooms).toHaveLength(1);
    expect(t.rooms[0]!.clearArea).toBeCloseTo((4000 - 225) * (3000 - 225), 0);
    expect(area(t.footprintOuter!)).toBeCloseTo((4000 + 225) * (3000 + 225), 0);
    expect(t.perimeterWallIds.size).toBe(4);
  });

  it("splits a rectangle into two rooms with an internal wall at a T-junction", () => {
    const p = makePlan(
      { a: [0, 0], m: [3000, 0], b: [6000, 0], c: [6000, 3000], n: [3000, 3000], d: [0, 3000] },
      [["a", "m"], ["m", "b"], ["b", "c"], ["c", "n"], ["n", "d"], ["d", "a"], ["m", "n", "internal"]],
    );
    const t = topology(p);
    expect(t.rooms).toHaveLength(2);
    const areas = t.rooms.map((r) => r.clearArea).sort();
    // Each room: (3000 − 112.5 − 75) × (3000 − 225)
    for (const a of areas) expect(a).toBeCloseTo((3000 - 112.5 - 75) * 2775, 0);
    expect(t.perimeterWallIds.has("w6")).toBe(false);
  });

  it("names rooms from labels inside them", () => {
    const p = rect(4000, 3000);
    p.labels.push({ id: "l1", x: 2000, y: 1500, name: "Parlour" });
    expect(topology(p).rooms[0]!.name).toBe("Parlour");
  });

  it("ignores a dangling wall when computing room area", () => {
    const p = rect(4000, 3000);
    p.nodes.push({ id: "m", x: 2000, y: 0 }, { id: "x", x: 2000, y: 1500 });
    // Rebuild top wall through m and add a spur m→x.
    p.walls[0] = { ...p.walls[0]!, b: "m" };
    p.walls.push({ id: "w4", a: "m", b: "b", kind: "external", thickness: 225 }, { id: "w5", a: "m", b: "x", kind: "internal", thickness: 150 });
    const t = topology(p);
    expect(t.rooms).toHaveLength(1);
    expect(t.openWallIds.has("w5")).toBe(true);
  });

  it("removeSpurs drops a back-and-forth walk", () => {
    // Same cycle, possibly rotated.
    expect(removeSpurs(["a", "m", "x", "m", "b"], ["w1", "s", "s", "w2", "w3"])).toEqual({ nodeIds: ["m", "b", "a"], wallIds: ["w2", "w3", "w1"] });
  });
});

describe("measured lengths (centreline method)", () => {
  it("measures a rectangle's external walls on the centreline girth", () => {
    const m = measuredLengths(rect(4000, 3000));
    const girth = [...m.values()].reduce((s, x) => s + x, 0);
    expect(girth).toBe(14000);
  });

  it("stops an internal wall at the faces of the walls it abuts", () => {
    const p = makePlan(
      { a: [0, 0], m: [3000, 0], b: [6000, 0], c: [6000, 3000], n: [3000, 3000], d: [0, 3000] },
      [["a", "m"], ["m", "b"], ["b", "c"], ["c", "n"], ["n", "d"], ["d", "a"], ["m", "n", "internal"]],
    );
    expect(measuredLengths(p).get("w6")).toBeCloseTo(3000 - 225, 6);
    // Substructure: trimmed by half the footing width instead.
    expect(measuredLengths(p, () => 675).get("w6")).toBeCloseTo(3000 - 675, 6);
  });
});

describe("editing", () => {
  it("normalizePlan merges near-miss corners and snaps a T-junction", () => {
    const p = makePlan(
      { a: [0, 0], b: [4000, 0], b2: [4040, 30], c: [4000, 3000], c2: [3980, 3020], d: [0, 3000], d2: [10, 2970], a2: [-20, 20], m: [2000, 80], n: [2000, 3000] },
      [["a", "b"], ["b2", "c"], ["c2", "d"], ["d2", "a2"], ["m", "n", "internal"]],
    );
    const q = normalizePlan(p, 150);
    const t = topology(q);
    expect(t.rooms).toHaveLength(2);
  });

  it("splitCrossings turns a plus into four walls at one node", () => {
    const p = makePlan({ a: [0, 500], b: [1000, 500], c: [500, 0], d: [500, 1000] }, [["a", "b", "internal"], ["c", "d", "internal"]]);
    const q = splitCrossings(p);
    expect(q.walls).toHaveLength(4);
    expect(q.nodes).toHaveLength(5);
  });

  it("addWall snaps to existing walls and creates rooms", () => {
    const { plan, wallIds } = addWall(rect(6000, 3000), { x: 3000, y: 40 }, { x: 3000, y: 2950 });
    expect(wallIds.length).toBe(1);
    expect(topology(plan).rooms).toHaveLength(2);
  });

  it("moving a node moves its openings with the wall and clamps them", () => {
    let p = rect(4000, 3000);
    p.openings.push({ id: "o", wallId: "w0", kind: "window", offset: 3500, width: 1200, height: 1200, sill: 900, specId: "x" });
    p = moveNode(p, "b", { x: 2500, y: 0 });
    expect(p.openings[0]!.offset).toBe(2500 - 600 - 50);
  });

  it("splitWall hands openings to the half that holds their centre", () => {
    let p = rect(4000, 3000);
    p.openings.push({ id: "o", wallId: "w0", kind: "door", offset: 3000, width: 900, height: 2100, sill: 0, specId: "x" });
    p = splitWall(p, "w0", 2000, "mid");
    const o = p.openings[0]!;
    expect(o.wallId).not.toBe("w0");
    expect(o.offset).toBe(1000);
  });

  it("classifyWallKinds marks the outline external and the rest internal", () => {
    const p = makePlan(
      { a: [0, 0], m: [3000, 0], b: [6000, 0], c: [6000, 3000], n: [3000, 3000], d: [0, 3000] },
      [["a", "m", "internal"], ["m", "b", "internal"], ["b", "c", "internal"], ["c", "n", "internal"], ["n", "d", "internal"], ["d", "a", "internal"], ["m", "n", "external"]],
    );
    const q = classifyWallKinds(p);
    expect(q.walls.filter((w) => w.kind === "external")).toHaveLength(6);
    expect(q.walls.find((w) => w.id === "w6")!.thickness).toBe(150);
  });
});

describe("3D wall boxes", () => {
  it("builds piers, sill and head around a window", () => {
    const p = rect(4000, 3000);
    p.openings.push({ id: "o", wallId: "w0", kind: "window", offset: 2000, width: 1200, height: 1200, sill: 900, specId: "x" });
    const { walls, openings } = wallBoxes(p);
    const onW0 = walls.filter((b) => b.wallId === "w0");
    expect(onW0).toHaveLength(4); // left pier, sill, head, right pier
    expect(openings).toHaveLength(1);
    // Corners extend by half the neighbour's thickness so the box outline closes.
    const total = onW0.filter((b) => b.z0 === 0 && b.z1 === 3000).reduce((s, b) => s + b.length, 0);
    expect(total).toBeCloseTo(4000 + 225 - 1200, 6);
  });
});

describe("moveWall", () => {
  it("moves the whole straight run, not just the segment between two junctions", async () => {
    const { moveWall, collinearRun } = await import("../src");
    const p = makePlan(
      { a: [0, 0], m: [3000, 0], b: [6000, 0], c: [6000, 3000], n: [3000, 3000], d: [0, 3000] },
      [["a", "m"], ["m", "b"], ["b", "c"], ["c", "n"], ["n", "d"], ["d", "a"], ["m", "n", "internal"]],
    );
    expect(collinearRun(p, "w0").sort()).toEqual(["w0", "w1"]);
    const q = moveWall(p, "w0", { x: 0, y: -500 });
    const y = (id: string) => q.nodes.find((n) => n.id === id)!.y;
    expect([y("a"), y("m"), y("b")]).toEqual([-500, -500, -500]);
    // The partition and the side walls stretch; nothing goes diagonal.
    expect(q.nodes.find((n) => n.id === "m")!.x).toBe(3000);
    expect(topology(q).rooms).toHaveLength(2);
  });
});
