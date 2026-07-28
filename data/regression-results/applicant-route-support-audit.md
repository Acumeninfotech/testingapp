# ApplySmart Applicant Route Support Audit

Generated from every course profile in `data/index.json`. Production-ready rows are classified from actual engine evaluation output, not from index fee-status metadata. Non-production-ready profiles are marked unsupported because the public prediction engine rejects them before route evaluation.

Legend: `full` = route-specific engine evidence, automatic eligibility and a concrete interview guidance band; `partial` = route-specific eligibility/manual-review/guidance boundary is modelled but the engine withholds a complete automated recommendation; `unsupported` = route/group is explicitly unimplemented, blocked, not accepted, has no active route model, or only passed through unrelated fallback checks.

Audited profiles: 87. Engine-callable profiles: 38. Non-production-ready profiles: 49. Fee statuses: home, rest_of_uk, international. Domiciles: england, scotland, wales, northern_ireland, other. Routes: a_level, international_baccalaureate, scottish, btec, access_to_he, graduate, international_qualification, irish_leaving_certificate, ukwpmed, foundation, t_level, mixed_t_level_a_level.

Matrix cells: `F` = full, `P` = partial, `U` = unsupported. The CSV adds raw eligibility status, band/guidance, route-evidence flags, reason codes and warnings for each exact tuple.

## Anglia Ruskin University (anglia-ruskin-a100)

Engine status: production_ready

Totals: F 10, P 30, U 140

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | F | P | P | U | U | P | U | U | U | U | U | U |
| home | scotland | F | P | P | U | U | P | U | U | U | U | U | U |
| home | wales | F | P | P | U | U | P | U | U | U | U | U | U |
| home | northern_ireland | F | P | P | U | U | P | U | U | U | U | U | U |
| home | other | F | P | P | U | U | P | U | U | U | U | U | U |
| rest_of_uk | england | F | P | P | U | U | P | U | U | U | U | U | U |
| rest_of_uk | scotland | F | P | P | U | U | P | U | U | U | U | U | U |
| rest_of_uk | wales | F | P | P | U | U | P | U | U | U | U | U | U |
| rest_of_uk | northern_ireland | F | P | P | U | U | P | U | U | U | U | U | U |
| rest_of_uk | other | F | P | P | U | U | P | U | U | U | U | U | U |
| international | england | U | U | U | U | U | U | U | U | U | U | U | U |
| international | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| international | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | other | U | U | U | U | U | U | U | U | U | U | U | U |

## Aston University (aston-a100)

Engine status: production_ready

Totals: F 15, P 0, U 165

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | F | U | U | U | U | U | U | U | U | U | U | U |
| home | scotland | F | U | U | U | U | U | U | U | U | U | U | U |
| home | wales | F | U | U | U | U | U | U | U | U | U | U | U |
| home | northern_ireland | F | U | U | U | U | U | U | U | U | U | U | U |
| home | other | F | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | england | F | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | scotland | F | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | wales | F | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | northern_ireland | F | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | other | F | U | U | U | U | U | U | U | U | U | U | U |
| international | england | F | U | U | U | U | U | U | U | U | U | U | U |
| international | scotland | F | U | U | U | U | U | U | U | U | U | U | U |
| international | wales | F | U | U | U | U | U | U | U | U | U | U | U |
| international | northern_ireland | F | U | U | U | U | U | U | U | U | U | U | U |
| international | other | F | U | U | U | U | U | U | U | U | U | U | U |

## Bangor University, North Wales Medical School (bangor-a100)

Engine status: not_production_ready

Totals: F 0, P 0, U 180

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | U | U | U | U | U | U | U | U | U | U | U | U |
| home | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| home | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | other | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | england | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | other | U | U | U | U | U | U | U | U | U | U | U | U |
| international | england | U | U | U | U | U | U | U | U | U | U | U | U |
| international | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| international | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | other | U | U | U | U | U | U | U | U | U | U | U | U |

## Bangor University, North Wales Medical School (bangor-a101)

Engine status: not_production_ready

Totals: F 0, P 0, U 180

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | U | U | U | U | U | U | U | U | U | U | U | U |
| home | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| home | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | other | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | england | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | other | U | U | U | U | U | U | U | U | U | U | U | U |
| international | england | U | U | U | U | U | U | U | U | U | U | U | U |
| international | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| international | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | other | U | U | U | U | U | U | U | U | U | U | U | U |

## Brighton and Sussex Medical School (brighton-and-sussex-a100)

Engine status: not_production_ready

Totals: F 0, P 0, U 180

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | U | U | U | U | U | U | U | U | U | U | U | U |
| home | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| home | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | other | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | england | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | other | U | U | U | U | U | U | U | U | U | U | U | U |
| international | england | U | U | U | U | U | U | U | U | U | U | U | U |
| international | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| international | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | other | U | U | U | U | U | U | U | U | U | U | U | U |

## Brunel University of London (brunel-university-of-london-a100)

Engine status: production_ready

Totals: F 20, P 40, U 120

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | F | F | U | U | U | P | P | U | U | U | U | U |
| home | scotland | F | F | U | U | U | P | P | U | U | U | U | U |
| home | wales | F | F | U | U | U | P | P | U | U | U | U | U |
| home | northern_ireland | F | F | U | U | U | P | P | U | U | U | U | U |
| home | other | F | F | U | U | U | P | P | U | U | U | U | U |
| rest_of_uk | england | F | F | U | U | U | P | P | U | U | U | U | U |
| rest_of_uk | scotland | F | F | U | U | U | P | P | U | U | U | U | U |
| rest_of_uk | wales | F | F | U | U | U | P | P | U | U | U | U | U |
| rest_of_uk | northern_ireland | F | F | U | U | U | P | P | U | U | U | U | U |
| rest_of_uk | other | F | F | U | U | U | P | P | U | U | U | U | U |
| international | england | P | P | U | U | U | P | P | U | U | U | U | U |
| international | scotland | P | P | U | U | U | P | P | U | U | U | U | U |
| international | wales | P | P | U | U | U | P | P | U | U | U | U | U |
| international | northern_ireland | P | P | U | U | U | P | P | U | U | U | U | U |
| international | other | P | P | U | U | U | P | P | U | U | U | U | U |

## Cardiff University (cardiff-a100)

Engine status: production_ready

Totals: F 15, P 0, U 165

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | F | U | U | U | U | U | U | U | U | U | U | U |
| home | scotland | F | U | U | U | U | U | U | U | U | U | U | U |
| home | wales | F | U | U | U | U | U | U | U | U | U | U | U |
| home | northern_ireland | F | U | U | U | U | U | U | U | U | U | U | U |
| home | other | F | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | england | F | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | scotland | F | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | wales | F | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | northern_ireland | F | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | other | F | U | U | U | U | U | U | U | U | U | U | U |
| international | england | F | U | U | U | U | U | U | U | U | U | U | U |
| international | scotland | F | U | U | U | U | U | U | U | U | U | U | U |
| international | wales | F | U | U | U | U | U | U | U | U | U | U | U |
| international | northern_ireland | F | U | U | U | U | U | U | U | U | U | U | U |
| international | other | F | U | U | U | U | U | U | U | U | U | U | U |

## Cardiff University (cardiff-a101)

Engine status: not_production_ready

Totals: F 0, P 0, U 180

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | U | U | U | U | U | U | U | U | U | U | U | U |
| home | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| home | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | other | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | england | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | other | U | U | U | U | U | U | U | U | U | U | U | U |
| international | england | U | U | U | U | U | U | U | U | U | U | U | U |
| international | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| international | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | other | U | U | U | U | U | U | U | U | U | U | U | U |

## City St George's University of London (city-st-george-s-of-london-a100)

Engine status: not_production_ready

Totals: F 0, P 0, U 180

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | U | U | U | U | U | U | U | U | U | U | U | U |
| home | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| home | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | other | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | england | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | other | U | U | U | U | U | U | U | U | U | U | U | U |
| international | england | U | U | U | U | U | U | U | U | U | U | U | U |
| international | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| international | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | other | U | U | U | U | U | U | U | U | U | U | U | U |

## City St George's University of London (city-st-george-s-of-london-a101)

Engine status: not_production_ready

Totals: F 0, P 0, U 180

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | U | U | U | U | U | U | U | U | U | U | U | U |
| home | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| home | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | other | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | england | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | other | U | U | U | U | U | U | U | U | U | U | U | U |
| international | england | U | U | U | U | U | U | U | U | U | U | U | U |
| international | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| international | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | other | U | U | U | U | U | U | U | U | U | U | U | U |

## Edge Hill University (edge-hill-a100)

Engine status: production_ready

