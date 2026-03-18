import type { Theme } from '../types/index.js'

export const defaultTheme: Theme = {
  background: '#050a1a',
  node: {
    color: '#4a9eff',
    glowColor: '#4a9eff',
    glowRadius: 12,
    size: 8,
    shape: 'circle',
    opacity: 1,
    labelColor: '#c8d8f0',
    labelSize: 12,
    labelFont: 'system-ui, sans-serif',
  },
  edge: {
    color: '#1e3a5f',
    width: 1.5,
    opacity: 0.6,
    animated: false,
  },
  states: {
    default: {},
    active: {
      color: '#7fcdff',
      glowColor: '#7fcdff',
      glowRadius: 20,
    },
    locked: {
      color: '#2a3a4a',
      glowColor: '#2a3a4a',
      glowRadius: 4,
      opacity: 0.5,
      labelColor: '#4a5a6a',
    },
    unlocked: {
      color: '#50fa7b',
      glowColor: '#50fa7b',
      glowRadius: 16,
    },
    highlighted: {
      color: '#ffb86c',
      glowColor: '#ffb86c',
      glowRadius: 24,
    },
  },
}
