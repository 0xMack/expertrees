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
  /** Short description of the skill and your relationship to it. */
  description?: string
  depth: number
  parentId?: string
  childIds?: string[]
  /**
   * Self-assessed proficiency level. 0–5 in 0.5 increments.
   * 0 = aware / no hands-on experience
   * 1 = beginner — some exposure, guided practice
   * 2 = developing — independent work on simple tasks
   * 3 = competent — consistent independent delivery
   * 4 = proficient — complex problems, guides others
   * 5 = expert — deep mastery, recognized authority
   */
  proficiency?: Proficiency
  /**
   * Concrete evidence that demonstrates this skill — projects, certifications,
   * work experience, publications. Evidence with visibility 'private' is carried
   * through to the host app, which decides whether and how to render it.
   */
  evidence?: Evidence[]
  /**
   * Supplementary background: reference links, books, courses, or personal notes
   * that explain what this skill is or capture your thinking on it.
   * Distinct from evidence — these are context, not proof.
   */
  resources?: Resource[]
  position?: Position
  state?: NodeState
  style?: Partial<NodeStyle>
  meta?: Record<string, unknown>
}

/** 0–5 in 0.5 increments. See SkillNode.proficiency for scale definition. */
export type Proficiency = 0 | 0.5 | 1 | 1.5 | 2 | 2.5 | 3 | 3.5 | 4 | 4.5 | 5

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

/**
 * Proof that you have a skill — a project, certification, publication,
 * or work experience entry. The library stores and forwards all evidence;
 * the host app controls what is rendered based on visibility.
 */
export interface Evidence {
  id: string
  type: EvidenceType
  label: string
  url?: string
  description?: string
  /** ISO date string, e.g. '2023-06' or '2023-06-15'. */
  date?: string
  tags?: string[]
  thumbnail?: string
  /**
   * 'public'  — safe to display in any context (default).
   * 'private' — sensitive; host app should gate on auth or omit in public views.
   *             Use this for evidence tied to specific employers, clients, or
   *             internal systems that you cannot disclose publicly.
   */
  visibility?: EvidenceVisibility
  meta?: Record<string, unknown>
}

export type EvidenceVisibility = 'public' | 'private'

export type EvidenceType =
  | 'link'          // generic external link
  | 'text'          // plain text statement (no URL)
  | 'project'       // a piece of work — personal, open-source, or professional
  | 'certification' // credential, license, or award
  | 'publication'   // paper, article, or blog post
  | 'image'         // screenshot, diagram, or photo
  | 'video'         // demo, talk, or course recording
  | 'file'          // downloadable document or attachment

// ─── Resources ────────────────────────────────────────────────────────────────

/**
 * Supplementary context for a skill — reference material, background reading,
 * or personal notes. Not proof of skill; context around it.
 */
export interface Resource {
  type: ResourceType
  label: string
  /** URL to the resource — required for 'link', 'book', 'video', 'course'. */
  url?: string
  /**
   * Personal annotation or, for type 'note', the content itself.
   * Use this to capture your thinking, opinions, or reasoning about the skill.
   */
  note?: string
}

export type ResourceType =
  | 'link'    // reference documentation, article, or website
  | 'book'    // textbook or written resource
  | 'note'    // your own thinking or commentary (url optional)
  | 'video'   // recorded talk, tutorial, or course
  | 'course'  // structured learning path

// ─── Proficiency display ──────────────────────────────────────────────────────

export interface ProficiencyDisplayConfig {
  /**
   * Color gradient applied to nodes whose proficiency is 1–5.
   * The value is linearly interpolated: 1 → from, 5 → to.
   * Must be 6-digit hex strings (#rrggbb).
   */
  gradient: { from: string; to: string }
  /**
   * Color for nodes with proficiency: 0 — skills on your roadmap
   * that you plan to develop but have no experience with yet.
   */
  roadmapColor: string
  /**
   * How to color nodes where proficiency is not set at all.
   * 'default'  — use the theme's base node color (no visual change).
   * 'distinct' — apply unratedColor to make unrated nodes visually distinct.
   */
  unratedBehavior: 'default' | 'distinct'
  /** Color used when unratedBehavior is 'distinct'. */
  unratedColor: string
}

// ─── Theme ────────────────────────────────────────────────────────────────────

export interface Theme {
  background: string
  node: NodeStyle
  edge: EdgeStyle
  states: Record<NodeState, Partial<NodeStyle>>
  /**
   * Fill and glow color applied to selected nodes with high proficiency (4–5),
   * or to selected nodes with no proficiency set.
   */
  selectedColor: string
  /**
   * Fill and glow color applied to selected nodes with low proficiency (0–1).
   * Interpolated with selectedColor across the 0–5 proficiency range.
   * When proficiency is undefined, selectedColor is used directly.
   */
  selectedColorLow: string
  /** Visual configuration for the proficiency rating system. */
  proficiencyDisplay: ProficiencyDisplayConfig
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
  'canvas:click': () => void
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
  selectedColor?: string
  selectedColorLow?: string
  proficiencyDisplay?: Partial<ProficiencyDisplayConfig> & {
    gradient?: Partial<ProficiencyDisplayConfig['gradient']>
  }
}