Totals: F 30, P 10, U 140

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | F | F | F | U | U | P | U | U | U | U | U | U |
| home | scotland | F | F | F | U | U | P | U | U | U | U | U | U |
| home | wales | F | F | F | U | U | P | U | U | U | U | U | U |
| home | northern_ireland | F | F | F | U | U | P | U | U | U | U | U | U |
| home | other | F | F | F | U | U | P | U | U | U | U | U | U |
| rest_of_uk | england | F | F | F | U | U | P | U | U | U | U | U | U |
| rest_of_uk | scotland | F | F | F | U | U | P | U | U | U | U | U | U |
| rest_of_uk | wales | F | F | F | U | U | P | U | U | U | U | U | U |
| rest_of_uk | northern_ireland | F | F | F | U | U | P | U | U | U | U | U | U |
| rest_of_uk | other | F | F | F | U | U | P | U | U | U | U | U | U |
| international | england | U | U | U | U | U | U | U | U | U | U | U | U |
| international | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| international | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | other | U | U | U | U | U | U | U | U | U | U | U | U |

## Edge Hill University (edge-hill-a110)

Engine status: not_production_ready

Totals: F 0, P 0, U 180

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | U | U | U | U | U | U | U | U | U | U | U | U |
| home | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| home | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | other | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | england | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | other | U | U | U | U | U | U | U | U | U | U | U | U |
| international | england | U | U | U | U | U | U | U | U | U | U | U | U |
| international | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| international | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | other | U | U | U | U | U | U | U | U | U | U | U | U |

## Hull York Medical School (hull-york-a100)

Engine status: production_ready

Totals: F 45, P 120, U 15

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | F | U | F | P | P | P | F | P | P | P | P | P |
| home | scotland | F | U | F | P | P | P | F | P | P | P | P | P |
| home | wales | F | U | F | P | P | P | F | P | P | P | P | P |
| home | northern_ireland | F | U | F | P | P | P | F | P | P | P | P | P |
| home | other | F | U | F | P | P | P | F | P | P | P | P | P |
| rest_of_uk | england | F | U | F | P | P | P | F | P | P | P | P | P |
| rest_of_uk | scotland | F | U | F | P | P | P | F | P | P | P | P | P |
| rest_of_uk | wales | F | U | F | P | P | P | F | P | P | P | P | P |
| rest_of_uk | northern_ireland | F | U | F | P | P | P | F | P | P | P | P | P |
| rest_of_uk | other | F | U | F | P | P | P | F | P | P | P | P | P |
| international | england | F | U | F | P | P | P | F | P | P | P | P | P |
| international | scotland | F | U | F | P | P | P | F | P | P | P | P | P |
| international | wales | F | U | F | P | P | P | F | P | P | P | P | P |
| international | northern_ireland | F | U | F | P | P | P | F | P | P | P | P | P |
| international | other | F | U | F | P | P | P | F | P | P | P | P | P |

## Hull York Medical School (hull-york-a108)

Engine status: not_production_ready

Totals: F 0, P 0, U 180

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | U | U | U | U | U | U | U | U | U | U | U | U |
| home | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| home | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | other | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | england | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | other | U | U | U | U | U | U | U | U | U | U | U | U |
| international | england | U | U | U | U | U | U | U | U | U | U | U | U |
| international | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| international | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | other | U | U | U | U | U | U | U | U | U | U | U | U |

## Imperial College London (imperial-college-london-a100)

Engine status: production_ready

Totals: F 30, P 30, U 120

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | F | P | P | U | U | U | F | U | U | U | U | U |
| home | scotland | F | P | P | U | U | U | F | U | U | U | U | U |
| home | wales | F | P | P | U | U | U | F | U | U | U | U | U |
| home | northern_ireland | F | P | P | U | U | U | F | U | U | U | U | U |
| home | other | F | P | P | U | U | U | F | U | U | U | U | U |
| rest_of_uk | england | F | P | P | U | U | U | F | U | U | U | U | U |
| rest_of_uk | scotland | F | P | P | U | U | U | F | U | U | U | U | U |
| rest_of_uk | wales | F | P | P | U | U | U | F | U | U | U | U | U |
| rest_of_uk | northern_ireland | F | P | P | U | U | U | F | U | U | U | U | U |
| rest_of_uk | other | F | P | P | U | U | U | F | U | U | U | U | U |
| international | england | F | P | P | U | U | U | F | U | U | U | U | U |
| international | scotland | F | P | P | U | U | U | F | U | U | U | U | U |
| international | wales | F | P | P | U | U | U | F | U | U | U | U | U |
| international | northern_ireland | F | P | P | U | U | U | F | U | U | U | U | U |
| international | other | F | P | P | U | U | U | F | U | U | U | U | U |

## Keele University (keele-a100)

Engine status: production_ready

Totals: F 10, P 20, U 150

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | P | P | U | U | U | U | U | U | U | U | U | U |
| home | scotland | P | P | U | U | U | U | U | U | U | U | U | U |
| home | wales | P | P | U | U | U | U | U | U | U | U | U | U |
| home | northern_ireland | P | P | U | U | U | U | U | U | U | U | U | U |
| home | other | P | P | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | england | P | P | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | scotland | P | P | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | wales | P | P | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | northern_ireland | P | P | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | other | P | P | U | U | U | U | U | U | U | U | U | U |
| international | england | F | F | U | U | U | U | U | U | U | U | U | U |
| international | scotland | F | F | U | U | U | U | U | U | U | U | U | U |
| international | wales | F | F | U | U | U | U | U | U | U | U | U | U |
| international | northern_ireland | F | F | U | U | U | U | U | U | U | U | U | U |
| international | other | F | F | U | U | U | U | U | U | U | U | U | U |

## Keele University (keele-a104)

Engine status: not_production_ready

Totals: F 0, P 0, U 180

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | U | U | U | U | U | U | U | U | U | U | U | U |
| home | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| home | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | other | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | england | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | other | U | U | U | U | U | U | U | U | U | U | U | U |
| international | england | U | U | U | U | U | U | U | U | U | U | U | U |
| international | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| international | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | other | U | U | U | U | U | U | U | U | U | U | U | U |

## Kent and Medway Medical School (kent-and-medway-a100)

Engine status: production_ready

Totals: F 75, P 0, U 105

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | F | F | F | U | U | F | F | U | U | U | U | U |
| home | scotland | F | F | F | U | U | F | F | U | U | U | U | U |
| home | wales | F | F | F | U | U | F | F | U | U | U | U | U |
| home | northern_ireland | F | F | F | U | U | F | F | U | U | U | U | U |
| home | other | F | F | F | U | U | F | F | U | U | U | U | U |
| rest_of_uk | england | F | F | F | U | U | F | F | U | U | U | U | U |
| rest_of_uk | scotland | F | F | F | U | U | F | F | U | U | U | U | U |
| rest_of_uk | wales | F | F | F | U | U | F | F | U | U | U | U | U |
| rest_of_uk | northern_ireland | F | F | F | U | U | F | F | U | U | U | U | U |
| rest_of_uk | other | F | F | F | U | U | F | F | U | U | U | U | U |
| international | england | F | F | F | U | U | F | F | U | U | U | U | U |
| international | scotland | F | F | F | U | U | F | F | U | U | U | U | U |
| international | wales | F | F | F | U | U | F | F | U | U | U | U | U |
| international | northern_ireland | F | F | F | U | U | F | F | U | U | U | U | U |
| international | other | F | F | F | U | U | F | F | U | U | U | U | U |

## King's College London (king-s-college-london-a100)

Engine status: production_ready

Totals: F 60, P 15, U 105

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | F | F | F | U | U | P | F | U | U | U | U | U |
| home | scotland | F | F | F | U | U | P | F | U | U | U | U | U |
| home | wales | F | F | F | U | U | P | F | U | U | U | U | U |
| home | northern_ireland | F | F | F | U | U | P | F | U | U | U | U | U |
| home | other | F | F | F | U | U | P | F | U | U | U | U | U |
| rest_of_uk | england | F | F | F | U | U | P | F | U | U | U | U | U |
| rest_of_uk | scotland | F | F | F | U | U | P | F | U | U | U | U | U |
| rest_of_uk | wales | F | F | F | U | U | P | F | U | U | U | U | U |
| rest_of_uk | northern_ireland | F | F | F | U | U | P | F | U | U | U | U | U |
| rest_of_uk | other | F | F | F | U | U | P | F | U | U | U | U | U |
| international | england | F | F | F | U | U | P | F | U | U | U | U | U |
| international | scotland | F | F | F | U | U | P | F | U | U | U | U | U |
| international | wales | F | F | F | U | U | P | F | U | U | U | U | U |
| international | northern_ireland | F | F | F | U | U | P | F | U | U | U | U | U |
| international | other | F | F | F | U | U | P | F | U | U | U | U | U |

## King's College London (king-s-college-london-a101)

Engine status: not_production_ready

