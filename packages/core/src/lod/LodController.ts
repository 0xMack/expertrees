import type { LodThreshold } from '../types/index.js'

const DEFAULT_THRESHOLDS: LodThreshold[] = [
  { depth: 0, minZoom: 0,    maxZoom: 0.3  },
  { depth: 1, minZoom: 0.3,  maxZoom: 0.6  },
  { depth: 2, minZoom: 0.6,  maxZoom: 1.2  },
  { depth: 3, minZoom: 1.2,  maxZoom: 2.5  },
  { depth: 4, minZoom: 2.5,  maxZoom: Infinity },
]

export class LodController {
  private _thresholds: LodThreshold[]
  private _zoom: number = 1
  private _listeners: Set<(zoom: number) => void> = new Set()

  constructor(thresholds?: LodThreshold[]) {
    this._thresholds = thresholds ?? DEFAULT_THRESHOLDS
  }

  get zoom() { return this._zoom }

  get thresholds(): readonly LodThreshold[] { return this._thresholds }

  setZoom(zoom: number): void {
    this._zoom = Math.max(0.01, zoom)
    this._notify()
  }

  onChange(listener: (zoom: number) => void): () => void {
    this._listeners.add(listener)
    return () => this._listeners.delete(listener)
  }

  private _notify(): void {
    for (const listener of this._listeners) listener(this._zoom)
  }
}
