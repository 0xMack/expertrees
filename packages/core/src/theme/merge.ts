import type { Theme, ThemeInput } from '../types/index.js'
import { defaultTheme } from './default.js'

export function mergeTheme(overrides?: ThemeInput): Theme {
  if (!overrides) return defaultTheme

  return {
    background: overrides.background ?? defaultTheme.background,
    node: { ...defaultTheme.node, ...overrides.node },
    edge: { ...defaultTheme.edge, ...overrides.edge },
    states: {
      default: { ...defaultTheme.states.default, ...overrides.states?.['default'] },
      active: { ...defaultTheme.states.active, ...overrides.states?.active },
      locked: { ...defaultTheme.states.locked, ...overrides.states?.locked },
      unlocked: { ...defaultTheme.states.unlocked, ...overrides.states?.unlocked },
      highlighted: { ...defaultTheme.states.highlighted, ...overrides.states?.highlighted },
    },
    selectedColor:    overrides.selectedColor    ?? defaultTheme.selectedColor,
    selectedColorLow: overrides.selectedColorLow ?? defaultTheme.selectedColorLow,
    proficiencyDisplay: {
      ...defaultTheme.proficiencyDisplay,
      ...overrides.proficiencyDisplay,
      gradient: {
        ...defaultTheme.proficiencyDisplay.gradient,
        ...overrides.proficiencyDisplay?.gradient,
      },
    },
  }
}
