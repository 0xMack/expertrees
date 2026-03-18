import { describe, it, expect, vi, beforeEach } from 'vitest'
import { InteractionController } from '../renderer/InteractionController.js'
import type { SkillNode, Position } from '../types/index.js'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width  = 800
  canvas.height = 600
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
    left: 0, top: 0, right: 800, bottom: 600,
    width: 800, height: 600, x: 0, y: 0,
    toJSON: () => ({}),
  })
  // happy-dom does not implement pointer capture — stub it
  ;(canvas as HTMLCanvasElement & { setPointerCapture: () => void }).setPointerCapture = vi.fn()
  return canvas
}

function fire(
  canvas: HTMLCanvasElement,
  type: string,
  x: number,
  y: number,
  pointerId = 1,
  pointerType = 'mouse',
): void {
  canvas.dispatchEvent(new PointerEvent(type, {
    clientX: x, clientY: y, pointerId, pointerType, bubbles: true,
  }))
}

function fireWheel(canvas: HTMLCanvasElement, x: number, y: number, deltaY: number): void {
  canvas.dispatchEvent(new WheelEvent('wheel', {
    clientX: x, clientY: y, deltaY, bubbles: true,
  }))
}

// A leaf node positioned at world (0, 0).
// With initial pan=(400,300) zoom=1, canvas position (400,300) maps to world (0,0).
const CANVAS_CENTER: Position = { x: 400, y: 300 }

