import { Subscribable } from '../../core/subscribable';
import { SetSourceSubscription, SetSourceTag } from './common';
import type { SetSource } from './set-source';

export class ManualSetSource<T> implements SetSource.Manual<T> {
  constructor (initialSet: Set<T>, onDemandChanged?: SetSource.Manual.DemandObserver<T>) {
    this.#set = initialSet;
    this.#emitter = onDemandChanged
      ? new Subscribable.Controller<[event: SetSource.Event<T>]>(new ManualSetSource.DemandObserverAdapter(this, onDemandChanged))
      : new Subscribable.Controller<[event: SetSource.Event<T>]>();
  }
  readonly #emitter: Subscribable.Controller<[event: SetSource.Event<T>]>;
  readonly #set: Set<T>;

  get [SetSourceTag] () { return true as const; }

  get __emitter () { return this.#emitter; }
  get __set () { return this.#set; }
  get size () { return this.#set.size; }

  subscribe<A extends any[]> (onChange: SetSource.Subscriber<T, A>, ...args: A): SetSource.Subscription<T> {
    const subscription = this.#emitter.subscribe(onChange, ...args);
    return new SetSourceSubscription(this, subscription);
  }

  hold (): void {
    this.#emitter.hold();
  }
  release (): void {
    this.#emitter.release();
  }

  add (value: T): void {
    if (this.#set.has(value)) return;
    this.#set.add(value);
    this.#emitter.event({ add: [value], delete: null });
  }
  delete (value: T): boolean {
    if (!this.#set.delete(value)) return false;
    this.#emitter.event({ add: null, delete: [value] });
    return true;
  }
  clear (): void {
    if (this.#set.size === 0) return;
    const allValues = Array.from(this.#set);
    this.modify([], allValues);
  }
  modify (additions: ReadonlyArray<T>, deletions: ReadonlyArray<T>): void {
    let actualAdditions: T[] | null = null;
    let actualDeletions: T[] | null = null;

    // Process deletions first
    for (const value of deletions) {
      if (this.#set.delete(value)) {
        (actualDeletions ??= []).push(value);
      }
    }

    // Process additions
    for (const value of additions) {
      if (!this.#set.has(value)) {
        this.#set.add(value);
        (actualAdditions ??= []).push(value);
      }
    }

    // Emit event only if there were actual changes
    if (actualAdditions || actualDeletions) {
      this.#emitter.event({ add: actualAdditions, delete: actualDeletions });
    }
  }

  has (value: T): boolean {
    return this.#set.has(value);
  }
  values (): Iterable<T> {
    return this.#set.values();
  }

  static DemandObserverAdapter = class DemandObserverAdapter<T> implements Subscribable.DemandObserver.ListenerInterface<[event: SetSource.Event<T>]> {
    constructor (
      private readonly source: ManualSetSource<T>,
      private readonly onDemandChanged: SetSource.Manual.DemandObserver<T>
    ) {}
    online (): void { this.onDemandChanged.online?.(this.source); }
    offline (): void { this.onDemandChanged.offline?.(this.source); }
    onSubscribe (receiver: SetSource.Receiver<T, any[]>): void { this.onDemandChanged.subscribe?.(this.source, receiver); }
    onUnsubscribe (receiver: SetSource.Receiver<T, any[]>): void { this.onDemandChanged.unsubscribe?.(this.source, receiver); }
  };
}
