# @expertrees/react

React hook and component for [@expertrees/core](https://www.npmjs.com/package/@expertrees/core) — a hierarchical knowledge graph visualizer with a star map aesthetic.

## Install

```bash
npm add @expertrees/core @expertrees/react
```

## Component usage

```tsx
import { ExpertreeCanvas } from '@expertrees/react'
import type { SkillGraph } from '@expertrees/core'

const graph: SkillGraph = {
  id: 'my-skills',
  label: 'My Skills',
  nodes: [
    { id: 'eng',   label: 'Engineering', depth: 0, childIds: ['fe', 'be'] },
    { id: 'fe',    label: 'Frontend',    depth: 1, parentId: 'eng', childIds: ['react'] },
    { id: 'be',    label: 'Backend',     depth: 1, parentId: 'eng' },
    { id: 'react', label: 'React',       depth: 2, parentId: 'fe' },
  ],
  edges: [],
}

export function App() {
  return (
    <ExpertreeCanvas
      data={graph}
      style={{ width: '100%', height: '600px' }}
      on={{
        'node:click':    node => console.log(node),
        'context:enter': (node, stack) => console.log('entered', node.label),
      }}
    />
  )
}
```

### Component props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `data` | `SkillGraph` | required | Graph data |
| `theme` | `ThemeInput` | — | Visual theme overrides |
| `lod` | `LodThreshold[]` | — | Level-of-detail config |
| `initialContextNodeId` | `string` | — | Start inside a specific bubble |
| `on` | `Partial<SkillTreeEvents>` | — | Event handlers |
| `width` | `string` | `'100%'` | Canvas width (CSS) |
| `height` | `string` | `'100%'` | Canvas height (CSS) |
| `style` | `CSSProperties` | — | Additional inline styles |
| `className` | `string` | — | CSS class name |

### Imperative ref API

```tsx
import { useRef } from 'react'
import { ExpertreeCanvas, type ExpertreeCanvasHandle } from '@expertrees/react'

export function App() {
  const ref = useRef<ExpertreeCanvasHandle>(null)

  return (
    <>
      <ExpertreeCanvas ref={ref} data={graph} style={{ width: '100%', height: '600px' }} />
      <button onClick={() => ref.current?.setNodeState('react', 'unlocked')}>
        Unlock React
      </button>
      <button onClick={() => ref.current?.goBack()}>Back</button>
    </>
  )
}
```

The ref exposes all imperative methods plus read-only state properties:

| Name | Type | Description |
|------|------|-------------|
| `setNodeState(id, state)` | `(string, NodeState) => void` | Update a node's semantic state |
| `addEvidence(id, ev)` | `(string, Evidence) => void` | Attach evidence to a node |
| `removeEvidence(id, evId)` | `(string, string) => void` | Remove evidence |
| `updateTheme(theme)` | `(ThemeInput) => void` | Hot-swap the visual theme |
| `zoomIn()` | `() => void` | Programmatic zoom in |
| `zoomOut()` | `() => void` | Programmatic zoom out |
| `goBack()` | `() => void` | Exit to parent context |
| `enterContext(id)` | `(string) => void` | Programmatically enter a bubble |
| `jumpToNavDepth(n)` | `(number) => void` | Jump to stack depth `n` in one animation |
| `getGraph()` | `() => SkillGraph` | Serialize current graph state |
| `hoveredNode` | `SkillNode \| null` | Currently hovered node (read-only) |
| `selectedNode` | `SkillNode \| null` | Currently selected node (read-only) |
| `zoom` | `number` | Current zoom level (read-only) |
| `navigationStack` | `readonly NavigationFrame[]` | Current nav stack (read-only) |
| `canGoBack` | `boolean` | Whether a parent context exists (read-only) |

---

## Hook usage

Use `useExpertree` directly for full control over the canvas and layout.

```tsx
import { useExpertree } from '@expertrees/react'
import type { SkillGraph } from '@expertrees/core'

declare const graph: SkillGraph

export function SkillMap() {
  const {
    canvasRef,
    hoveredNode,
    selectedNode,
    zoom,
    navigationStack,
    canGoBack,
    goBack,
    jumpToNavDepth,
    setNodeState,
  } = useExpertree({
    data: graph,
    on: { 'node:click': node => console.log(node) },
  })

  return (
    <div style={{ position: 'relative', width: '100%', height: '600px' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />

      {/* Breadcrumbs */}
      <nav style={{ position: 'absolute', top: 8, left: 8 }}>
        {navigationStack.map((frame, i) => (
          <button key={frame.nodeId ?? 'root'} onClick={() => jumpToNavDepth(i + 1)}>
            {frame.label}
          </button>
        ))}
      </nav>

      {/* Side panel */}
      {hoveredNode && (
        <aside style={{ position: 'absolute', right: 0, top: 0 }}>
          <h3>{hoveredNode.label}</h3>
        </aside>
      )}
    </div>
  )
}
```

### `useExpertree` return values

| Name | Type | Description |
|------|------|-------------|
| `canvasRef` | callback ref | Pass directly to `<canvas ref={canvasRef}>` |
| `hoveredNode` | `SkillNode \| null` | Currently hovered node |
| `selectedNode` | `SkillNode \| null` | Currently selected node |
| `zoom` | `number` | Current zoom level |
| `navigationStack` | `readonly NavigationFrame[]` | Full nav stack; last entry is active context |
| `canGoBack` | `boolean` | Whether a parent context exists |
| `goBack()` | `() => void` | Exit to parent context |
| `jumpToNavDepth(n)` | `(number) => void` | Jump to stack depth `n` in one animation |
| `enterContext(id)` | `(string) => void` | Programmatically enter a bubble |
| `setNodeState(id, state)` | `(string, NodeState) => void` | Update a node's semantic state |
| `addEvidence(id, ev)` | `(string, Evidence) => void` | Attach evidence to a node |
| `removeEvidence(id, evId)` | `(string, string) => void` | Remove evidence |
| `updateTheme(theme)` | `(ThemeInput) => void` | Hot-swap the visual theme |
| `zoomIn()` | `() => void` | Programmatic zoom in |
| `zoomOut()` | `() => void` | Programmatic zoom out |
| `getGraph()` | `() => SkillGraph` | Serialize current graph state |

## License

MIT — [github.com/0xMack/expertrees](https://github.com/0xMack/expertrees)
