"""
Independent hand calculation of the worked examples, written longhand (dimension-paper style)
without importing any project code. Run: python3 handcalc.py > worked-examples.md
The TypeScript tests assert the engine matches these numbers to 0.5%.
"""
import math

DRY_C, DRY_M = 1.54, 1.33
BAGS_PER_M3 = 1440 / 50          # 28.8 bags of cement per m³ of loose cement
SAND_T, GRAN_T, LAT_T = 1.6, 1.5, 1.8
BPM2 = 1 / (0.46 * 0.235)        # blocks per m² (450×225 face + 10 mm joints)
JOINT = 0.46 * 0.235 - 0.45 * 0.225   # m² of joint per block face
W = dict(blocks=.05, cement=.05, sand=.10, granite=.05, rebar=.10, roofing=.10, timber=.10, dpm=.15, fill=.25, ceiling=.05)

out = []
def p(s=""): out.append(s)

def mix(vol, c, s, g, dry):
    parts = c + s + g
    d = vol * dry
    return dict(cement=d * c / parts * BAGS_PER_M3, sand=d * s / parts * SAND_T, granite=d * g / parts * GRAN_T)

def example(title, walls, openings, footprint_outer, centreline_perim, notes):
    """walls: list of (name, centreline_length, measured_len, len_found, len_subblock, thickness, external)"""
    p(f"## {title}\n")
    p(notes + "\n")
    tot = {}
    def add(k, v):
        tot[k] = tot.get(k, 0) + v
    Lf = sum(w[3] for w in walls); Lsb = sum(w[4] for w in walls)
    p("| Ref | Item | Working | Qty |\n|---|---|---|---|")
    ex = Lf * .675 * .9
    p(f"| S1 | Excavation | {Lf:.3f} × 0.675 × 0.900 | {ex:.4f} m³ |")
    ft = Lf * .675 * .225
    p(f"| S2 | Footing concrete 1:2:4 | {Lf:.3f} × 0.675 × 0.225 | {ft:.4f} m³ |")
    m_ = mix(ft, 1, 2, 4, DRY_C); add("cement", m_["cement"] * 1.05); add("sand", m_["sand"] * 1.1); add("granite", m_["granite"] * 1.05)
    subA = Lsb * 1.125
    p(f"| S3 | 9\" blockwork below DPC | {Lsb:.3f} × (0.900 − 0.225 + 0.450) | {subA:.4f} m² |")
    nb = subA * BPM2; add("block9", nb * 1.05)
    m_ = mix(subA * BPM2 * JOINT * .225, 1, 6, 0, DRY_M); add("cement", m_["cement"] * 1.05); add("sand", m_["sand"] * 1.1)
    core = nb * .45 * .225 * .225 * .5
    m_ = mix(core, 1, 3, 6, DRY_C); add("cement", m_["cement"] * 1.05); add("sand", m_["sand"] * 1.1); add("granite", m_["granite"] * 1.05)
    wall_plan = sum(w[2] * w[5] for w in walls)
    floor = footprint_outer - wall_plan
    p(f"|  | Floor (clear) area | {footprint_outer:.4f} − Σ L×t {wall_plan:.4f} | {floor:.4f} m² |")
    fill = floor * .3; add("laterite", fill * LAT_T * 1.25)
    p(f"| S4 | Laterite fill | {floor:.4f} × 0.300 | {fill:.4f} m³ |")
    add("dpm", floor * 1.15)
    slab = floor * .15
    p(f"| S6 | Oversite slab 1:2:4 | {floor:.4f} × 0.150 | {slab:.4f} m³ |")
    m_ = mix(slab, 1, 2, 4, DRY_C); add("cement", m_["cement"] * 1.05); add("sand", m_["sand"] * 1.1); add("granite", m_["granite"] * 1.05)
    for t, key in ((.225, "block9"), (.150, "block6")):
        ws = [w for w in walls if w[5] == t]
        if not ws: continue
        gross = sum(w[2] * 3.0 for w in ws)
        op = sum(o[1] * o[2] for o in openings if o[0] in [w[0] for w in ws])
        band = sum(w[2] * .225 for w in ws)
        net = gross - op - band
        p(f"| B | {int(round(t/.025))}\" blockwork | {gross:.4f} − openings {op:.4f} − band {band:.4f} | {net:.4f} m² |")
        add(key, net * BPM2 * 1.05)
        m_ = mix(net * BPM2 * JOINT * t, 1, 6, 0, DRY_M); add("cement", m_["cement"] * 1.05); add("sand", m_["sand"] * 1.1)
    band_vol = sum(w[2] * w[5] * .225 for w in walls)
    p(f"| B3 | Lintel band 1:2:4 | Σ L × t × 0.225 | {band_vol:.4f} m³ |")
    m_ = mix(band_vol, 1, 2, 4, DRY_C); add("cement", m_["cement"] * 1.05); add("sand", m_["sand"] * 1.1); add("granite", m_["granite"] * 1.05)
    main = sum(w[2] for w in walls) * 4 * 1.1 * (144 / 162)
    links = 0
    for w in walls:
        n = math.floor(w[2] / .2) + 1
        links += n * (2 * ((w[5] - .05) + (.225 - .05)) + 2 * 10 * .008) * (64 / 162)
    p(f"| B4 | Y12 main bars | Σ L × 4 × 1.10 × 0.889 kg/m | {main:.3f} kg |")
    p(f"| B4 | Y8 links | Σ n × (2(t−0.05) + 2(0.175) + 0.16) × 0.395 kg/m | {links:.3f} kg |")
    add("y12", main * 1.1); add("y8", links * 1.1)
    plaster = 0
    for w in walls:
        face = w[2] * 3.0 - sum(o[1] * o[2] for o in openings if o[0] == w[0])
        plaster += 2 * face + (w[2] * .45 if w[6] else 0)
    p(f"| F1 | Plaster both faces + plinth render | 2 × Σ(L×H − openings) + Σ L_ext × 0.45 | {plaster:.4f} m² |")
    m_ = mix(plaster * .015, 1, 6, 0, DRY_M); add("cement", m_["cement"] * 1.05); add("plaster_sand", m_["sand"] * 1.1)
    m_ = mix(floor * .025, 1, 3, 0, DRY_M); add("cement", m_["cement"] * 1.05); add("sand", m_["sand"] * 1.1)
    p(f"| F2 | Screed 1:3, 25 mm | {floor:.4f} m² | {floor:.4f} m² |")
    p()
    p("**Materials to buy (with waste)**\n")
    p("| Material | Qty |\n|---|---|")
    for k, v in tot.items():
        p(f"| {k} | {v:.3f} |")
    p()
    return tot

