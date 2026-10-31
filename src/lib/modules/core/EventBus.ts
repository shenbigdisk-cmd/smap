import type { EventListener, IEventBus } from './types'

/**
 * Lightweight, memory-safe pub/sub event bus for decoupled inter-module messaging.
 */
export class EventBus implements IEventBus {
  private listeners: Map<string, Set<EventListener<any>>> = new Map()

  /**
   * Subscribe to an event. Returns an unregister function for easy cleanup.
   */
  on<T = unknown>(event: string, listener: EventListener<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    const set = this.listeners.get(event)!
    set.add(listener as EventListener<any>)

    return () => {
      this.off(event, listener)
    }
  }

  /**
   * Subscribe to an event exactly once.
   */
  once<T = unknown>(event: string, listener: EventListener<T>): () => void {
    const unsub = this.on<T>(event, (payload) => {
      unsub()
      listener(payload)
    })
    return unsub
  }

  /**
   * Remove a registered event listener.
   */
  off<T = unknown>(event: string, listener: EventListener<T>): void {
    const set = this.listeners.get(event)
    if (set) {
      set.delete(listener as EventListener<any>)
      if (set.size === 0) {
        this.listeners.delete(event)
      }
    }
  }

  /**
   * Emit an event to all registered listeners with error isolation.
   */
  emit<T = unknown>(event: string, payload: T): void {
    const set = this.listeners.get(event)
    if (!set || set.size === 0) return

    for (const listener of Array.from(set)) {
      try {
        const result = listener(payload)
        if (result instanceof Promise) {
          result.catch((err) => {
            console.error(`[EventBus] Unhandled promise rejection in listener for '${event}':`, err)
          })
        }
      } catch (err) {
        console.error(`[EventBus] Error in listener for '${event}':`, err)
      }
    }
  }

  /**
   * Remove all registered listeners across all events.
   */
  clear(): void {
    this.listeners.clear()
  }
}
