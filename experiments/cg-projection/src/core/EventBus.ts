type Listener<Payload> = (payload: Payload) => void;

/** A synchronous bus whose subscriptions can be removed when a scene exits. */
export class EventBus<Events extends object> {
  private listeners: { [Event in keyof Events]?: Set<Listener<Events[Event]>> } = {};

  on<Event extends keyof Events>(event: Event, listener: Listener<Events[Event]>): () => void {
    const listeners = (this.listeners[event] ??= new Set());
    listeners.add(listener);
    return () => this.off(event, listener);
  }

  off<Event extends keyof Events>(event: Event, listener: Listener<Events[Event]>): void {
    this.listeners[event]?.delete(listener);
  }

  emit<Event extends keyof Events>(event: Event, payload: Events[Event]): void {
    // Copy before dispatch so a handler can safely dispose a scene subscription.
    const listeners = this.listeners[event];
    if (!listeners) return;
    for (const listener of [...listeners]) listener(payload);
  }

  clear(): void {
    this.listeners = {};
  }
}
