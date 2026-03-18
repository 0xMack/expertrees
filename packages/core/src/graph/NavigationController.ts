import type { NavigationFrame } from '../types/index.js'

export class NavigationController {
  private _stack: NavigationFrame[]
  private _listeners: Set<(stack: readonly NavigationFrame[]) => void> = new Set()

  constructor(root: NavigationFrame = { nodeId: null, label: 'Root' }) {
    this._stack = [root]
  }

  get current(): NavigationFrame {
    return this._stack[this._stack.length - 1]!
  }

  get stack(): readonly NavigationFrame[] {
    return this._stack
  }

  get canGoBack(): boolean {
    return this._stack.length > 1
  }

  push(frame: NavigationFrame): void {
    this._stack.push(frame)
    this._notify()
  }

  pop(): NavigationFrame | undefined {
    if (!this.canGoBack) return undefined
    const popped = this._stack.pop()
    this._notify()
    return popped
  }

  reset(): void {
    this._stack = [this._stack[0]!]
    this._notify()
  }

  onChange(listener: (stack: readonly NavigationFrame[]) => void): () => void {
    this._listeners.add(listener)
    return () => this._listeners.delete(listener)
  }

  private _notify(): void {
    for (const l of this._listeners) l(this._stack)
  }
}