Totals: F 0, P 0, U 180

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | U | U | U | U | U | U | U | U | U | U | U | U |
| home | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| home | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | other | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | england | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | other | U | U | U | U | U | U | U | U | U | U | U | U |
| international | england | U | U | U | U | U | U | U | U | U | U | U | U |
| international | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| international | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | other | U | U | U | U | U | U | U | U | U | U | U | U |

## King's College London (king-s-college-london-a102)

Engine status: not_production_ready

Totals: F 0, P 0, U 180

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | U | U | U | U | U | U | U | U | U | U | U | U |
| home | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| home | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | other | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | england | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | other | U | U | U | U | U | U | U | U | U | U | U | U |
| international | england | U | U | U | U | U | U | U | U | U | U | U | U |
| international | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| international | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | other | U | U | U | U | U | U | U | U | U | U | U | U |

## King's College London (king-s-college-london-a105)

Engine status: not_production_ready

Totals: F 0, P 0, U 180

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | U | U | U | U | U | U | U | U | U | U | U | U |
| home | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| home | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | other | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | england | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | other | U | U | U | U | U | U | U | U | U | U | U | U |
| international | england | U | U | U | U | U | U | U | U | U | U | U | U |
| international | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| international | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | other | U | U | U | U | U | U | U | U | U | U | U | U |

## Lancaster University (lancaster-a100)

Engine status: production_ready

Totals: F 30, P 15, U 135

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | F | U | U | U | U | P | F | U | U | U | U | U |
| home | scotland | F | U | U | U | U | P | F | U | U | U | U | U |
| home | wales | F | U | U | U | U | P | F | U | U | U | U | U |
| home | northern_ireland | F | U | U | U | U | P | F | U | U | U | U | U |
| home | other | F | U | U | U | U | P | F | U | U | U | U | U |
| rest_of_uk | england | F | U | U | U | U | P | F | U | U | U | U | U |
| rest_of_uk | scotland | F | U | U | U | U | P | F | U | U | U | U | U |
| rest_of_uk | wales | F | U | U | U | U | P | F | U | U | U | U | U |
| rest_of_uk | northern_ireland | F | U | U | U | U | P | F | U | U | U | U | U |
| rest_of_uk | other | F | U | U | U | U | P | F | U | U | U | U | U |
| international | england | F | U | U | U | U | P | F | U | U | U | U | U |
| international | scotland | F | U | U | U | U | P | F | U | U | U | U | U |
| international | wales | F | U | U | U | U | P | F | U | U | U | U | U |
| international | northern_ireland | F | U | U | U | U | P | F | U | U | U | U | U |
| international | other | F | U | U | U | U | P | F | U | U | U | U | U |

## Lancaster University (lancaster-a104)

Engine status: not_production_ready

Totals: F 0, P 0, U 180

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | U | U | U | U | U | U | U | U | U | U | U | U |
| home | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| home | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | other | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | england | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | other | U | U | U | U | U | U | U | U | U | U | U | U |
| international | england | U | U | U | U | U | U | U | U | U | U | U | U |
| international | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| international | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | other | U | U | U | U | U | U | U | U | U | U | U | U |

## University of Leicester (leicester-a100)

Engine status: production_ready

Totals: F 30, P 15, U 135

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | F | F | U | U | U | P | U | U | U | U | U | U |
| home | scotland | F | F | U | U | U | P | U | U | U | U | U | U |
| home | wales | F | F | U | U | U | P | U | U | U | U | U | U |
| home | northern_ireland | F | F | U | U | U | P | U | U | U | U | U | U |
| home | other | F | F | U | U | U | P | U | U | U | U | U | U |
| rest_of_uk | england | F | F | U | U | U | P | U | U | U | U | U | U |
| rest_of_uk | scotland | F | F | U | U | U | P | U | U | U | U | U | U |
| rest_of_uk | wales | F | F | U | U | U | P | U | U | U | U | U | U |
| rest_of_uk | northern_ireland | F | F | U | U | U | P | U | U | U | U | U | U |
| rest_of_uk | other | F | F | U | U | U | P | U | U | U | U | U | U |
| international | england | F | F | U | U | U | P | U | U | U | U | U | U |
| international | scotland | F | F | U | U | U | P | U | U | U | U | U | U |
| international | wales | F | F | U | U | U | P | U | U | U | U | U | U |
| international | northern_ireland | F | F | U | U | U | P | U | U | U | U | U | U |
| international | other | F | F | U | U | U | P | U | U | U | U | U | U |

## Newcastle University (newcastle-a100)

Engine status: production_ready

Totals: F 50, P 25, U 105

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | F | F | F | U | U | F | F | U | U | U | U | U |
| home | scotland | F | F | F | U | U | F | F | U | U | U | U | U |
| home | wales | F | F | F | U | U | F | F | U | U | U | U | U |
| home | northern_ireland | F | F | F | U | U | F | F | U | U | U | U | U |
| home | other | F | F | F | U | U | F | F | U | U | U | U | U |
| rest_of_uk | england | F | F | F | U | U | F | F | U | U | U | U | U |
| rest_of_uk | scotland | F | F | F | U | U | F | F | U | U | U | U | U |
| rest_of_uk | wales | F | F | F | U | U | F | F | U | U | U | U | U |
| rest_of_uk | northern_ireland | F | F | F | U | U | F | F | U | U | U | U | U |
| rest_of_uk | other | F | F | F | U | U | F | F | U | U | U | U | U |
| international | england | P | P | P | U | U | P | P | U | U | U | U | U |
| international | scotland | P | P | P | U | U | P | P | U | U | U | U | U |
| international | wales | P | P | P | U | U | P | P | U | U | U | U | U |
| international | northern_ireland | P | P | P | U | U | P | P | U | U | U | U | U |
| international | other | P | P | P | U | U | P | P | U | U | U | U | U |

## Newcastle University (newcastle-a101)

Engine status: not_production_ready

Totals: F 0, P 0, U 180

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | U | U | U | U | U | U | U | U | U | U | U | U |
| home | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| home | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | other | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | england | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | other | U | U | U | U | U | U | U | U | U | U | U | U |
| international | england | U | U | U | U | U | U | U | U | U | U | U | U |
| international | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| international | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | other | U | U | U | U | U | U | U | U | U | U | U | U |

## Queen Mary University of London (queen-mary-a100)

Engine status: production_ready

Totals: F 30, P 0, U 150

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | F | F | U | U | U | U | U | U | U | U | U | U |
| home | scotland | F | F | U | U | U | U | U | U | U | U | U | U |
| home | wales | F | F | U | U | U | U | U | U | U | U | U | U |
| home | northern_ireland | F | F | U | U | U | U | U | U | U | U | U | U |
| home | other | F | F | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | england | F | F | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | scotland | F | F | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | wales | F | F | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | northern_ireland | F | F | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | other | F | F | U | U | U | U | U | U | U | U | U | U |
| international | england | F | F | U | U | U | U | U | U | U | U | U | U |
| international | scotland | F | F | U | U | U | U | U | U | U | U | U | U |
| international | wales | F | F | U | U | U | U | U | U | U | U | U | U |
| international | northern_ireland | F | F | U | U | U | U | U | U | U | U | U | U |
| international | other | F | F | U | U | U | U | U | U | U | U | U | U |

## Queen Mary, University of London (queen-mary-a101)

Engine status: not_production_ready

Totals: F 0, P 0, U 180

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | U | U | U | U | U | U | U | U | U | U | U | U |
| home | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| home | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | other | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | england | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | other | U | U | U | U | U | U | U | U | U | U | U | U |
| international | england | U | U | U | U | U | U | U | U | U | U | U | U |
| international | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| international | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | other | U | U | U | U | U | U | U | U | U | U | U | U |

## Queen's University Belfast (queen-s-belfast-a100)

Engine status: production_ready

Totals: F 20, P 40, U 120

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | F | F | P | U | U | U | P | U | U | U | U | U |
| home | scotland | F | F | P | U | U | U | P | U | U | U | U | U |
| home | wales | F | F | P | U | U | U | P | U | U | U | U | U |
| home | northern_ireland | F | F | P | U | U | U | P | U | U | U | U | U |
| home | other | F | F | P | U | U | U | P | U | U | U | U | U |
| rest_of_uk | england | F | F | P | U | U | U | P | U | U | U | U | U |
| rest_of_uk | scotland | F | F | P | U | U | U | P | U | U | U | U | U |
| rest_of_uk | wales | F | F | P | U | U | U | P | U | U | U | U | U |
| rest_of_uk | northern_ireland | F | F | P | U | U | U | P | U | U | U | U | U |
| rest_of_uk | other | F | F | P | U | U | U | P | U | U | U | U | U |
| international | england | P | P | P | U | U | U | P | U | U | U | U | U |
| international | scotland | P | P | P | U | U | U | P | U | U | U | U | U |
| international | wales | P | P | P | U | U | U | P | U | U | U | U | U |
| international | northern_ireland | P | P | P | U | U | U | P | U | U | U | U | U |
| international | other | P | P | P | U | U | U | P | U | U | U | U | U |

