# @expertrees/core

Framework-agnostic engine for building and visualizing hierarchical knowledge graphs — navigable like a star map.

Nodes with children render as glowing **bubbles**. Leaf nodes render as **twinkling stars**. Click into a bubble to explore its sub-graph. Each node can carry a self-assessed **proficiency rating**, supporting **evidence**, and supplementary **resources**.

Built on Canvas 2D with force-directed layout, continuous animations, and touch/pinch-to-zoom support.

> For framework-specific packages see [@expertrees/vue](https://www.npmjs.com/package/@expertrees/vue), [@expertrees/react](https://www.npmjs.com/package/@expertrees/react), [@expertrees/angular](https://www.npmjs.com/package/@expertrees/angular).

## Install

```bash
npm add @expertrees/core
```

## Basic usage

```ts
import { SkillTreeEngine } from '@expertrees/core'

const engine = new SkillTreeEngine({
  canvas: document.querySelector('canvas')!,
  data: {
    id: 'my-skills',
    label: 'My Skills',
    nodes: [
      {
        id: 'fe',
        label: 'Frontend',
        depth: 0,
        childIds: ['vue', 'ts'],
        proficiency: 4,
        description: 'Building production UIs for five years.',
      },
      {
        id: 'vue',
        label: 'Vue',
        depth: 1,
        parentId: 'fe',
        proficiency: 4.5,
        evidence: [
          { id: 'e1', type: 'project', label: 'This very site', url: 'https://example.com' },
        ],
        resources: [
          { type: 'link', label: 'Vue docs', url: 'https://vuejs.org' },
        ],
      },
      { id: 'ts', label: 'TypeScript', depth: 1, parentId: 'fe', proficiency: 5 },
    ],
    edges: [],
  },
  on: {
    'node:click':    node          => console.log('clicked', node.label),
    'context:enter': (node, stack) => console.log('entered', node.label),
    'zoom:change':   zoom          => console.log('zoom', zoom),
  },
})

// Always call dispose when unmounting — cancels the animation loop
engine.dispose()
```

## API

### Constructor options

```ts
new SkillTreeEngine({
  canvas: HTMLCanvasElement      // required
  data: SkillGraph               // required
  theme?: ThemeInput             // optional visual overrides
  lod?: LodThreshold[]           // optional level-of-detail config
  initialContextNodeId?: string  // start inside a specific bubble
  on?: Partial<SkillTreeEvents>  // event handlers
})
```

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `setNodeState` | `(id, NodeState) => void` | Update a node's semantic state |
| `addEvidence` | `(id, Evidence) => void` | Attach evidence to a node |
| `removeEvidence` | `(id, evidenceId) => void` | Remove evidence from a node |
| `updateTheme` | `(ThemeInput) => void` | Hot-swap the visual theme |
| `zoomIn` | `() => void` | Programmatic zoom in |
| `zoomOut` | `() => void` | Programmatic zoom out |
| `goBack` | `() => void` | Exit to parent context |
| `enterContext` | `(nodeId) => void` | Programmatically enter a bubble |
| `jumpToNavDepth` | `(targetLength) => void` | Jump to a stack depth in one animation |
| `getGraph` | `() => SkillGraph` | Serialize current graph state |
| `getNavigationStack` | `() => readonly NavigationFrame[]` | Current navigation stack |
| `dispose` | `() => void` | Cancel animation loop and clean up |

### Events

| Event | Payload | When |
|-------|---------|------|
| `node:click` | `SkillNode` | User clicks a node |
| `node:hover` | `SkillNode` | Mouse enters a node |
| `node:blur` | `SkillNode` | Mouse leaves a node |
| `canvas:click` | — | Click on empty canvas |
| `zoom:change` | `number` | Every zoom frame |
| `context:enter` | `(SkillNode, NavigationFrame[])` | Entering a bubble |
| `context:exit` | `(NavigationFrame, NavigationFrame[])` | Exiting a bubble |
| `graph:ready` | `SkillGraph` | Engine mounted and ready |

## Data model

```ts
interface SkillGraph {
  id: string
  label: string
  nodes: SkillNode[]
  edges: SkillEdge[]
  theme?: ThemeInput
  meta?: Record<string, unknown>
}

interface SkillNode {
  id: string
  label: string
  /** Short description of the skill and your relationship to it. */
  description?: string
  depth: number            // 0 = root; higher = more specific
  parentId?: string        // required for children inside a bubble
  childIds?: string[]      // present on bubble nodes; omit for leaf/star nodes
  /**
   * Self-assessed proficiency level. 0–5 in 0.5 increments.
   * 0 = on roadmap / no hands-on experience
   * 1 = beginner, 2 = developing, 3 = competent, 4 = proficient, 5 = expert
   * Drives node colour (gradient) and the star-arc shown on selection.
   */
  proficiency?: Proficiency
  /**
   * Concrete proof of the skill — projects, certifications, work history.
   * Mark sensitive items visibility: 'private'; the host app decides
   * whether to render them (e.g. behind auth). The library forwards all
   * evidence regardless of visibility.
   */
  evidence?: Evidence[]
  /**
   * Supplementary context — reference links, books, personal notes.
   * Not proof; background or thinking about the skill.
   */
  resources?: Resource[]
  position?: { x: number; y: number }
  state?: NodeState        // 'default' | 'active' | 'locked' | 'unlocked' | 'highlighted'
  style?: Partial<NodeStyle>
  meta?: Record<string, unknown>
}

/** 0–5 in 0.5 increments. */
type Proficiency = 0 | 0.5 | 1 | 1.5 | 2 | 2.5 | 3 | 3.5 | 4 | 4.5 | 5

interface Evidence {
  id: string
  type: EvidenceType
  label: string
  url?: string
  description?: string
  date?: string            // ISO 8601, e.g. '2023-06'
  tags?: string[]
  thumbnail?: string
  /** 'public' (default) — safe to display anywhere.
   *  'private' — sensitive; host app should gate on auth. */
  visibility?: 'public' | 'private'
  meta?: Record<string, unknown>
}

type EvidenceType =
  | 'link'          // generic external link
  | 'text'          // plain text statement
  | 'project'       // personal, open-source, or professional work
  | 'certification' // credential, license, or award
  | 'publication'   // paper, article, or blog post
  | 'image'         // screenshot, diagram, or photo
  | 'video'         // demo, talk, or recording
  | 'file'          // downloadable document

interface Resource {
  type: 'link' | 'book' | 'note' | 'video' | 'course'
  label: string
  url?: string
  /** Personal annotation or, for type 'note', the content itself. */
  note?: string
}
```

## Proficiency display

When `proficiency` is set on a node:

- **Unselected** — node colour is interpolated along a configurable gradient (default: purple → blue, 1 → 5). Proficiency `0` uses a distinct roadmap colour. Nodes with no proficiency set follow the base theme colour.
- **Selected** — five stars fan out above the node in an animated crown arc. The selected ring colour is also proficiency-aware (default: amber → dark red, low → high).

## Theming

All fields are optional and deep-merge over built-in defaults.

```ts
const theme: ThemeInput = {
  background: '#050a1a',
  node: {
    color:      '#4a9eff',
    glowColor:  '#4a9eff',
    glowRadius: 12,
    size:       8,
    shape:      'circle',  // 'circle' | 'star' | 'hexagon' | 'diamond'
  },
  edge: {
    color:    '#1e3a5f',
    width:    1.5,
    opacity:  0.6,
    animated: false,
  },
  states: {
    active:      { color: '#7fcdff', glowColor: '#7fcdff', glowRadius: 20 },
    unlocked:    { color: '#50fa7b', glowColor: '#50fa7b', glowRadius: 16 },
    locked:      { color: '#2a3a4a', opacity: 0.5 },
    highlighted: { color: '#ffb86c', glowColor: '#ffb86c', glowRadius: 24 },
  },
  /** Color for selected nodes with high proficiency (or no proficiency set). */
  selectedColor: '#8B1A1A',
  /** Color for selected nodes with low proficiency. Interpolated with selectedColor. */
  selectedColorLow: '#d97706',
  proficiencyDisplay: {
    /** Blue→purple gradient mapped to proficiency 1→5. Must be 6-digit hex. */
    gradient: { from: '#9b5de5', to: '#4a9eff' },
    /** Color for proficiency: 0 — skills on your roadmap. */
    roadmapColor: '#3a4a6b',
    /**
     * How to colour nodes where proficiency is not set.
     * 'default'  — use the base node colour (no visual change).
     * 'distinct' — apply unratedColor to make unrated nodes stand out.
     */
    unratedBehavior: 'default',
    unratedColor: '#2a3550',
  },
}

engine.updateTheme({ node: { color: '#ff79c6' } })
```

## License

MIT — [github.com/0xMack/expertrees](https://github.com/0xMack/expertrees)
