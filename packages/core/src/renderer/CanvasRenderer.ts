import type {
  SkillNode,
  SkillEdge,
  NodeStyle,
  EdgeStyle,
  Theme,
  ThemeInput,
  Position,
  InternalNodeState,
} from '../types/index.js'
import { mergeTheme } from '../theme/merge.js'

export interface RenderState {
  positions: Map<string, Position>
  internalStates: Map<string, InternalNodeState>
  contextFadeAlpha: number
  pan: Position
  zoom: number
}

export const BUBBLE_WORLD_RADIUS = 40

// ─── Background star field ────────────────────────────────────────────────────

interface BgStar {
  x: number      // 0–1 normalized CSS position
  y: number
  r: number      // base radius (CSS px)
  phase: number
  speed: number  // twinkle speed (radians/sec)
}

function generateBgStars(count: number): BgStar[] {
  return Array.from({ length: count }, () => ({
    x:     Math.random(),
    y:     Math.random(),
    r:     0.4 + Math.random() * 1.2,
    phase: Math.random() * Math.PI * 2,
    speed: 0.4 + Math.random() * 1.2,
  }))
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Deterministic phase from a node id — avoids all nodes twinkling in sync. */
function hashPhase(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return ((h % 1000) / 1000) * Math.PI * 2
}

/**
 * Linear interpolation between two 6-digit hex colors (#rrggbb).
 * t = 0 → from, t = 1 → to.
 */
function interpolateColor(from: string, to: string, t: number): string {
  const r1 = parseInt(from.slice(1, 3), 16)
  const g1 = parseInt(from.slice(3, 5), 16)
  const b1 = parseInt(from.slice(5, 7), 16)
  const r2 = parseInt(to.slice(1, 3), 16)
  const g2 = parseInt(to.slice(3, 5), 16)
  const b2 = parseInt(to.slice(5, 7), 16)
  const r  = Math.round(r1 + (r2 - r1) * t)
  const g  = Math.round(g1 + (g2 - g1) * t)
  const b  = Math.round(b1 + (b2 - b1) * t)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

// ─── Proficiency arc animation ────────────────────────────────────────────────

interface ProficiencyAnim {
  appearing: boolean
  startTime: number   // performance.now() ms
}

// Per-star delays (ms) for the 5 arc positions [leftmost … rightmost]
// Appearing: left → right
const STAR_APPEAR_DELAYS    = [0, 80, 160, 240, 320] as const
// Disappearing: reverse → right → left
const STAR_DISAPPEAR_DELAYS = [320, 240, 160, 80, 0] as const
const STAR_ANIM_DURATION    = 200   // ms — duration of each individual star's scale
const STAR_ANIM_TOTAL       = 520   // ms — full animation window (200 + 320 max delay)

export class CanvasRenderer {
  private _canvas: HTMLCanvasElement
  private _ctx: CanvasRenderingContext2D
  private _theme: Theme
  private _dpr: number
  private _bgStars: BgStar[]

  // Burst animation state (entry)
  private _burst: { startTime: number; center: Position; color: string } | null = null
  private readonly _burstDuration = 450

  // Implode animation state (exit)
  private _implode: { startTime: number; center: Position } | null = null
  private readonly _implodeDuration = 420

  // Per-node proficiency arc animation state (detected from internalStates each frame)
  private _proficiencyAnim = new Map<string, ProficiencyAnim>()

  constructor(canvas: HTMLCanvasElement, theme?: ThemeInput) {
    this._canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not get 2D context from canvas')
    this._ctx = ctx
    this._theme = mergeTheme(theme)
    this._dpr = window.devicePixelRatio ?? 1
    this._bgStars = generateBgStars(150)
    this._resize()
  }

  get canvas(): HTMLCanvasElement { return this._canvas }

  get isBurstActive(): boolean { return this._burst !== null }

  /** Sync canvas physical pixel size to its CSS size. Call when the container resizes. */
  resize(): void { this._resize() }

  /** Returns the resolved fill color for a node (used for burst color matching). */
  resolveNodeColor(node: SkillNode): string {
    const style = this._resolveStyle(node)
    return this._proficiencyNodeColor(node) ?? style.color
  }

  updateTheme(theme: ThemeInput): void {
    this._theme = mergeTheme(theme)
  }

  triggerBurst(centerCanvas: Position, color: string): void {
    this._burst = { startTime: performance.now(), center: centerCanvas, color }
  }

  triggerImplode(centerCanvas: Position): void {
    this._implode = { startTime: performance.now(), center: centerCanvas }
  }

  render(nodes: SkillNode[], edges: SkillEdge[], state: RenderState): void {
    const ctx = this._ctx
    const t = performance.now() / 1000   // seconds — drives all animations
    const { pan, zoom, contextFadeAlpha, positions, internalStates } = state

    const cssW = this._canvas.width  / this._dpr
    const cssH = this._canvas.height / this._dpr

    // ── Background ───────────────────────────────────────────────────────────
    ctx.clearRect(0, 0, this._canvas.width, this._canvas.height)
    ctx.fillStyle = this._theme.background
    ctx.fillRect(0, 0, this._canvas.width, this._canvas.height)

    // ── DPR scale (all CSS-pixel drawing lives inside here) ──────────────────
    ctx.save()
    ctx.scale(this._dpr, this._dpr)

    // Background star field — screen space, doesn't pan/zoom
    this._renderBgStars(ctx, cssW, cssH, t)

    // ── World transform ───────────────────────────────────────────────────────
    ctx.save()
    ctx.translate(pan.x, pan.y)
    ctx.scale(zoom, zoom)

    // Edges (solid) + animated particles
    for (const edge of edges) {
      const sourcePos = positions.get(edge.source)
      const targetPos = positions.get(edge.target)
      if (!sourcePos || !targetPos) continue
      this._drawEdge(ctx, sourcePos, targetPos, edge.style)
      if (edge.style?.animated ?? this._theme.edge.animated) {
        this._renderEdgeParticles(ctx, sourcePos, targetPos, edge, t, zoom)
      }
    }

    // Parent-child connectors
    for (const node of nodes) {
      if (!node.parentId) continue
      const parentPos = positions.get(node.parentId)
      const childPos  = positions.get(node.id)
      if (!parentPos || !childPos) continue
      ctx.save()
      ctx.globalAlpha = contextFadeAlpha * 0.35
      ctx.strokeStyle = this._theme.edge.color
      ctx.lineWidth   = this._theme.edge.width / zoom
      ctx.setLineDash([4, 8])
      ctx.beginPath()
      ctx.moveTo(parentPos.x, parentPos.y)
      ctx.lineTo(childPos.x,  childPos.y)
      ctx.stroke()
      ctx.restore()
    }

    // Nodes — bubbles first so stars sit on top
    const bubbles = nodes.filter(n =>  n.childIds && n.childIds.length > 0)
    const stars   = nodes.filter(n => !n.childIds || n.childIds.length === 0)

    for (const node of [...bubbles, ...stars]) {
      const pos = positions.get(node.id)
      if (!pos) continue
      const internal = internalStates.get(node.id) ?? 'idle'
      const isBubble = !!(node.childIds && node.childIds.length > 0)
      this._drawNode(ctx, node, pos, internal, contextFadeAlpha, zoom, isBubble, t)
    }

    ctx.restore() // undo world transform
    ctx.restore() // undo DPR scale

    // Overlays — physical pixels, screen space
    this._renderBurst()
    this._renderImplode()
  }

  // ─── Background stars ─────────────────────────────────────────────────────

  private _renderBgStars(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void {
    for (const star of this._bgStars) {
      const brightness = 0.5 + 0.5 * Math.sin(t * star.speed + star.phase)
      const alpha = 0.08 + 0.25 * brightness
      const r = star.r * (0.7 + 0.3 * brightness)
      ctx.beginPath()
      ctx.arc(star.x * w, star.y * h, r, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`
      ctx.fill()
    }
  }

  // ─── Node rendering ───────────────────────────────────────────────────────

  private _drawNode(
    ctx: CanvasRenderingContext2D,
    node: SkillNode,
    pos: Position,
    internal: InternalNodeState,
    alpha: number,
    zoom: number,
    isBubble: boolean,
    t: number,
  ): void {
    if (isBubble) {
      this._drawBubble(ctx, node, pos, internal, alpha, zoom, t)
    } else {
      this._drawStar(ctx, node, pos, internal, alpha, zoom, t)
    }

    // Update proficiency arc animation state and draw if active
    if (node.proficiency !== undefined) {
      this._updateProficiencyAnim(node.id, internal)
      const anim = this._proficiencyAnim.get(node.id)
      if (anim) {
        const elapsed = performance.now() - anim.startTime
        this._drawProficiencyArc(ctx, node, pos, isBubble, alpha, zoom, elapsed, anim.appearing)
      }
    }
  }

  private _drawBubble(
    ctx: CanvasRenderingContext2D,
    node: SkillNode,
    pos: Position,
    internal: InternalNodeState,
    alpha: number,
    zoom: number,
    t: number,
  ): void {
    const style = this._resolveStyle(node)
    const { color, glowColor } = this._effectiveColors(node, style, internal === 'selected')
    const phase = hashPhase(node.id)
    // Bubbles breathe very slowly; selected breathes a bit more
    const breatheAmp = internal === 'selected' ? 0.08 : 0.04
    const breathe = 1 + breatheAmp * Math.sin(t * 0.6 + phase)
    const r = BUBBLE_WORLD_RADIUS * breathe * (internal === 'hovered' ? 1.1 : 1)
    const isSelected = internal === 'selected'

    ctx.save()
    ctx.globalAlpha = style.opacity * alpha

    // Outer halo — brighter when selected
    const haloOuter = isSelected ? r * 2.8 : r * 2.2
    const haloStop0 = isSelected ? glowColor + '55' : glowColor + '30'
    const halo = ctx.createRadialGradient(pos.x, pos.y, r * 0.5, pos.x, pos.y, haloOuter)
    halo.addColorStop(0, haloStop0)
    halo.addColorStop(1, glowColor + '00')
    ctx.fillStyle = halo
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, haloOuter, 0, Math.PI * 2)
    ctx.fill()

    // Inner fill
    const fill = ctx.createRadialGradient(pos.x, pos.y - r * 0.3, r * 0.1, pos.x, pos.y, r)
    fill.addColorStop(0, color + (isSelected ? '70' : '50'))
    fill.addColorStop(1, color + (isSelected ? '28' : '18'))
    ctx.fillStyle = fill
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2)
    ctx.fill()

    // Border ring
    ctx.strokeStyle  = isSelected ? glowColor : color
    ctx.lineWidth    = (isSelected ? 2.5 : 1.5) / zoom
    ctx.globalAlpha  = style.opacity * alpha * (isSelected ? 1 : 0.7)
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2)
    ctx.stroke()

    // Selected: spinning dashed outer ring
    if (isSelected) {
      const spinAngle = t * 0.7 + phase
      ctx.strokeStyle  = glowColor
      ctx.lineWidth    = 1.5 / zoom
      ctx.globalAlpha  = style.opacity * alpha * 0.85
      ctx.setLineDash([10 / zoom, 7 / zoom])
      ctx.lineDashOffset = -spinAngle * 18
      ctx.beginPath()
      ctx.arc(pos.x, pos.y, r * 1.3, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])
    }

    // Child-count dots orbiting inside
    if (node.childIds && node.childIds.length > 0) {
      const count    = Math.min(node.childIds.length, 8)
      const dotOrbit = r * 0.55
      const dotSize  = Math.max(1.5, r * 0.06)
      const orbit    = t * 0.15 + phase   // slow rotation
      ctx.globalAlpha = style.opacity * alpha * 0.6
      ctx.fillStyle   = color + '90'
      for (let i = 0; i < count; i++) {
        const angle = orbit + (i / count) * Math.PI * 2
        ctx.beginPath()
        ctx.arc(
          pos.x + dotOrbit * Math.cos(angle),
          pos.y + dotOrbit * Math.sin(angle),
          dotSize, 0, Math.PI * 2,
        )
        ctx.fill()
      }
    }

    // Label
    ctx.globalAlpha    = style.opacity * alpha
    ctx.fillStyle      = style.labelColor
    ctx.font           = `bold ${(style.labelSize * 1.2) / zoom}px ${style.labelFont}`
    ctx.textAlign      = 'center'
    ctx.textBaseline   = 'middle'
    ctx.fillText(node.label, pos.x, pos.y)

    ctx.restore()
  }

  private _drawStar(
    ctx: CanvasRenderingContext2D,
    node: SkillNode,
    pos: Position,
    internal: InternalNodeState,
    alpha: number,
    zoom: number,
    t: number,
  ): void {
    const style = this._resolveStyle(node)
    const { color, glowColor } = this._effectiveColors(node, style, internal === 'selected')
    const phase   = hashPhase(node.id)
    const isSelected = internal === 'selected'
    // Selected nodes twinkle more dramatically
    const twinkleAmp = isSelected ? 0.4 : 0.22
    const twinkle = 1 + twinkleAmp * Math.sin(t * 1.7 + phase)
                      + 0.08 * Math.sin(t * 3.1 + phase * 1.3)
    const glowPulse = style.glowRadius * twinkle
    const size = style.size * (internal === 'hovered' ? 1.4 : 1)

    ctx.save()
    ctx.globalAlpha = style.opacity * alpha

    // Selected: pulsing rings that radiate outward and fade
    if (isSelected) {
      const ringPeriod = 1.8
      for (let i = 0; i < 2; i++) {
        const offset  = i * (ringPeriod / 2)
        const pulse   = ((t + offset) % ringPeriod) / ringPeriod  // 0→1
        const pulseR  = (size + glowPulse * 0.6) * (1 + pulse * 2.2)
        const ringAlpha = (1 - pulse) * 0.6
        ctx.strokeStyle  = glowColor
        ctx.lineWidth    = (1.5 / zoom) * (1 - pulse * 0.5)
        ctx.globalAlpha  = ringAlpha * style.opacity * alpha
        ctx.beginPath()
        ctx.arc(pos.x, pos.y, pulseR, 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.globalAlpha = style.opacity * alpha
    }

    // Glow
    if (glowPulse > 0) {
      const grad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, glowPulse + size)
      grad.addColorStop(0, glowColor + (isSelected ? 'ff' : 'cc'))
      grad.addColorStop(0.4, glowColor + (isSelected ? '88' : '55'))
      grad.addColorStop(1,   glowColor + '00')
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(pos.x, pos.y, glowPulse + size, 0, Math.PI * 2)
      ctx.fill()
    }

    // Body
    ctx.fillStyle = isSelected ? glowColor : color
    ctx.beginPath()
    this._drawShape(ctx, pos, size, style.shape)
    ctx.fill()

    // Label
    if (size * zoom > 4) {
      ctx.fillStyle      = style.labelColor
      ctx.font           = `${style.labelSize / zoom}px ${style.labelFont}`
      ctx.textAlign      = 'center'
      ctx.textBaseline   = 'top'
      ctx.fillText(node.label, pos.x, pos.y + size + 4 / zoom)
    }

    ctx.restore()
  }

  // ─── Proficiency arc ──────────────────────────────────────────────────────

  /**
   * Update proficiency animation state for a node based on its current
   * internal state. Called once per frame per node (from _drawNode).
   */
  private _updateProficiencyAnim(nodeId: string, internal: InternalNodeState): void {
    const now  = performance.now()
    const anim = this._proficiencyAnim.get(nodeId)

    if (internal === 'selected') {
      // Start or resume an appearing animation
      if (!anim || !anim.appearing) {
        this._proficiencyAnim.set(nodeId, { appearing: true, startTime: now })
      }
    } else if (anim) {
      if (anim.appearing) {
        // Node was deselected — reverse: fan stars back to center
        this._proficiencyAnim.set(nodeId, { appearing: false, startTime: now })
      } else if (now - anim.startTime >= STAR_ANIM_TOTAL) {
        // Disappear animation finished — clean up
        this._proficiencyAnim.delete(nodeId)
      }
    }
  }

  /**
   * Per-star animation scales (0→1 for appearing, 1→0 for disappearing).
   * Stars are indexed [0…4] = [leftmost … rightmost] on the arc.
   */
  private _proficiencyStarScales(elapsed: number, appearing: boolean): [number, number, number, number, number] {
    const delays = appearing ? STAR_APPEAR_DELAYS : STAR_DISAPPEAR_DELAYS
    return (delays as readonly number[]).map(delay => {
      const t = Math.max(0, Math.min(1, (elapsed - delay) / STAR_ANIM_DURATION))
      const eased = 1 - Math.pow(1 - t, 3)
      return appearing ? eased : 1 - eased
    }) as [number, number, number, number, number]
  }

  private _drawProficiencyArc(
    ctx: CanvasRenderingContext2D,
    node: SkillNode,
    pos: Position,
    isBubble: boolean,
    alpha: number,
    zoom: number,
    elapsed: number,
    appearing: boolean,
  ): void {
    const style      = this._resolveStyle(node)
    const proficiency = node.proficiency!

    // Crown arc: 135° centered at the top of the node (-π/2 = 12 o'clock)
    const arcSpan    = (135 * Math.PI) / 180
    const arcStart   = -Math.PI / 2 - arcSpan / 2
    const arcRadius  = isBubble ? BUBBLE_WORLD_RADIUS * 1.65 : style.size * 5
    const starSize   = isBubble ? BUBBLE_WORLD_RADIUS * 0.18 : style.size * 1.1

    const scales = this._proficiencyStarScales(elapsed, appearing)

    for (let i = 0; i < 5; i++) {
      const scale = scales[i]!
      if (scale <= 0) continue

      const angle = arcStart + (i / 4) * arcSpan
      const sx    = pos.x + arcRadius * Math.cos(angle)
      const sy    = pos.y + arcRadius * Math.sin(angle)

      // Fill fraction: 1=full, 0.5=half, 0=empty
      const threshold = i + 1
      let fillFraction = 0
      if (proficiency >= threshold) {
        fillFraction = 1
      } else if (proficiency > i) {
        fillFraction = proficiency - i   // e.g. 0.5 for a half-star
      }

      ctx.save()
      ctx.globalAlpha = alpha * scale
      ctx.translate(sx, sy)
      ctx.scale(scale, scale)
      this._drawStarGlyph(ctx, starSize, fillFraction, zoom)
      ctx.restore()
    }
  }

  /**
   * Draw a single proficiency star glyph centred at the current canvas origin.
   * fillFraction: 0 = empty, 0.5 = half-filled, 1 = full.
   */
  private _drawStarGlyph(
    ctx: CanvasRenderingContext2D,
    size: number,
    fillFraction: number,
    zoom: number,
  ): void {
    const filledColor  = '#FFD700'
    const outlineColor = 'rgba(255, 215, 0, 0.35)'

    // Always draw the empty outline — gives context to partial fills
    ctx.strokeStyle = outlineColor
    ctx.lineWidth   = 1.5 / zoom
    ctx.beginPath()
    this._starPath(ctx, 0, 0, size)
    ctx.stroke()

    if (fillFraction <= 0) return

    if (fillFraction >= 1) {
      // Full fill
      ctx.fillStyle = filledColor
      ctx.beginPath()
      this._starPath(ctx, 0, 0, size)
      ctx.fill()
    } else {
      // Partial fill — clip to left portion of the star then fill.
      // The dim outline on the unfilled right half makes the partial nature obvious.
      ctx.save()
      ctx.beginPath()
      ctx.rect(-size - 1, -size - 1, size + 1, (size + 1) * 2)
      ctx.clip()
      ctx.fillStyle = filledColor
      ctx.beginPath()
      this._starPath(ctx, 0, 0, size)
      ctx.fill()
      ctx.restore()
    }
  }

  // ─── Edge particles ───────────────────────────────────────────────────────

  private _renderEdgeParticles(
    ctx: CanvasRenderingContext2D,
    from: Position,
    to: Position,
    edge: SkillEdge,
    t: number,
    zoom: number,
  ): void {
    const dx  = to.x - from.x
    const dy  = to.y - from.y
    const len = Math.sqrt(dx * dx + dy * dy)
    if (len < 1) return

    const particleCount = 3
    const speed         = 0.2   // edge traversals per second
    const particleR     = 2.5 / zoom
    const color         = edge.style?.color ?? this._theme.edge.color

    for (let i = 0; i < particleCount; i++) {
      const progress = ((t * speed + i / particleCount) % 1)
      const x = from.x + dx * progress
      const y = from.y + dy * progress
      const fade = Math.sin(progress * Math.PI)  // fade at both ends

      ctx.save()
      ctx.globalAlpha = fade * 0.85

      const grad = ctx.createRadialGradient(x, y, 0, x, y, particleR * 2.5)
      grad.addColorStop(0, color + 'ff')
      grad.addColorStop(0.4, color + '99')
      grad.addColorStop(1,   color + '00')
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(x, y, particleR * 2.5, 0, Math.PI * 2)
      ctx.fill()

      ctx.restore()
    }
  }

  // ─── Burst animation ──────────────────────────────────────────────────────

  private _renderBurst(): void {
    if (!this._burst) return
    const ctx = this._ctx
    const elapsed = performance.now() - this._burst.startTime
    const t = elapsed / this._burstDuration
    if (t >= 1) { this._burst = null; return }

    const eased = 1 - Math.pow(1 - t, 3)
    const maxR   = Math.hypot(this._canvas.width, this._canvas.height)
    const r      = eased * maxR
    const alpha  = (1 - eased) * 0.35

    ctx.save()
    ctx.globalAlpha = alpha
    ctx.fillStyle   = this._burst.color
    ctx.beginPath()
    ctx.arc(
      this._burst.center.x * this._dpr,
      this._burst.center.y * this._dpr,
      r, 0, Math.PI * 2,
    )
    ctx.fill()
    ctx.restore()
  }

  // ─── Implode animation ────────────────────────────────────────────────────

  private _renderImplode(): void {
    if (!this._implode) return
    const ctx = this._ctx
    const elapsed = performance.now() - this._implode.startTime
    const t = elapsed / this._implodeDuration
    if (t >= 1) { this._implode = null; return }

    // Cubic ease-in: ring starts at full radius and slowly at first,
    // then accelerates sharply as it collapses to center
    const eased     = t * t * t
    const maxR      = Math.hypot(this._canvas.width, this._canvas.height)
    const r         = (1 - eased) * maxR
    const alpha     = (1 - t) * 0.55
    const lineWidth = (1 - eased) * 40 * this._dpr

    const cx = this._implode.center.x * this._dpr
    const cy = this._implode.center.y * this._dpr

    ctx.save()
    ctx.globalAlpha  = alpha
    ctx.strokeStyle  = '#9b5de5'
    ctx.lineWidth    = lineWidth
    ctx.shadowColor  = '#9b5de5'
    ctx.shadowBlur   = 30 * this._dpr
    ctx.beginPath()
    ctx.arc(cx, cy, Math.max(0, r), 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }

  // ─── Color resolution ─────────────────────────────────────────────────────

  /**
   * Resolve effective fill and glow colors for a node, accounting for:
   * 1. Selected state → selectedColor overrides everything
   * 2. Proficiency rating → interpolated gradient or special colors
   * 3. No proficiency / default → falls back to theme style colors
   */
  private _effectiveColors(
    node: SkillNode,
    style: NodeStyle,
    isSelected: boolean,
  ): { color: string; glowColor: string } {
    if (isSelected) {
      const c = this._selectedColor(node)
      return { color: c, glowColor: c }
    }
    const profColor = this._proficiencyNodeColor(node)
    if (profColor) return { color: profColor, glowColor: profColor }
    return { color: style.color, glowColor: style.glowColor }
  }

  /**
   * Selected color interpolated by proficiency: amber (low) → dark red (high).
   * Nodes with no proficiency set always use selectedColor (high end).
   */
  private _selectedColor(node: SkillNode): string {
    if (node.proficiency === undefined) return this._theme.selectedColor
    const t = (Math.min(5, Math.max(0, node.proficiency))) / 5
    return interpolateColor(this._theme.selectedColorLow, this._theme.selectedColor, t)
  }

  /**
   * Returns the proficiency-derived color for a node, or null if the
   * theme's base color should be used unchanged.
   */
  private _proficiencyNodeColor(node: SkillNode): string | null {
    const cfg = this._theme.proficiencyDisplay
    if (node.proficiency === undefined) {
      return cfg.unratedBehavior === 'distinct' ? cfg.unratedColor : null
    }
    if (node.proficiency === 0) return cfg.roadmapColor
    // Clamp to [1, 5] and interpolate
    const t = (Math.min(5, Math.max(1, node.proficiency)) - 1) / 4
    return interpolateColor(cfg.gradient.from, cfg.gradient.to, t)
  }

  // ─── Shapes ───────────────────────────────────────────────────────────────

  private _resolveStyle(node: SkillNode): NodeStyle {
    const base          = this._theme.node
    const stateOverride = node.state ? this._theme.states[node.state] : {}
    const nodeOverride  = node.style ?? {}
    return { ...base, ...stateOverride, ...nodeOverride }
  }

  private _drawShape(
    ctx: CanvasRenderingContext2D,
    pos: Position,
    size: number,
    shape: NodeStyle['shape'],
  ): void {
    switch (shape) {
      case 'circle':
        ctx.arc(pos.x, pos.y, size, 0, Math.PI * 2)
        break
      case 'hexagon':
        this._polygon(ctx, pos, size, 6, Math.PI / 6)
        break
      case 'diamond':
        this._polygon(ctx, pos, size, 4, 0)
        break
      case 'star':
        this._starPath(ctx, pos.x, pos.y, size)
        break
    }
  }

  private _polygon(ctx: CanvasRenderingContext2D, pos: Position, r: number, sides: number, offset: number): void {
    ctx.moveTo(pos.x + r * Math.cos(offset), pos.y + r * Math.sin(offset))
    for (let i = 1; i < sides; i++) {
      const angle = offset + (i * 2 * Math.PI) / sides
      ctx.lineTo(pos.x + r * Math.cos(angle), pos.y + r * Math.sin(angle))
    }
    ctx.closePath()
  }

  /** 5-pointed star path centred at (x, y) with outer radius r. */
  private _starPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
    const inner  = r * 0.4
    const points = 5
    for (let i = 0; i < points * 2; i++) {
      const angle  = (i * Math.PI) / points - Math.PI / 2
      const radius = i % 2 === 0 ? r : inner
      const px = x + radius * Math.cos(angle)
      const py = y + radius * Math.sin(angle)
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
    }
    ctx.closePath()
  }

  private _drawEdge(
    ctx: CanvasRenderingContext2D,
    from: Position,
    to: Position,
    styleOverride?: Partial<EdgeStyle>,
  ): void {
    const style = { ...this._theme.edge, ...styleOverride }
    ctx.save()
    ctx.strokeStyle = style.color
    ctx.lineWidth   = style.width
    ctx.globalAlpha = style.opacity
    if (style.dashPattern) ctx.setLineDash(style.dashPattern)
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x,   to.y)
    ctx.stroke()
    ctx.restore()
  }

  private _resize(): void {
    const rect = this._canvas.getBoundingClientRect()
    const w = Math.floor(rect.width  * this._dpr)
    const h = Math.floor(rect.height * this._dpr)
    if (this._canvas.width !== w || this._canvas.height !== h) {
      this._canvas.width  = w
      this._canvas.height = h
    }
  }

  dispose(): void { /* nothing to clean up */ }
}