const leafNode: SkillNode = { id: 'leaf', label: 'Leaf', depth: 1 }
const bubbleNode: SkillNode = {
  id: 'bubble', label: 'Bubble', depth: 0, childIds: ['leaf'],
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('InteractionController', () => {
  describe('initial state', () => {
    it('starts at zoom 1 with pan at canvas center', () => {
      const ctrl = new InteractionController(makeCanvas())
      expect(ctrl.state.zoom).toBe(1)
      expect(ctrl.state.pan).toEqual({ x: 400, y: 300 })
      expect(ctrl.targetZoom).toBe(1)
      expect(ctrl.zoomAnchor).toBeNull()
    })
  })

  describe('setTargetZoom / tick', () => {
    it('setTargetZoom updates targetZoom immediately', () => {
      const ctrl = new InteractionController(makeCanvas())
      ctrl.setTargetZoom(3)
      expect(ctrl.targetZoom).toBe(3)
    })

    it('tick lerps zoom toward target and returns true', () => {
      const ctrl = new InteractionController(makeCanvas())
      ctrl.setTargetZoom(2)
      const moving = ctrl.tick()
      expect(moving).toBe(true)
      expect(ctrl.state.zoom).toBeGreaterThan(1)
      expect(ctrl.state.zoom).toBeLessThan(2)
    })

    it('tick returns false and clears anchor when settled', () => {
      const ctrl = new InteractionController(makeCanvas())
      ctrl.setTargetZoom(2)
      // Run enough ticks to settle (lerp with alpha=0.14 converges fast)
      for (let i = 0; i < 200; i++) ctrl.tick()
      expect(ctrl.tick()).toBe(false)
      expect(ctrl.zoomAnchor).toBeNull()
    })
  })

  describe('resetToCenter', () => {
    it('snaps zoom and pan immediately', () => {
      const ctrl = new InteractionController(makeCanvas())
      ctrl.resetToCenter(2, 100, 200)
      expect(ctrl.state.zoom).toBe(2)
      expect(ctrl.state.pan).toEqual({ x: 100, y: 200 })
      expect(ctrl.targetZoom).toBe(2)
      expect(ctrl.zoomAnchor).toBeNull()
    })

    it('tick returns false immediately after resetToCenter', () => {
      const ctrl = new InteractionController(makeCanvas())
      ctrl.resetToCenter(1.5, 400, 300)
      expect(ctrl.tick()).toBe(false)
    })
  })

  describe('wheel zoom', () => {
    it('scrolling up increases targetZoom', () => {
      const ctrl = new InteractionController(makeCanvas())
      fireWheel(ctrl['_canvas'], 400, 300, -100)
      expect(ctrl.targetZoom).toBeGreaterThan(1)
    })

    it('scrolling down decreases targetZoom', () => {
      const ctrl = new InteractionController(makeCanvas())
      fireWheel(ctrl['_canvas'], 400, 300, 100)
      expect(ctrl.targetZoom).toBeLessThan(1)
    })

    it('sets zoomAnchor (wheel always anchors to cursor)', () => {
      const ctrl = new InteractionController(makeCanvas())
      // zoomAnchor is null before any wheel event
      expect(ctrl.zoomAnchor).toBeNull()
      fireWheel(ctrl['_canvas'], 200, 150, -100)
      // After wheel, anchor should be set (exact coords depend on the DOM env)
      expect(ctrl.zoomAnchor).not.toBeNull()
    })

    it('emits zoom:change', () => {
      const ctrl = new InteractionController(makeCanvas())
      const listener = vi.fn()
      ctrl.onChange(listener)
      fireWheel(ctrl['_canvas'], 400, 300, -100)
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ type: 'zoom:change' }))
    })
  })

  describe('click detection', () => {
    it('emits node:click when pointer down and up without drag', () => {
      const canvas = makeCanvas()
      const ctrl   = new InteractionController(canvas)
      ctrl.updateNodes([leafNode], new Map([['leaf', { x: 0, y: 0 }]]), 8)

      const listener = vi.fn()
      ctrl.onChange(listener)

      fire(canvas, 'pointerdown', CANVAS_CENTER.x, CANVAS_CENTER.y)
      fire(canvas, 'pointerup',   CANVAS_CENTER.x, CANVAS_CENTER.y)

      expect(listener).toHaveBeenCalledWith({ type: 'node:click', nodeId: 'leaf' })
    })

    it('does not emit node:click when pointer dragged', () => {
      const canvas = makeCanvas()
      const ctrl   = new InteractionController(canvas)
      ctrl.updateNodes([leafNode], new Map([['leaf', { x: 0, y: 0 }]]), 8)

      const listener = vi.fn()
      ctrl.onChange(listener)

      fire(canvas, 'pointerdown', CANVAS_CENTER.x,      CANVAS_CENTER.y)
      fire(canvas, 'pointermove', CANVAS_CENTER.x + 20, CANVAS_CENTER.y)
      fire(canvas, 'pointerup',   CANVAS_CENTER.x + 20, CANVAS_CENTER.y)

      const clicks = listener.mock.calls.filter(([e]) => e.type === 'node:click')
      expect(clicks).toHaveLength(0)
    })

    it('does not emit node:click when clicking empty space', () => {
      const canvas = makeCanvas()
      const ctrl   = new InteractionController(canvas)
      ctrl.updateNodes([leafNode], new Map([['leaf', { x: 0, y: 0 }]]), 8)

      const listener = vi.fn()
      ctrl.onChange(listener)

      // Click far from node
      fire(canvas, 'pointerdown', 10, 10)
      fire(canvas, 'pointerup',   10, 10)

      const clicks = listener.mock.calls.filter(([e]) => e.type === 'node:click')
      expect(clicks).toHaveLength(0)
    })

    it('bubble node uses BUBBLE_WORLD_RADIUS hit area', () => {
      const canvas = makeCanvas()
      const ctrl   = new InteractionController(canvas)
      // Bubble at world (0,0); BUBBLE_WORLD_RADIUS=40, so canvas (435,300) is within ~35px
      ctrl.updateNodes([bubbleNode], new Map([['bubble', { x: 0, y: 0 }]]), 8)

      const listener = vi.fn()
      ctrl.onChange(listener)

      // Click 35 canvas units from center (within BUBBLE_WORLD_RADIUS * 1.3 = 52)
      fire(canvas, 'pointerdown', CANVAS_CENTER.x + 35, CANVAS_CENTER.y)
      fire(canvas, 'pointerup',   CANVAS_CENTER.x + 35, CANVAS_CENTER.y)

      expect(listener).toHaveBeenCalledWith({ type: 'node:click', nodeId: 'bubble' })
    })
  })

  describe('hover (mouse)', () => {
    it('emits node:hover when mouse enters node area', () => {
      const canvas = makeCanvas()
      const ctrl   = new InteractionController(canvas)
      ctrl.updateNodes([leafNode], new Map([['leaf', { x: 0, y: 0 }]]), 8)

      const listener = vi.fn()
      ctrl.onChange(listener)

      fire(canvas, 'pointermove', CANVAS_CENTER.x, CANVAS_CENTER.y, 1, 'mouse')

      expect(listener).toHaveBeenCalledWith({ type: 'node:hover', nodeId: 'leaf' })
    })

    it('emits node:blur when mouse leaves node area', () => {
      const canvas = makeCanvas()
      const ctrl   = new InteractionController(canvas)
      ctrl.updateNodes([leafNode], new Map([['leaf', { x: 0, y: 0 }]]), 8)

      const listener = vi.fn()
      ctrl.onChange(listener)

      fire(canvas, 'pointermove', CANVAS_CENTER.x, CANVAS_CENTER.y, 1, 'mouse')
      fire(canvas, 'pointermove', 10, 10, 1, 'mouse')

      expect(listener).toHaveBeenCalledWith({ type: 'node:blur', nodeId: 'leaf' })
    })

    it('does not emit hover on touch move', () => {
      const canvas = makeCanvas()
      const ctrl   = new InteractionController(canvas)
      ctrl.updateNodes([leafNode], new Map([['leaf', { x: 0, y: 0 }]]), 8)

      const listener = vi.fn()
      ctrl.onChange(listener)

      // Touch down then move — hover should be suppressed
      fire(canvas, 'pointerdown', CANVAS_CENTER.x, CANVAS_CENTER.y, 1, 'touch')
      fire(canvas, 'pointermove', CANVAS_CENTER.x, CANVAS_CENTER.y, 1, 'touch')

      const hovers = listener.mock.calls.filter(([e]) => e.type === 'node:hover')
      expect(hovers).toHaveLength(0)
    })
  })

  describe('pinch zoom (touch)', () => {
    it('two-finger spread increases targetZoom', () => {
      const canvas = makeCanvas()
      const ctrl   = new InteractionController(canvas)

      // First finger at (300, 300), second at (500, 300) — initial distance 200
      fire(canvas, 'pointerdown', 300, 300, 1, 'touch')
      fire(canvas, 'pointerdown', 500, 300, 2, 'touch')

      // Move first finger to establish lastPinchDist=200
      fire(canvas, 'pointermove', 300, 300, 1, 'touch')
      // Spread fingers: second finger to (600, 300) — new distance 300, scale=1.5
      fire(canvas, 'pointermove', 600, 300, 2, 'touch')

      expect(ctrl.targetZoom).toBeCloseTo(1.5, 5)
    })

    it('two-finger pinch decreases targetZoom', () => {
      const canvas = makeCanvas()
      const ctrl   = new InteractionController(canvas)

      fire(canvas, 'pointerdown', 300, 300, 1, 'touch')
      fire(canvas, 'pointerdown', 500, 300, 2, 'touch')
      fire(canvas, 'pointermove', 300, 300, 1, 'touch') // establishes dist=200
      fire(canvas, 'pointermove', 400, 300, 2, 'touch') // dist=100, scale=0.5

      expect(ctrl.targetZoom).toBeCloseTo(0.5, 5)
    })

    it('pinch sets zoomAnchor to midpoint between fingers', () => {
      const canvas = makeCanvas()
      const ctrl   = new InteractionController(canvas)

      fire(canvas, 'pointerdown', 300, 300, 1, 'touch')
      fire(canvas, 'pointerdown', 500, 300, 2, 'touch')
      fire(canvas, 'pointermove', 300, 300, 1, 'touch')
      fire(canvas, 'pointermove', 600, 300, 2, 'touch') // midpoint = (450, 300)

      expect(ctrl.zoomAnchor).toEqual({ x: 450, y: 300 })
    })

    it('emits zoom:change during pinch', () => {
      const canvas = makeCanvas()
      const ctrl   = new InteractionController(canvas)
      const listener = vi.fn()
      ctrl.onChange(listener)

      fire(canvas, 'pointerdown', 300, 300, 1, 'touch')
      fire(canvas, 'pointerdown', 500, 300, 2, 'touch')
      fire(canvas, 'pointermove', 300, 300, 1, 'touch')
      fire(canvas, 'pointermove', 600, 300, 2, 'touch')

      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ type: 'zoom:change' }))
    })

    it('resumes single-pointer pan after second finger lifts', () => {
      const canvas = makeCanvas()
      const ctrl   = new InteractionController(canvas)
      const listener = vi.fn()
      ctrl.onChange(listener)

      fire(canvas, 'pointerdown', 300, 300, 1, 'touch')
      fire(canvas, 'pointerdown', 500, 300, 2, 'touch')
      fire(canvas, 'pointerup',   500, 300, 2, 'touch')  // lift second finger

      // Single finger should pan again
      fire(canvas, 'pointermove', 320, 300, 1, 'touch')

      const panEvents = listener.mock.calls.filter(([e]) => e.type === 'pan:change')
      expect(panEvents.length).toBeGreaterThan(0)
    })

    it('pointercancel clears active pointers', () => {
      const canvas = makeCanvas()
      const ctrl   = new InteractionController(canvas)

      fire(canvas, 'pointerdown', 300, 300, 1, 'touch')
      fire(canvas, 'pointerdown', 500, 300, 2, 'touch')
      fire(canvas, 'pointercancel', 300, 300, 1, 'touch')
      fire(canvas, 'pointercancel', 500, 300, 2, 'touch')

      // After cancel, a fresh single pointer should pan normally
      const listener = vi.fn()
      ctrl.onChange(listener)
      fire(canvas, 'pointerdown', 400, 300, 3, 'touch')
      fire(canvas, 'pointermove', 420, 300, 3, 'touch')
      const panEvents = listener.mock.calls.filter(([e]) => e.type === 'pan:change')
      expect(panEvents.length).toBeGreaterThan(0)
    })
  })

  describe('dispose', () => {
    it('stops emitting events after dispose', () => {
      const canvas = makeCanvas()
      const ctrl   = new InteractionController(canvas)
      const listener = vi.fn()
      ctrl.onChange(listener)
      ctrl.dispose()

      fire(canvas, 'pointerdown', 400, 300)
      fire(canvas, 'pointerup',   400, 300)

      expect(listener).not.toHaveBeenCalled()
    })
  })
})