## Swansea University (swansea-a100)

Engine status: not_production_ready

Totals: F 0, P 0, U 180

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | U | U | U | U | U | U | U | U | U | U | U | U |
| home | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| home | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | other | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | england | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | other | U | U | U | U | U | U | U | U | U | U | U | U |
| international | england | U | U | U | U | U | U | U | U | U | U | U | U |
| international | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| international | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | other | U | U | U | U | U | U | U | U | U | U | U | U |

## The Pears Cumbria School of Medicine (pears-cumbria-a102)

Engine status: not_production_ready

Totals: F 0, P 0, U 180

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | U | U | U | U | U | U | U | U | U | U | U | U |
| home | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| home | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | other | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | england | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | other | U | U | U | U | U | U | U | U | U | U | U | U |
| international | england | U | U | U | U | U | U | U | U | U | U | U | U |
| international | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| international | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | other | U | U | U | U | U | U | U | U | U | U | U | U |

## Ulster University (ulster-a101)

Engine status: not_production_ready

Totals: F 0, P 0, U 180

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | U | U | U | U | U | U | U | U | U | U | U | U |
| home | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| home | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | other | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | england | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | other | U | U | U | U | U | U | U | U | U | U | U | U |
| international | england | U | U | U | U | U | U | U | U | U | U | U | U |
| international | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| international | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | other | U | U | U | U | U | U | U | U | U | U | U | U |

## University College London (ucl-a100)

Engine status: production_ready

Totals: F 45, P 30, U 105

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | F | F | P | U | U | P | F | U | U | U | U | U |
| home | scotland | F | F | P | U | U | P | F | U | U | U | U | U |
| home | wales | F | F | P | U | U | P | F | U | U | U | U | U |
| home | northern_ireland | F | F | P | U | U | P | F | U | U | U | U | U |
| home | other | F | F | P | U | U | P | F | U | U | U | U | U |
| rest_of_uk | england | F | F | P | U | U | P | F | U | U | U | U | U |
| rest_of_uk | scotland | F | F | P | U | U | P | F | U | U | U | U | U |
| rest_of_uk | wales | F | F | P | U | U | P | F | U | U | U | U | U |
| rest_of_uk | northern_ireland | F | F | P | U | U | P | F | U | U | U | U | U |
| rest_of_uk | other | F | F | P | U | U | P | F | U | U | U | U | U |
| international | england | F | F | P | U | U | P | F | U | U | U | U | U |
| international | scotland | F | F | P | U | U | P | F | U | U | U | U | U |
| international | wales | F | F | P | U | U | P | F | U | U | U | U | U |
| international | northern_ireland | F | F | P | U | U | P | F | U | U | U | U | U |
| international | other | F | F | P | U | U | P | F | U | U | U | U | U |

## University of Aberdeen (aberdeen-a100)

Engine status: production_ready

Totals: F 13, P 2, U 165

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | F | U | U | U | U | U | U | U | U | U | U | U |
| home | scotland | P | U | U | U | U | U | U | U | U | U | U | U |
| home | wales | F | U | U | U | U | U | U | U | U | U | U | U |
| home | northern_ireland | F | U | U | U | U | U | U | U | U | U | U | U |
| home | other | P | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | england | F | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | scotland | F | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | wales | F | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | northern_ireland | F | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | other | F | U | U | U | U | U | U | U | U | U | U | U |
| international | england | F | U | U | U | U | U | U | U | U | U | U | U |
| international | scotland | F | U | U | U | U | U | U | U | U | U | U | U |
| international | wales | F | U | U | U | U | U | U | U | U | U | U | U |
| international | northern_ireland | F | U | U | U | U | U | U | U | U | U | U | U |
| international | other | F | U | U | U | U | U | U | U | U | U | U | U |

## University of Aberdeen (aberdeen-a1a1)

Engine status: not_production_ready

Totals: F 0, P 0, U 180

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | U | U | U | U | U | U | U | U | U | U | U | U |
| home | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| home | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | other | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | england | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | other | U | U | U | U | U | U | U | U | U | U | U | U |
| international | england | U | U | U | U | U | U | U | U | U | U | U | U |
| international | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| international | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | other | U | U | U | U | U | U | U | U | U | U | U | U |

## University of Birmingham (birmingham-a100)

Engine status: production_ready

Totals: F 35, P 70, U 75

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | F | U | F | U | U | P | P | P | F | U | U | P |
| home | scotland | F | U | F | U | U | P | P | P | F | U | U | P |
| home | wales | F | U | F | U | U | P | P | P | F | U | U | P |
| home | northern_ireland | F | U | F | U | U | P | P | P | F | U | U | P |
| home | other | F | U | F | U | U | P | P | P | F | U | U | P |
| rest_of_uk | england | F | U | F | U | U | P | P | P | F | U | U | P |
| rest_of_uk | scotland | F | U | F | U | U | P | P | P | F | U | U | P |
| rest_of_uk | wales | F | U | F | U | U | P | P | P | F | U | U | P |
| rest_of_uk | northern_ireland | F | U | F | U | U | P | P | P | F | U | U | P |
| rest_of_uk | other | F | U | F | U | U | P | P | P | F | U | U | P |
| international | england | P | U | P | U | U | P | P | P | F | U | U | P |
| international | scotland | P | U | P | U | U | P | P | P | F | U | U | P |
| international | wales | P | U | P | U | U | P | P | P | F | U | U | P |
| international | northern_ireland | P | U | P | U | U | P | P | P | F | U | U | P |
| international | other | P | U | P | U | U | P | P | P | F | U | U | P |

## University of Bristol (bristol-a100)

Engine status: production_ready

Totals: F 45, P 30, U 105

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | F | F | P | U | U | P | F | U | U | U | U | U |
| home | scotland | F | F | P | U | U | P | F | U | U | U | U | U |
| home | wales | F | F | P | U | U | P | F | U | U | U | U | U |
| home | northern_ireland | F | F | P | U | U | P | F | U | U | U | U | U |
| home | other | F | F | P | U | U | P | F | U | U | U | U | U |
| rest_of_uk | england | F | F | P | U | U | P | F | U | U | U | U | U |
| rest_of_uk | scotland | F | F | P | U | U | P | F | U | U | U | U | U |
| rest_of_uk | wales | F | F | P | U | U | P | F | U | U | U | U | U |
| rest_of_uk | northern_ireland | F | F | P | U | U | P | F | U | U | U | U | U |
| rest_of_uk | other | F | F | P | U | U | P | F | U | U | U | U | U |
| international | england | F | F | P | U | U | P | F | U | U | U | U | U |
| international | scotland | F | F | P | U | U | P | F | U | U | U | U | U |
| international | wales | F | F | P | U | U | P | F | U | U | U | U | U |
| international | northern_ireland | F | F | P | U | U | P | F | U | U | U | U | U |
| international | other | F | F | P | U | U | P | F | U | U | U | U | U |

## University of Bristol (bristol-a108)

Engine status: not_production_ready

Totals: F 0, P 0, U 180

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | U | U | U | U | U | U | U | U | U | U | U | U |
| home | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| home | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | other | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | england | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | other | U | U | U | U | U | U | U | U | U | U | U | U |
| international | england | U | U | U | U | U | U | U | U | U | U | U | U |
| international | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| international | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | other | U | U | U | U | U | U | U | U | U | U | U | U |

## University of Buckingham (buckingham-71a8)

Engine status: production_ready

Totals: F 45, P 30, U 105

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | F | F | P | U | U | F | P | U | U | U | U | U |
| home | scotland | F | F | P | U | U | F | P | U | U | U | U | U |
| home | wales | F | F | P | U | U | F | P | U | U | U | U | U |
| home | northern_ireland | F | F | P | U | U | F | P | U | U | U | U | U |
| home | other | F | F | P | U | U | F | P | U | U | U | U | U |
| rest_of_uk | england | F | F | P | U | U | F | P | U | U | U | U | U |
| rest_of_uk | scotland | F | F | P | U | U | F | P | U | U | U | U | U |
| rest_of_uk | wales | F | F | P | U | U | F | P | U | U | U | U | U |
| rest_of_uk | northern_ireland | F | F | P | U | U | F | P | U | U | U | U | U |
| rest_of_uk | other | F | F | P | U | U | F | P | U | U | U | U | U |
| international | england | F | F | P | U | U | F | P | U | U | U | U | U |
| international | scotland | F | F | P | U | U | F | P | U | U | U | U | U |
| international | wales | F | F | P | U | U | F | P | U | U | U | U | U |
| international | northern_ireland | F | F | P | U | U | F | P | U | U | U | U | U |
| international | other | F | F | P | U | U | F | P | U | U | U | U | U |

## University of Cambridge (cambridge-a100)

Engine status: production_ready

