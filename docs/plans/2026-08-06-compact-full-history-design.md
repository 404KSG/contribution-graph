# Compact Full-History Redesign

## Goal

Make complete graph history immediately legible without the oversized vertical rhythm of the first preview. The default view must represent every block in the graph and every calendar year from the earliest result through the current year.

## Data correctness

The Datalog query must project both the entity and its creation timestamp. Projecting the timestamp alone applies set semantics and can collapse different blocks that share a timestamp, especially after imports or batch creation. Aggregation still uses the timestamp, but one query row is retained for every entity.

The dialog always initializes to `Entire graph`. `Current user` remains an explicit secondary filter. The loaded-state summary names the active scope and exact year range so a filtered result cannot be mistaken for the whole graph.

## Layout

Use a dense annual archive wall. Desktop layouts display two year panels per row; narrow layouts use one. Each panel contains all 365 or 366 daily cells, month markers, weekday guides, annual block total, and active-day count. Smaller cells and restrained padding allow four years to fit comfortably in one ordinary desktop viewport and keep longer histories easy to scan.

The header combines title, scope, refresh, and close controls on one line. Statistics become a compact summary rail instead of four oversized cards. Status and data caveats share a slim metadata row. The history area is the only scrollable region.

## Visual direction

Use a precise archival-instrument aesthetic: warm neutral surfaces, fine borders, tabular numerals, emerald activity levels, subtle depth, and short entrance motion. Avoid decorative gradients or large empty cards. Dark mode keeps the same hierarchy and contrast.

## Verification

Add a regression test proving identical timestamps from different entities are not deduplicated by the adapter. Retain calendar, leap-day, gap-year, lifecycle, build, audit, and 500,000-row benchmark coverage. Update the existing Draft Depot PR to a fixed tested commit and wait for both build and preview-publish workflows.