p("# Worked examples (hand calculation)\n")
p("Independent of the engine code: computed by `handcalc.py`, which re-states every formula. "
  "Defaults: wall height 3.0 m, footing 675 × 225 mm at 900 mm, plinth 450 mm, slab 150 mm, "
  "lintel band 225 mm deep with 4Y12 + Y8 @ 200, blocks 450 × 225 + 10 mm joints "
  f"({BPM2:.4f} blocks/m²), dry-volume factors 1.54 (concrete) and 1.33 (mortar).\n")

# Example 1: 4.0 × 3.0 m centreline, all external 9", one entrance door 900×2100 on the bottom wall,
# one 1200×1200 window on the top wall. Corners only: centreline lengths are measured in full.
walls1 = [("top", 4, 4, 4, 4, .225, True), ("right", 3, 3, 3, 3, .225, True), ("bottom", 4, 4, 4, 4, .225, True), ("left", 3, 3, 3, 3, .225, True)]
open1 = [("bottom", .9, 2.1), ("top", 1.2, 1.2)]
ex1 = example("Example 1: single room 4.0 × 3.0 m", walls1, open1, 4.225 * 3.225, 14,
              "Centreline 4.0 × 3.0 m, 9\" external walls, one 900 × 2100 door, one 1200 × 1200 window. "
              "Corners only, so the centreline girth (14.0 m) is measured in full.")

# Example 2: 6.0 × 3.0 m with a 6" internal wall at x = 3.0 m (T-junctions at both ends),
# one 750 × 2100 door in the internal wall. External walls split at the T nodes.
walls2 = [("t1", 3, 3, 3, 3, .225, True), ("t2", 3, 3, 3, 3, .225, True), ("right", 3, 3, 3, 3, .225, True),
          ("b1", 3, 3, 3, 3, .225, True), ("b2", 3, 3, 3, 3, .225, True), ("left", 3, 3, 3, 3, .225, True),
          ("mid", 3, 3 - .225, 3 - .675, 3 - .225, .150, False)]
open2 = [("mid", .75, 2.1)]
ex2 = example("Example 2: two rooms 6.0 × 3.0 m with a T-junction partition", walls2, open2, 6.225 * 3.225, 18,
              "The 6\" partition stops at the face of the 9\" walls (3.000 − 2 × 0.1125 = 2.775 m); its footing "
              "stops at the face of the external footings (3.000 − 0.675 = 2.325 m); below DPC it is 9\" blockwork "
              "(3.000 − 0.225 = 2.775 m).")
print("\n".join(out))
import json, sys
json.dump({"ex1": ex1, "ex2": ex2}, open("handcalc.json", "w"), indent=1)