Totals: F 30, P 45, U 105

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | F | F | P | U | U | P | F | U | U | U | U | U |
| home | scotland | F | F | P | U | U | P | F | U | U | U | U | U |
| home | wales | F | F | P | U | U | P | F | U | U | U | U | U |
| home | northern_ireland | F | F | P | U | U | P | F | U | U | U | U | U |
| home | other | F | F | P | U | U | P | F | U | U | U | U | U |
| rest_of_uk | england | F | F | P | U | U | P | F | U | U | U | U | U |
| rest_of_uk | scotland | F | F | P | U | U | P | F | U | U | U | U | U |
| rest_of_uk | wales | F | F | P | U | U | P | F | U | U | U | U | U |
| rest_of_uk | northern_ireland | F | F | P | U | U | P | F | U | U | U | U | U |
| rest_of_uk | other | F | F | P | U | U | P | F | U | U | U | U | U |
| international | england | P | P | P | U | U | P | P | U | U | U | U | U |
| international | scotland | P | P | P | U | U | P | P | U | U | U | U | U |
| international | wales | P | P | P | U | U | P | P | U | U | U | U | U |
| international | northern_ireland | P | P | P | U | U | P | P | U | U | U | U | U |
| international | other | P | P | P | U | U | P | P | U | U | U | U | U |

## University of Cambridge (cambridge-a101)

Engine status: not_production_ready

Totals: F 0, P 0, U 180

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | U | U | U | U | U | U | U | U | U | U | U | U |
| home | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| home | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | other | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | england | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | other | U | U | U | U | U | U | U | U | U | U | U | U |
| international | england | U | U | U | U | U | U | U | U | U | U | U | U |
| international | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| international | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | other | U | U | U | U | U | U | U | U | U | U | U | U |

## University of Chester (chester-a101)

Engine status: not_production_ready

Totals: F 0, P 0, U 180

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | U | U | U | U | U | U | U | U | U | U | U | U |
| home | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| home | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | other | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | england | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | other | U | U | U | U | U | U | U | U | U | U | U | U |
| international | england | U | U | U | U | U | U | U | U | U | U | U | U |
| international | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| international | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | other | U | U | U | U | U | U | U | U | U | U | U | U |

## University of Dundee (dundee-a100)

Engine status: production_ready

Totals: F 13, P 2, U 165

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | F | U | U | U | U | U | U | U | U | U | U | U |
| home | scotland | P | U | U | U | U | U | U | U | U | U | U | U |
| home | wales | F | U | U | U | U | U | U | U | U | U | U | U |
| home | northern_ireland | F | U | U | U | U | U | U | U | U | U | U | U |
| home | other | P | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | england | F | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | scotland | F | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | wales | F | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | northern_ireland | F | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | other | F | U | U | U | U | U | U | U | U | U | U | U |
| international | england | F | U | U | U | U | U | U | U | U | U | U | U |
| international | scotland | F | U | U | U | U | U | U | U | U | U | U | U |
| international | wales | F | U | U | U | U | U | U | U | U | U | U | U |
| international | northern_ireland | F | U | U | U | U | U | U | U | U | U | U | U |
| international | other | F | U | U | U | U | U | U | U | U | U | U | U |

## University of Dundee (dundee-a104)

Engine status: not_production_ready

Totals: F 0, P 0, U 180

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | U | U | U | U | U | U | U | U | U | U | U | U |
| home | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| home | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | other | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | england | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | other | U | U | U | U | U | U | U | U | U | U | U | U |
| international | england | U | U | U | U | U | U | U | U | U | U | U | U |
| international | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| international | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | other | U | U | U | U | U | U | U | U | U | U | U | U |

## University of East Anglia (east-anglia-a100)

Engine status: production_ready

Totals: F 30, P 30, U 120

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | F | F | P | U | U | U | F | U | U | U | U | U |
| home | scotland | F | F | P | U | U | U | F | U | U | U | U | U |
| home | wales | F | F | P | U | U | U | F | U | U | U | U | U |
| home | northern_ireland | F | F | P | U | U | U | F | U | U | U | U | U |
| home | other | F | F | P | U | U | U | F | U | U | U | U | U |
| rest_of_uk | england | F | F | P | U | U | U | F | U | U | U | U | U |
| rest_of_uk | scotland | F | F | P | U | U | U | F | U | U | U | U | U |
| rest_of_uk | wales | F | F | P | U | U | U | F | U | U | U | U | U |
| rest_of_uk | northern_ireland | F | F | P | U | U | U | F | U | U | U | U | U |
| rest_of_uk | other | F | F | P | U | U | U | F | U | U | U | U | U |
| international | england | P | P | P | U | U | U | P | U | U | U | U | U |
| international | scotland | P | P | P | U | U | U | P | U | U | U | U | U |
| international | wales | P | P | P | U | U | U | P | U | U | U | U | U |
| international | northern_ireland | P | P | P | U | U | U | P | U | U | U | U | U |
| international | other | P | P | P | U | U | U | P | U | U | U | U | U |

## University of East Anglia (east-anglia-a101)

Engine status: not_production_ready

Totals: F 0, P 0, U 180

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | U | U | U | U | U | U | U | U | U | U | U | U |
| home | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| home | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | other | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | england | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | other | U | U | U | U | U | U | U | U | U | U | U | U |
| international | england | U | U | U | U | U | U | U | U | U | U | U | U |
| international | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| international | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | other | U | U | U | U | U | U | U | U | U | U | U | U |

## University of East Anglia (east-anglia-a104)

Engine status: not_production_ready

Totals: F 0, P 0, U 180

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | U | U | U | U | U | U | U | U | U | U | U | U |
| home | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| home | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | other | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | england | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | other | U | U | U | U | U | U | U | U | U | U | U | U |
| international | england | U | U | U | U | U | U | U | U | U | U | U | U |
| international | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| international | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | other | U | U | U | U | U | U | U | U | U | U | U | U |

## University of Edinburgh (edinburgh-a100)

Engine status: production_ready

Totals: F 13, P 2, U 165

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | F | U | U | U | U | U | U | U | U | U | U | U |
| home | scotland | P | U | U | U | U | U | U | U | U | U | U | U |
| home | wales | F | U | U | U | U | U | U | U | U | U | U | U |
| home | northern_ireland | F | U | U | U | U | U | U | U | U | U | U | U |
| home | other | P | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | england | F | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | scotland | F | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | wales | F | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | northern_ireland | F | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | other | F | U | U | U | U | U | U | U | U | U | U | U |
| international | england | F | U | U | U | U | U | U | U | U | U | U | U |
| international | scotland | F | U | U | U | U | U | U | U | U | U | U | U |
| international | wales | F | U | U | U | U | U | U | U | U | U | U | U |
| international | northern_ireland | F | U | U | U | U | U | U | U | U | U | U | U |
| international | other | F | U | U | U | U | U | U | U | U | U | U | U |

## University of Edinburgh (edinburgh-no-code)

Engine status: not_production_ready

Totals: F 0, P 0, U 180

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | U | U | U | U | U | U | U | U | U | U | U | U |
| home | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| home | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | other | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | england | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | other | U | U | U | U | U | U | U | U | U | U | U | U |
| international | england | U | U | U | U | U | U | U | U | U | U | U | U |
| international | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| international | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | other | U | U | U | U | U | U | U | U | U | U | U | U |

## University of Exeter (exeter-a100)

Engine status: production_ready

Totals: F 30, P 75, U 75

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | F | F | P | P | P | P | P | U | U | U | U | U |
| home | scotland | F | F | P | P | P | P | P | U | U | U | U | U |
| home | wales | F | F | P | P | P | P | P | U | U | U | U | U |
| home | northern_ireland | F | F | P | P | P | P | P | U | U | U | U | U |
| home | other | F | F | P | P | P | P | P | U | U | U | U | U |
| rest_of_uk | england | F | F | P | P | P | P | P | U | U | U | U | U |
| rest_of_uk | scotland | F | F | P | P | P | P | P | U | U | U | U | U |
| rest_of_uk | wales | F | F | P | P | P | P | P | U | U | U | U | U |
| rest_of_uk | northern_ireland | F | F | P | P | P | P | P | U | U | U | U | U |
| rest_of_uk | other | F | F | P | P | P | P | P | U | U | U | U | U |
| international | england | F | F | P | P | P | P | P | U | U | U | U | U |
| international | scotland | F | F | P | P | P | P | P | U | U | U | U | U |
| international | wales | F | F | P | P | P | P | P | U | U | U | U | U |
| international | northern_ireland | F | F | P | P | P | P | P | U | U | U | U | U |
| international | other | F | F | P | P | P | P | P | U | U | U | U | U |

## University of Glasgow (glasgow-a100)

Engine status: production_ready

