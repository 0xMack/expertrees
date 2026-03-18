import { describe, it, expect, vi } from 'vitest'
import { LodController } from '../lod/LodController.js'

describe('LodController', () => {
  it('starts with default zoom of 1', () => {
    const lod = new LodController()
    expect(lod.zoom).toBe(1)
  })

  it('tracks zoom level', () => {
    const lod = new LodController([
      { depth: 0, minZoom: 0,   maxZoom: 0.3 },
      { depth: 1, minZoom: 0.3, maxZoom: 0.6 },
      { depth: 2, minZoom: 0.6, maxZoom: 1.2 },
      { depth: 3, minZoom: 1.2, maxZoom: Infinity },
    ])

    lod.setZoom(0.4)
    expect(lod.zoom).toBe(0.4)

    lod.setZoom(0.8)
    expect(lod.zoom).toBe(0.8)
  })

  it('emits onChange on every setZoom call', () => {
    const lod = new LodController([
      { depth: 0, minZoom: 0,   maxZoom: 0.5 },
      { depth: 1, minZoom: 0.5, maxZoom: Infinity },
    ])
    const listener = vi.fn()
    lod.onChange(listener)
    lod.setZoom(0.8)
    expect(listener).toHaveBeenCalledWith(0.8)
  })

  it('clamps zoom to minimum', () => {
    const lod = new LodController()
    lod.setZoom(-5)
    expect(lod.zoom).toBeGreaterThan(0)
  })

  it('exposes thresholds', () => {
    const thresholds = [
      { depth: 0, minZoom: 0,   maxZoom: 0.5 },
      { depth: 1, minZoom: 0.5, maxZoom: Infinity },
    ]
    const lod = new LodController(thresholds)
    expect(lod.thresholds).toHaveLength(2)
  })

  it('unsubscribes correctly', () => {
    const lod = new LodController()
    const listener = vi.fn()
    const unsub = lod.onChange(listener)
    unsub()
    lod.setZoom(0.9)
    expect(listener).not.toHaveBeenCalled()
  })
})
