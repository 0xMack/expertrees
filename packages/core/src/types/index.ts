// ─── Graph ────────────────────────────────────────────────────────────────────

export interface SkillGraph {
  id: string
  label: string
  nodes: SkillNode[]
  edges: SkillEdge[]
  theme?: ThemeInput
  meta?: Record<string, unknown>
}

// ─── Node ─────────────────────────────────────────────────────────────────────

export interface SkillNode {
  id: string
  label: string
  description?: string
  depth: number
  parentId?: string
  childIds?: string[]
  position?: Position
  state?: NodeState
  evidence?: Evidence[]
  style?: Partial<NodeStyle>
  meta?: Record<string, unknown>
}

export interface Position {
  x: number
  y: number
}

export type NodeState = 'default' | 'active' | 'locked' | 'unlocked' | 'highlighted'

// Internal — managed by the renderer, not the consumer
export type InternalNodeState = 'idle' | 'hovered' | 'selected' | 'expanded'

// ─── Edge ─────────────────────────────────────────────────────────────────────

export interface SkillEdge {
  id: string
  source: string
  target: string
  directed: boolean
  label?: string
  style?: Partial<EdgeStyle>
  meta?: Record<string, unknown>
}

// ─── Evidence ─────────────────────────────────────────────────────────────────

export interface Evidence {
  id: string
  type: EvidenceType
  label: string
  description?: string
  date?: string
  tags?: string[]
  thumbnail?: string
  meta?: Record<string, unknown>
}

export type EvidenceType = 'link' | 'text' | 'image' | 'video' | 'file'

// ─── Theme ────────────────────────────────────────────────────────────────────

export interface Theme {
  background: string
  node: NodeStyle
  edge: EdgeStyle
  states: Record<NodeState, Partial<NodeStyle>>
}

export interface NodeStyle {
  color: string
  glowColor: string
  glowRadius: number
  size: number
  shape: NodeShape
  opacity: number
  labelColor: string
  labelSize: number
  labelFont: string
}

export type NodeShape = 'circle' | 'star' | 'hexagon' | 'diamond'

export interface EdgeStyle {
  color: string
  width: number
  opacity: number
  dashPattern?: number[]
  animated: boolean
}

// ─── Navigation ───────────────────────────────────────────────────────────────

export interface NavigationFrame {
  nodeId: string | null
  label: string
}

// ─── Events ───────────────────────────────────────────────────────────────────

export interface SkillTreeEvents {
  'node:click': (node: SkillNode) => void
  'node:hover': (node: SkillNode) => void
  'node:blur': (node: SkillNode) => void
  'zoom:change': (zoom: number) => void
  'context:enter': (node: SkillNode, stack: readonly NavigationFrame[]) => void
  'context:exit': (frame: NavigationFrame, stack: readonly NavigationFrame[]) => void
  'graph:ready': (graph: SkillGraph) => void
}

// ─── LOD ──────────────────────────────────────────────────────────────────────

export interface LodThreshold {
  depth: number
  minZoom: number
  maxZoom: number
}

// ─── Theme input (deeply partial — used for consumer-facing APIs) ─────────────

export interface ThemeInput {
  background?: string
  node?: Partial<NodeStyle>
  edge?: Partial<EdgeStyle>
  states?: Partial<Record<NodeState, Partial<NodeStyle>>>
}