Totals: F 13, P 2, U 165

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | F | U | U | U | U | U | U | U | U | U | U | U |
| home | scotland | P | U | U | U | U | U | U | U | U | U | U | U |
| home | wales | F | U | U | U | U | U | U | U | U | U | U | U |
| home | northern_ireland | F | U | U | U | U | U | U | U | U | U | U | U |
| home | other | P | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | england | F | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | scotland | F | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | wales | F | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | northern_ireland | F | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | other | F | U | U | U | U | U | U | U | U | U | U | U |
| international | england | F | U | U | U | U | U | U | U | U | U | U | U |
| international | scotland | F | U | U | U | U | U | U | U | U | U | U | U |
| international | wales | F | U | U | U | U | U | U | U | U | U | U | U |
| international | northern_ireland | F | U | U | U | U | U | U | U | U | U | U | U |
| international | other | F | U | U | U | U | U | U | U | U | U | U | U |

## University of Glasgow (glasgow-a900)

Engine status: not_production_ready

Totals: F 0, P 0, U 180

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | U | U | U | U | U | U | U | U | U | U | U | U |
| home | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| home | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | other | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | england | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | other | U | U | U | U | U | U | U | U | U | U | U | U |
| international | england | U | U | U | U | U | U | U | U | U | U | U | U |
| international | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| international | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | other | U | U | U | U | U | U | U | U | U | U | U | U |

## University of Greater Manchester (greater-manchester-a100)

Engine status: not_production_ready

Totals: F 0, P 0, U 180

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | U | U | U | U | U | U | U | U | U | U | U | U |
| home | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| home | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | other | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | england | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | other | U | U | U | U | U | U | U | U | U | U | U | U |
| international | england | U | U | U | U | U | U | U | U | U | U | U | U |
| international | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| international | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | other | U | U | U | U | U | U | U | U | U | U | U | U |

## University of Hertfordshire (hertfordshire-a100)

Engine status: not_production_ready

Totals: F 0, P 0, U 180

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | U | U | U | U | U | U | U | U | U | U | U | U |
| home | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| home | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | other | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | england | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | other | U | U | U | U | U | U | U | U | U | U | U | U |
| international | england | U | U | U | U | U | U | U | U | U | U | U | U |
| international | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| international | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | other | U | U | U | U | U | U | U | U | U | U | U | U |

## University of Lancashire (lancashire-a100)

Engine status: production_ready

Totals: F 60, P 15, U 105

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | F | F | P | U | U | F | F | U | U | U | U | U |
| home | scotland | F | F | P | U | U | F | F | U | U | U | U | U |
| home | wales | F | F | P | U | U | F | F | U | U | U | U | U |
| home | northern_ireland | F | F | P | U | U | F | F | U | U | U | U | U |
| home | other | F | F | P | U | U | F | F | U | U | U | U | U |
| rest_of_uk | england | F | F | P | U | U | F | F | U | U | U | U | U |
| rest_of_uk | scotland | F | F | P | U | U | F | F | U | U | U | U | U |
| rest_of_uk | wales | F | F | P | U | U | F | F | U | U | U | U | U |
| rest_of_uk | northern_ireland | F | F | P | U | U | F | F | U | U | U | U | U |
| rest_of_uk | other | F | F | P | U | U | F | F | U | U | U | U | U |
| international | england | F | F | P | U | U | F | F | U | U | U | U | U |
| international | scotland | F | F | P | U | U | F | F | U | U | U | U | U |
| international | wales | F | F | P | U | U | F | F | U | U | U | U | U |
| international | northern_ireland | F | F | P | U | U | F | F | U | U | U | U | U |
| international | other | F | F | P | U | U | F | F | U | U | U | U | U |

## University of Lancashire (lancashire-a101)

Engine status: not_production_ready

Totals: F 0, P 0, U 180

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | U | U | U | U | U | U | U | U | U | U | U | U |
| home | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| home | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | other | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | england | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | other | U | U | U | U | U | U | U | U | U | U | U | U |
| international | england | U | U | U | U | U | U | U | U | U | U | U | U |
| international | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| international | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | other | U | U | U | U | U | U | U | U | U | U | U | U |

## University of Leeds (leeds-a100)

Engine status: production_ready

Totals: F 10, P 65, U 105

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | F | P | P | U | U | P | P | U | U | U | U | U |
| home | scotland | F | P | P | U | U | P | P | U | U | U | U | U |
| home | wales | F | P | P | U | U | P | P | U | U | U | U | U |
| home | northern_ireland | F | P | P | U | U | P | P | U | U | U | U | U |
| home | other | F | P | P | U | U | P | P | U | U | U | U | U |
| rest_of_uk | england | F | P | P | U | U | P | P | U | U | U | U | U |
| rest_of_uk | scotland | F | P | P | U | U | P | P | U | U | U | U | U |
| rest_of_uk | wales | F | P | P | U | U | P | P | U | U | U | U | U |
| rest_of_uk | northern_ireland | F | P | P | U | U | P | P | U | U | U | U | U |
| rest_of_uk | other | F | P | P | U | U | P | P | U | U | U | U | U |
| international | england | P | P | P | U | U | P | P | U | U | U | U | U |
| international | scotland | P | P | P | U | U | P | P | U | U | U | U | U |
| international | wales | P | P | P | U | U | P | P | U | U | U | U | U |
| international | northern_ireland | P | P | P | U | U | P | P | U | U | U | U | U |
| international | other | P | P | P | U | U | P | P | U | U | U | U | U |

## University of Leeds (leeds-a101)

Engine status: not_production_ready

Totals: F 0, P 0, U 180

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | U | U | U | U | U | U | U | U | U | U | U | U |
| home | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| home | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | other | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | england | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | other | U | U | U | U | U | U | U | U | U | U | U | U |
| international | england | U | U | U | U | U | U | U | U | U | U | U | U |
| international | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| international | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | other | U | U | U | U | U | U | U | U | U | U | U | U |

## University of Leeds (leeds-a101-mbchb-medicine-with-a-gatewa)

Engine status: not_production_ready

Totals: F 0, P 0, U 180

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | U | U | U | U | U | U | U | U | U | U | U | U |
| home | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| home | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | other | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | england | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | other | U | U | U | U | U | U | U | U | U | U | U | U |
| international | england | U | U | U | U | U | U | U | U | U | U | U | U |
| international | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| international | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | other | U | U | U | U | U | U | U | U | U | U | U | U |

## University of Lincoln (lincoln-a100)

Engine status: production_ready

Totals: F 20, P 30, U 130

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | F | P | P | U | U | F | P | U | U | U | U | U |
| home | scotland | F | P | P | U | U | F | P | U | U | U | U | U |
| home | wales | F | P | P | U | U | F | P | U | U | U | U | U |
| home | northern_ireland | F | P | P | U | U | F | P | U | U | U | U | U |
| home | other | F | P | P | U | U | F | P | U | U | U | U | U |
| rest_of_uk | england | F | P | P | U | U | F | P | U | U | U | U | U |
| rest_of_uk | scotland | F | P | P | U | U | F | P | U | U | U | U | U |
| rest_of_uk | wales | F | P | P | U | U | F | P | U | U | U | U | U |
| rest_of_uk | northern_ireland | F | P | P | U | U | F | P | U | U | U | U | U |
| rest_of_uk | other | F | P | P | U | U | F | P | U | U | U | U | U |
| international | england | U | U | U | U | U | U | U | U | U | U | U | U |
| international | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| international | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | other | U | U | U | U | U | U | U | U | U | U | U | U |

## University of Lincoln (lincoln-a106)

Engine status: not_production_ready

Totals: F 0, P 0, U 180

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | U | U | U | U | U | U | U | U | U | U | U | U |
| home | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| home | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | other | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | england | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | other | U | U | U | U | U | U | U | U | U | U | U | U |
| international | england | U | U | U | U | U | U | U | U | U | U | U | U |
| international | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| international | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | other | U | U | U | U | U | U | U | U | U | U | U | U |

## University of Liverpool (liverpool-789s)

Engine status: not_production_ready

Totals: F 0, P 0, U 180

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | U | U | U | U | U | U | U | U | U | U | U | U |
| home | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| home | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | other | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | england | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | other | U | U | U | U | U | U | U | U | U | U | U | U |
| international | england | U | U | U | U | U | U | U | U | U | U | U | U |
| international | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| international | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | other | U | U | U | U | U | U | U | U | U | U | U | U |

## University of Liverpool (liverpool-a100)

Engine status: production_ready

