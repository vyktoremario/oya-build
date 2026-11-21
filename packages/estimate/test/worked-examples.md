# Worked examples (hand calculation)

Independent of the engine code: computed by `handcalc.py`, which re-states every formula. Defaults: wall height 3.0 m, footing 675 × 225 mm at 900 mm, plinth 450 mm, slab 150 mm, lintel band 225 mm deep with 4Y12 + Y8 @ 200, blocks 450 × 225 + 10 mm joints (9.2507 blocks/m²), dry-volume factors 1.54 (concrete) and 1.33 (mortar).

## Example 1: single room 4.0 × 3.0 m

Centreline 4.0 × 3.0 m, 9" external walls, one 900 × 2100 door, one 1200 × 1200 window. Corners only, so the centreline girth (14.0 m) is measured in full.

| Ref | Item | Working | Qty |
|---|---|---|---|
| S1 | Excavation | 14.000 × 0.675 × 0.900 | 8.5050 m³ |
| S2 | Footing concrete 1:2:4 | 14.000 × 0.675 × 0.225 | 2.1263 m³ |
| S3 | 9" blockwork below DPC | 14.000 × (0.900 − 0.225 + 0.450) | 15.7500 m² |
|  | Floor (clear) area | 13.6256 − Σ L×t 3.1500 | 10.4756 m² |
| S4 | Laterite fill | 10.4756 × 0.300 | 3.1427 m³ |
| S6 | Oversite slab 1:2:4 | 10.4756 × 0.150 | 1.5713 m³ |
| B | 9" blockwork | 42.0000 − openings 3.3300 − band 3.1500 | 35.5200 m² |
| B3 | Lintel band 1:2:4 | Σ L × t × 0.225 | 0.7087 m³ |
| B4 | Y12 main bars | Σ L × 4 × 1.10 × 0.889 kg/m | 54.756 kg |
| B4 | Y8 links | Σ n × (2(t−0.05) + 2(0.175) + 0.16) × 0.395 kg/m | 25.142 kg |
| F1 | Plaster both faces + plinth render | 2 × Σ(L×H − openings) + Σ L_ext × 0.45 | 83.6400 m² |
| F2 | Screed 1:3, 25 mm | 10.4756 m² | 10.4756 m² |

**Materials to buy (with waste)**

| Material | Qty |
|---|---|
| cement | 51.085 |
| sand | 6.688 |
| granite | 8.522 |
| block9 | 497.997 |
| laterite | 7.071 |
| dpm | 12.047 |
| y12 | 60.231 |
| y8 | 27.656 |
| plaster_sand | 2.517 |

## Example 2: two rooms 6.0 × 3.0 m with a T-junction partition

The 6" partition stops at the face of the 9" walls (3.000 − 2 × 0.1125 = 2.775 m); its footing stops at the face of the external footings (3.000 − 0.675 = 2.325 m); below DPC it is 9" blockwork (3.000 − 0.225 = 2.775 m).

| Ref | Item | Working | Qty |
|---|---|---|---|
| S1 | Excavation | 20.325 × 0.675 × 0.900 | 12.3474 m³ |
| S2 | Footing concrete 1:2:4 | 20.325 × 0.675 × 0.225 | 3.0869 m³ |
| S3 | 9" blockwork below DPC | 20.775 × (0.900 − 0.225 + 0.450) | 23.3719 m² |
|  | Floor (clear) area | 20.0756 − Σ L×t 4.4662 | 15.6094 m² |
| S4 | Laterite fill | 15.6094 × 0.300 | 4.6828 m³ |
| S6 | Oversite slab 1:2:4 | 15.6094 × 0.150 | 2.3414 m³ |
| B | 9" blockwork | 54.0000 − openings 0.0000 − band 4.0500 | 49.9500 m² |
| B | 6" blockwork | 8.3250 − openings 1.5750 − band 0.6244 | 6.1256 m² |
| B3 | Lintel band 1:2:4 | Σ L × t × 0.225 | 1.0049 m³ |
| B4 | Y12 main bars | Σ L × 4 × 1.10 × 0.889 kg/m | 81.253 kg |
| B4 | Y8 links | Σ n × (2(t−0.05) + 2(0.175) + 0.16) × 0.395 kg/m | 36.543 kg |
| F1 | Plaster both faces + plinth render | 2 × Σ(L×H − openings) + Σ L_ext × 0.45 | 129.6000 m² |
| F2 | Screed 1:3, 25 mm | 15.6094 m² | 15.6094 m² |

**Materials to buy (with waste)**

| Material | Qty |
|---|---|
| cement | 75.702 |
| sand | 9.884 |
| granite | 12.500 |
| block9 | 712.192 |
| laterite | 10.536 |
| dpm | 17.951 |
| block6 | 59.500 |
| y12 | 89.379 |
| y8 | 40.198 |
| plaster_sand | 3.900 |

