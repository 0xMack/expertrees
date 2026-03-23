---
"@expertrees/core": minor
"@expertrees/vue": minor
"@expertrees/react": minor
"@expertrees/angular": minor
---

Add proficiency ratings, evidence privacy controls, and resources; improve mobile layout and touch support.

### New node data fields

- `proficiency?: Proficiency` — self-assessed skill rating from 0–5 in 0.5 increments. `0` marks a skill as on-roadmap (no hands-on experience yet).
- `description?: string` — short description of the skill and your relationship to it.
- `evidence[].visibility` — `'public'` (default) or `'private'`. Private evidence is forwarded to the host app as-is; the library never filters it. Useful for sensitive work history that should only appear behind authentication.
- `evidence[].type` — expanded set: `'project'`, `'certification'`, `'publication'` added alongside existing `'link'`, `'text'`, `'image'`, `'video'`, `'file'`.
- `resources?: Resource[]` — supplementary context (reference links, books, personal notes). Distinct from evidence: context about a skill, not proof of it.

### Proficiency visuals

- **Unselected nodes** are colour-coded by proficiency using a configurable gradient (default: purple → blue across 1–5). Proficiency `0` uses a dedicated roadmap colour. Unrated nodes follow the base theme colour by default (configurable).
- **Selected nodes** display an animated five-star crown arc that fans in left-to-right on selection and reverses on deselect. Half-stars are rendered for 0.5-increment ratings.
- **Selected node ring colour** is proficiency-aware: interpolates from amber (low) to dark red (high). Nodes with no proficiency set use the high-end colour.

### New theme fields

- `selectedColor` — ring/fill colour for selected nodes at high proficiency or with no proficiency set (default: `#8B1A1A`).
- `selectedColorLow` — ring/fill colour for selected nodes at low proficiency (default: `#d97706`). Interpolated with `selectedColor` across the 0–5 range.
- `proficiencyDisplay.gradient` — hex colour pair `{ from, to }` for the proficiency node gradient.
- `proficiencyDisplay.roadmapColor` — colour for proficiency-0 nodes.
- `proficiencyDisplay.unratedBehavior` — `'default'` | `'distinct'`. Controls colour of nodes with no proficiency set.
- `proficiencyDisplay.unratedColor` — colour used when `unratedBehavior` is `'distinct'`.

### Layout improvements

- Force layout now scales charge strength and link distances proportionally to the canvas area, so nodes fill the view on both wide desktop and tall mobile canvases.
- A soft elliptical boundary replaces the previous approach, keeping nodes visible without creating unnatural straight lines at the edges.
- Initial zoom level is automatically reduced for contexts with many nodes so all nodes are visible on load.
- Center gravity (`forceX`/`forceY`) prevents nodes clustering at the boundary.

### Bug fixes

- Hovering over a selected node no longer clears the selected visual state. Selection now persists until the user clicks elsewhere, selects another node, or navigates.
- Touch events on mobile are now correctly handled — `touch-action: none` is set on the canvas, preventing browser scroll from competing with canvas pan/tap.
- On mobile, nodes are now correctly centred in the view on initial load. Previously, a zero-size canvas at mount time caused the pan origin to initialise at `{0, 0}` rather than the canvas centre.
