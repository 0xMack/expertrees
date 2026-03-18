import { describe, it, expect } from 'vitest'
import { mergeTheme } from '../theme/merge.js'
import { defaultTheme } from '../theme/default.js'

describe('mergeTheme', () => {
  it('returns default theme when no overrides', () => {
    expect(mergeTheme()).toEqual(defaultTheme)
  })

  it('merges background override', () => {
    const theme = mergeTheme({ background: '#000' })
    expect(theme.background).toBe('#000')
    expect(theme.node).toEqual(defaultTheme.node)
  })

  it('merges partial node style', () => {
    const theme = mergeTheme({ node: { color: '#ff0000' } })
    expect(theme.node.color).toBe('#ff0000')
    expect(theme.node.size).toBe(defaultTheme.node.size)
  })

  it('merges partial edge style', () => {
    const theme = mergeTheme({ edge: { width: 3 } })
    expect(theme.edge.width).toBe(3)
    expect(theme.edge.color).toBe(defaultTheme.edge.color)
  })

  it('merges partial state overrides', () => {
    const theme = mergeTheme({ states: { active: { color: '#fff' } } })
    expect(theme.states.active.color).toBe('#fff')
    expect(theme.states.locked).toEqual(defaultTheme.states.locked)
  })

  it('does not mutate the default theme', () => {
    const originalColor = defaultTheme.node.color
    mergeTheme({ node: { color: '#mutated' } })
    expect(defaultTheme.node.color).toBe(originalColor)
  })
})