Totals: F 45, P 15, U 120

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | F | F | P | U | U | U | F | U | U | U | U | U |
| home | scotland | F | F | P | U | U | U | F | U | U | U | U | U |
| home | wales | F | F | P | U | U | U | F | U | U | U | U | U |
| home | northern_ireland | F | F | P | U | U | U | F | U | U | U | U | U |
| home | other | F | F | P | U | U | U | F | U | U | U | U | U |
| rest_of_uk | england | F | F | P | U | U | U | F | U | U | U | U | U |
| rest_of_uk | scotland | F | F | P | U | U | U | F | U | U | U | U | U |
| rest_of_uk | wales | F | F | P | U | U | U | F | U | U | U | U | U |
| rest_of_uk | northern_ireland | F | F | P | U | U | U | F | U | U | U | U | U |
| rest_of_uk | other | F | F | P | U | U | U | F | U | U | U | U | U |
| international | england | F | F | P | U | U | U | F | U | U | U | U | U |
| international | scotland | F | F | P | U | U | U | F | U | U | U | U | U |
| international | wales | F | F | P | U | U | U | F | U | U | U | U | U |
| international | northern_ireland | F | F | P | U | U | U | F | U | U | U | U | U |
| international | other | F | F | P | U | U | U | F | U | U | U | U | U |

## University of Liverpool (liverpool-a101)

Engine status: not_production_ready

Totals: F 0, P 0, U 180

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | U | U | U | U | U | U | U | U | U | U | U | U |
| home | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| home | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | other | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | england | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | other | U | U | U | U | U | U | U | U | U | U | U | U |
| international | england | U | U | U | U | U | U | U | U | U | U | U | U |
| international | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| international | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | other | U | U | U | U | U | U | U | U | U | U | U | U |

## University of Manchester (manchester-a101)

Engine status: not_production_ready

Totals: F 0, P 0, U 180

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | U | U | U | U | U | U | U | U | U | U | U | U |
| home | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| home | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | other | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | england | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | other | U | U | U | U | U | U | U | U | U | U | U | U |
| international | england | U | U | U | U | U | U | U | U | U | U | U | U |
| international | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| international | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | other | U | U | U | U | U | U | U | U | U | U | U | U |

## University of Manchester (manchester-a100)

Engine status: production_ready

Totals: F 15, P 0, U 165

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | F | U | U | U | U | U | U | U | U | U | U | U |
| home | scotland | F | U | U | U | U | U | U | U | U | U | U | U |
| home | wales | F | U | U | U | U | U | U | U | U | U | U | U |
| home | northern_ireland | F | U | U | U | U | U | U | U | U | U | U | U |
| home | other | F | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | england | F | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | scotland | F | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | wales | F | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | northern_ireland | F | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | other | F | U | U | U | U | U | U | U | U | U | U | U |
| international | england | F | U | U | U | U | U | U | U | U | U | U | U |
| international | scotland | F | U | U | U | U | U | U | U | U | U | U | U |
| international | wales | F | U | U | U | U | U | U | U | U | U | U | U |
| international | northern_ireland | F | U | U | U | U | U | U | U | U | U | U | U |
| international | other | F | U | U | U | U | U | U | U | U | U | U | U |

## University of Nottingham (nottingham-a100)

Engine status: production_ready

Totals: F 15, P 30, U 135

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | F | U | U | U | U | P | P | U | U | U | U | U |
| home | scotland | F | U | U | U | U | P | P | U | U | U | U | U |
| home | wales | F | U | U | U | U | P | P | U | U | U | U | U |
| home | northern_ireland | F | U | U | U | U | P | P | U | U | U | U | U |
| home | other | F | U | U | U | U | P | P | U | U | U | U | U |
| rest_of_uk | england | F | U | U | U | U | P | P | U | U | U | U | U |
| rest_of_uk | scotland | F | U | U | U | U | P | P | U | U | U | U | U |
| rest_of_uk | wales | F | U | U | U | U | P | P | U | U | U | U | U |
| rest_of_uk | northern_ireland | F | U | U | U | U | P | P | U | U | U | U | U |
| rest_of_uk | other | F | U | U | U | U | P | P | U | U | U | U | U |
| international | england | F | U | U | U | U | P | P | U | U | U | U | U |
| international | scotland | F | U | U | U | U | P | P | U | U | U | U | U |
| international | wales | F | U | U | U | U | P | P | U | U | U | U | U |
| international | northern_ireland | F | U | U | U | U | P | P | U | U | U | U | U |
| international | other | F | U | U | U | U | P | P | U | U | U | U | U |

## University of Nottingham (nottingham-a101)

Engine status: not_production_ready

Totals: F 0, P 0, U 180

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | U | U | U | U | U | U | U | U | U | U | U | U |
| home | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| home | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | other | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | england | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | other | U | U | U | U | U | U | U | U | U | U | U | U |
| international | england | U | U | U | U | U | U | U | U | U | U | U | U |
| international | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| international | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | other | U | U | U | U | U | U | U | U | U | U | U | U |

## University of Nottingham (nottingham-a108)

Engine status: not_production_ready

Totals: F 0, P 0, U 180

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | U | U | U | U | U | U | U | U | U | U | U | U |
| home | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| home | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | other | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | england | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | other | U | U | U | U | U | U | U | U | U | U | U | U |
| international | england | U | U | U | U | U | U | U | U | U | U | U | U |
| international | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| international | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | other | U | U | U | U | U | U | U | U | U | U | U | U |

## University of Oxford (oxford-a100)

Engine status: production_ready

Totals: F 30, P 15, U 135

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | F | F | F | U | U | U | U | U | U | U | U | U |
| home | scotland | F | F | F | U | U | U | U | U | U | U | U | U |
| home | wales | F | F | F | U | U | U | U | U | U | U | U | U |
| home | northern_ireland | F | F | F | U | U | U | U | U | U | U | U | U |
| home | other | F | F | F | U | U | U | U | U | U | U | U | U |
| rest_of_uk | england | F | F | F | U | U | U | U | U | U | U | U | U |
| rest_of_uk | scotland | F | F | F | U | U | U | U | U | U | U | U | U |
| rest_of_uk | wales | F | F | F | U | U | U | U | U | U | U | U | U |
| rest_of_uk | northern_ireland | F | F | F | U | U | U | U | U | U | U | U | U |
| rest_of_uk | other | F | F | F | U | U | U | U | U | U | U | U | U |
| international | england | P | P | P | U | U | U | U | U | U | U | U | U |
| international | scotland | P | P | P | U | U | U | U | U | U | U | U | U |
| international | wales | P | P | P | U | U | U | U | U | U | U | U | U |
| international | northern_ireland | P | P | P | U | U | U | U | U | U | U | U | U |
| international | other | P | P | P | U | U | U | U | U | U | U | U | U |

## University of Oxford (oxford-a101)

Engine status: not_production_ready

Totals: F 0, P 0, U 180

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | U | U | U | U | U | U | U | U | U | U | U | U |
| home | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| home | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | other | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | england | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | other | U | U | U | U | U | U | U | U | U | U | U | U |
| international | england | U | U | U | U | U | U | U | U | U | U | U | U |
| international | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| international | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | other | U | U | U | U | U | U | U | U | U | U | U | U |

## University of Plymouth (plymouth-a100)

Engine status: production_ready

Totals: F 45, P 30, U 105

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | F | F | F | U | U | P | P | U | U | U | U | U |
| home | scotland | F | F | F | U | U | P | P | U | U | U | U | U |
| home | wales | F | F | F | U | U | P | P | U | U | U | U | U |
| home | northern_ireland | F | F | F | U | U | P | P | U | U | U | U | U |
| home | other | F | F | F | U | U | P | P | U | U | U | U | U |
| rest_of_uk | england | F | F | F | U | U | P | P | U | U | U | U | U |
| rest_of_uk | scotland | F | F | F | U | U | P | P | U | U | U | U | U |
| rest_of_uk | wales | F | F | F | U | U | P | P | U | U | U | U | U |
| rest_of_uk | northern_ireland | F | F | F | U | U | P | P | U | U | U | U | U |
| rest_of_uk | other | F | F | F | U | U | P | P | U | U | U | U | U |
| international | england | F | F | F | U | U | P | P | U | U | U | U | U |
| international | scotland | F | F | F | U | U | P | P | U | U | U | U | U |
| international | wales | F | F | F | U | U | P | P | U | U | U | U | U |
| international | northern_ireland | F | F | F | U | U | P | P | U | U | U | U | U |
| international | other | F | F | F | U | U | P | P | U | U | U | U | U |

## University of Plymouth (plymouth-a102)

Engine status: not_production_ready

Totals: F 0, P 0, U 180

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | U | U | U | U | U | U | U | U | U | U | U | U |
| home | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| home | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | other | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | england | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | other | U | U | U | U | U | U | U | U | U | U | U | U |
| international | england | U | U | U | U | U | U | U | U | U | U | U | U |
| international | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| international | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | other | U | U | U | U | U | U | U | U | U | U | U | U |

## University of Sheffield (sheffield-a100)

Engine status: production_ready

