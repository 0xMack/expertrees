import { describe, it, expect, vi } from 'vitest'
import { NavigationController } from '../graph/NavigationController.js'

describe('NavigationController', () => {
  it('initialises with a single root frame', () => {
    const nav = new NavigationController({ nodeId: null, label: 'Root' })
    expect(nav.stack).toHaveLength(1)
    expect(nav.current.nodeId).toBeNull()
    expect(nav.current.label).toBe('Root')
  })

  it('canGoBack is false at root', () => {
    const nav = new NavigationController()
    expect(nav.canGoBack).toBe(false)
  })

  it('push grows the stack and updates current', () => {
    const nav = new NavigationController()
    nav.push({ nodeId: 'bubble-a', label: 'Bubble A' })
    expect(nav.stack).toHaveLength(2)
    expect(nav.current.nodeId).toBe('bubble-a')
    expect(nav.canGoBack).toBe(true)
  })

  it('pop shrinks the stack and returns the popped frame', () => {
    const nav = new NavigationController()
    nav.push({ nodeId: 'bubble-a', label: 'Bubble A' })
    nav.push({ nodeId: 'bubble-b', label: 'Bubble B' })
    const popped = nav.pop()
    expect(popped?.nodeId).toBe('bubble-b')
    expect(nav.stack).toHaveLength(2)
    expect(nav.current.nodeId).toBe('bubble-a')
  })

  it('pop at root returns undefined and leaves stack unchanged', () => {
    const nav = new NavigationController()
    const result = nav.pop()
    expect(result).toBeUndefined()
    expect(nav.stack).toHaveLength(1)
  })

  it('reset returns to root', () => {
    const nav = new NavigationController()
    nav.push({ nodeId: 'a', label: 'A' })
    nav.push({ nodeId: 'b', label: 'B' })
    nav.reset()
    expect(nav.stack).toHaveLength(1)
    expect(nav.current.nodeId).toBeNull()
    expect(nav.canGoBack).toBe(false)
  })

  it('onChange fires on push', () => {
    const nav = new NavigationController()
    const listener = vi.fn()
    nav.onChange(listener)
    nav.push({ nodeId: 'x', label: 'X' })
    expect(listener).toHaveBeenCalledOnce()
    expect(listener).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ nodeId: 'x' }),
    ]))
  })

  it('onChange fires on pop', () => {
    const nav = new NavigationController()
    nav.push({ nodeId: 'x', label: 'X' })
    const listener = vi.fn()
    nav.onChange(listener)
    nav.pop()
    expect(listener).toHaveBeenCalledOnce()
  })

  it('onChange fires on reset', () => {
    const nav = new NavigationController()
    nav.push({ nodeId: 'x', label: 'X' })
    const listener = vi.fn()
    nav.onChange(listener)
    nav.reset()
    expect(listener).toHaveBeenCalledOnce()
  })

  it('onChange does not fire on failed pop', () => {
    const nav = new NavigationController()
    const listener = vi.fn()
    nav.onChange(listener)
    nav.pop() // already at root — no-op
    expect(listener).not.toHaveBeenCalled()
  })

  it('unsubscribes correctly', () => {
    const nav = new NavigationController()
    const listener = vi.fn()
    const unsub = nav.onChange(listener)
    unsub()
    nav.push({ nodeId: 'x', label: 'X' })
    expect(listener).not.toHaveBeenCalled()
  })

  it('stack reference reflects the current navigation depth', () => {
    const nav = new NavigationController()
    nav.push({ nodeId: 'a', label: 'A' })
    nav.push({ nodeId: 'b', label: 'B' })
    expect(nav.stack).toHaveLength(3)
    nav.pop()
    expect(nav.stack).toHaveLength(2)
  })
})