Totals: F 45, P 0, U 135

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | F | F | U | U | U | U | F | U | U | U | U | U |
| home | scotland | F | F | U | U | U | U | F | U | U | U | U | U |
| home | wales | F | F | U | U | U | U | F | U | U | U | U | U |
| home | northern_ireland | F | F | U | U | U | U | F | U | U | U | U | U |
| home | other | F | F | U | U | U | U | F | U | U | U | U | U |
| rest_of_uk | england | F | F | U | U | U | U | F | U | U | U | U | U |
| rest_of_uk | scotland | F | F | U | U | U | U | F | U | U | U | U | U |
| rest_of_uk | wales | F | F | U | U | U | U | F | U | U | U | U | U |
| rest_of_uk | northern_ireland | F | F | U | U | U | U | F | U | U | U | U | U |
| rest_of_uk | other | F | F | U | U | U | U | F | U | U | U | U | U |
| international | england | F | F | U | U | U | U | F | U | U | U | U | U |
| international | scotland | F | F | U | U | U | U | F | U | U | U | U | U |
| international | wales | F | F | U | U | U | U | F | U | U | U | U | U |
| international | northern_ireland | F | F | U | U | U | U | F | U | U | U | U | U |
| international | other | F | F | U | U | U | U | F | U | U | U | U | U |

## University of Sheffield (sheffield-a101)

Engine status: not_production_ready

Totals: F 0, P 0, U 180

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | U | U | U | U | U | U | U | U | U | U | U | U |
| home | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| home | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | other | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | england | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | other | U | U | U | U | U | U | U | U | U | U | U | U |
| international | england | U | U | U | U | U | U | U | U | U | U | U | U |
| international | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| international | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | other | U | U | U | U | U | U | U | U | U | U | U | U |

## University of Southampton (southampton-a100)

Engine status: production_ready

Totals: F 50, P 25, U 105

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | F | F | F | U | U | F | F | U | U | U | U | U |
| home | scotland | F | F | F | U | U | F | F | U | U | U | U | U |
| home | wales | F | F | F | U | U | F | F | U | U | U | U | U |
| home | northern_ireland | F | F | F | U | U | F | F | U | U | U | U | U |
| home | other | F | F | F | U | U | F | F | U | U | U | U | U |
| rest_of_uk | england | F | F | F | U | U | F | F | U | U | U | U | U |
| rest_of_uk | scotland | F | F | F | U | U | F | F | U | U | U | U | U |
| rest_of_uk | wales | F | F | F | U | U | F | F | U | U | U | U | U |
| rest_of_uk | northern_ireland | F | F | F | U | U | F | F | U | U | U | U | U |
| rest_of_uk | other | F | F | F | U | U | F | F | U | U | U | U | U |
| international | england | P | P | P | U | U | P | P | U | U | U | U | U |
| international | scotland | P | P | P | U | U | P | P | U | U | U | U | U |
| international | wales | P | P | P | U | U | P | P | U | U | U | U | U |
| international | northern_ireland | P | P | P | U | U | P | P | U | U | U | U | U |
| international | other | P | P | P | U | U | P | P | U | U | U | U | U |

## University of Southampton (southampton-a101)

Engine status: not_production_ready

Totals: F 0, P 0, U 180

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | U | U | U | U | U | U | U | U | U | U | U | U |
| home | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| home | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | other | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | england | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | other | U | U | U | U | U | U | U | U | U | U | U | U |
| international | england | U | U | U | U | U | U | U | U | U | U | U | U |
| international | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| international | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | other | U | U | U | U | U | U | U | U | U | U | U | U |

## University of Southampton (southampton-a102)

Engine status: not_production_ready

Totals: F 0, P 0, U 180

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | U | U | U | U | U | U | U | U | U | U | U | U |
| home | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| home | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | other | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | england | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | other | U | U | U | U | U | U | U | U | U | U | U | U |
| international | england | U | U | U | U | U | U | U | U | U | U | U | U |
| international | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| international | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | other | U | U | U | U | U | U | U | U | U | U | U | U |

## University of St Andrews (st-andrews-a100)

Engine status: production_ready

Totals: F 14, P 1, U 165

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | F | U | U | U | U | U | U | U | U | U | U | U |
| home | scotland | F | U | U | U | U | U | U | U | U | U | U | U |
| home | wales | F | U | U | U | U | U | U | U | U | U | U | U |
| home | northern_ireland | F | U | U | U | U | U | U | U | U | U | U | U |
| home | other | P | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | england | F | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | scotland | F | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | wales | F | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | northern_ireland | F | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | other | F | U | U | U | U | U | U | U | U | U | U | U |
| international | england | F | U | U | U | U | U | U | U | U | U | U | U |
| international | scotland | F | U | U | U | U | U | U | U | U | U | U | U |
| international | wales | F | U | U | U | U | U | U | U | U | U | U | U |
| international | northern_ireland | F | U | U | U | U | U | U | U | U | U | U | U |
| international | other | F | U | U | U | U | U | U | U | U | U | U | U |

## University of St Andrews (st-andrews-a101)

Engine status: not_production_ready

Totals: F 0, P 0, U 180

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | U | U | U | U | U | U | U | U | U | U | U | U |
| home | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| home | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | other | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | england | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | other | U | U | U | U | U | U | U | U | U | U | U | U |
| international | england | U | U | U | U | U | U | U | U | U | U | U | U |
| international | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| international | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | other | U | U | U | U | U | U | U | U | U | U | U | U |

## University of St Andrews (st-andrews-a10c)

Engine status: not_production_ready

Totals: F 0, P 0, U 180

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | U | U | U | U | U | U | U | U | U | U | U | U |
| home | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| home | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | other | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | england | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | other | U | U | U | U | U | U | U | U | U | U | U | U |
| international | england | U | U | U | U | U | U | U | U | U | U | U | U |
| international | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| international | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | other | U | U | U | U | U | U | U | U | U | U | U | U |

## University of St Andrews (st-andrews-lqv9)

Engine status: not_production_ready

Totals: F 0, P 0, U 180

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | U | U | U | U | U | U | U | U | U | U | U | U |
| home | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| home | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | other | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | england | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | other | U | U | U | U | U | U | U | U | U | U | U | U |
| international | england | U | U | U | U | U | U | U | U | U | U | U | U |
| international | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| international | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | other | U | U | U | U | U | U | U | U | U | U | U | U |

## University of Sunderland (sunderland-a100)

Engine status: production_ready

Totals: F 40, P 0, U 140

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | F | F | F | U | U | F | U | U | U | U | U | U |
| home | scotland | F | F | F | U | U | F | U | U | U | U | U | U |
| home | wales | F | F | F | U | U | F | U | U | U | U | U | U |
| home | northern_ireland | F | F | F | U | U | F | U | U | U | U | U | U |
| home | other | F | F | F | U | U | F | U | U | U | U | U | U |
| rest_of_uk | england | F | F | F | U | U | F | U | U | U | U | U | U |
| rest_of_uk | scotland | F | F | F | U | U | F | U | U | U | U | U | U |
| rest_of_uk | wales | F | F | F | U | U | F | U | U | U | U | U | U |
| rest_of_uk | northern_ireland | F | F | F | U | U | F | U | U | U | U | U | U |
| rest_of_uk | other | F | F | F | U | U | F | U | U | U | U | U | U |
| international | england | U | U | U | U | U | U | U | U | U | U | U | U |
| international | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| international | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | other | U | U | U | U | U | U | U | U | U | U | U | U |

## University of Surrey (surrey-a101)

Engine status: not_production_ready

Totals: F 0, P 0, U 180

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | U | U | U | U | U | U | U | U | U | U | U | U |
| home | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| home | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | other | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | england | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | other | U | U | U | U | U | U | U | U | U | U | U | U |
| international | england | U | U | U | U | U | U | U | U | U | U | U | U |
| international | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| international | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | other | U | U | U | U | U | U | U | U | U | U | U | U |

## University of Warwick (warwick-a101)

Engine status: not_production_ready

Totals: F 0, P 0, U 180

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | U | U | U | U | U | U | U | U | U | U | U | U |
| home | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| home | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | other | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | england | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | other | U | U | U | U | U | U | U | U | U | U | U | U |
| international | england | U | U | U | U | U | U | U | U | U | U | U | U |
| international | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| international | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | other | U | U | U | U | U | U | U | U | U | U | U | U |

## University of Worcester, Three Counties Medical School (worcester-a101)

Engine status: not_production_ready

Totals: F 0, P 0, U 180

| Fee status | Domicile | a_level | international_baccalaureate | scottish | btec | access_to_he | graduate | international_qualification | irish_leaving_certificate | ukwpmed | foundation | t_level | mixed_t_level_a_level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | england | U | U | U | U | U | U | U | U | U | U | U | U |
| home | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| home | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| home | other | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | england | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| rest_of_uk | other | U | U | U | U | U | U | U | U | U | U | U | U |
| international | england | U | U | U | U | U | U | U | U | U | U | U | U |
| international | scotland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | wales | U | U | U | U | U | U | U | U | U | U | U | U |
| international | northern_ireland | U | U | U | U | U | U | U | U | U | U | U | U |
| international | other | U | U | U | U | U | U | U | U | U | U | U | U |

