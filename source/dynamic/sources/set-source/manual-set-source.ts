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

  get __set () { return this.#set; }
  get size () { return this.#set.size; }

  subscribe<A extends any[]> (onChange: SetSource.Subscriber<T, A>, ...args: A): SetSource.Subscription<T> {
    const subscription = this.#emitter.subscribe(onChange, ...args);
    return new SetSourceSubscription(this, subscription);
  }
  add (value: T): void {
    if (this.#set.has(value)) return;
    this.#set.add(value);
    this.#emitter.signal({ add: new Set([value]), delete: null });
  }
  delete (value: T): boolean {
    if (!this.#set.delete(value)) return false;
    this.#emitter.signal({ add: null, delete: new Set([value]) });
    return true;
  }
  clear (): void {
    if (this.#set.size === 0) return;
    const deletedValues = new Set(this.#set);
    this.#set.clear();
    this.#emitter.signal({ add: null, delete: deletedValues });
  }
  modify (additions?: T[] | null, deletions?: T[] | null): void {
    let actualAdditions: Set<T> | null = null;
    let actualDeletions: Set<T> | null = null;

    // Handle additions
    if (additions) {
      for (let i = 0; i < additions.length; i++) {
        const value = additions[i];
        if (!this.#set.has(value)) {
          this.#set.add(value);
          (actualAdditions ??= new Set()).add(value);
        }
      }
    }

    // Handle deletions
    if (deletions) {
      for (let i = 0; i < deletions.length; i++) {
        const value = deletions[i];
        if (this.#set.delete(value)) {
          (actualDeletions ??= new Set()).add(value);
        }
      }
    }

    if (actualAdditions || actualDeletions) {
      this.#emitter.signal({ add: actualAdditions, delete: actualDeletions });
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
    subscribe (receiver: SetSource.Receiver<T, any[]>): void { this.onDemandChanged.subscribe?.(this.source, receiver); }
    unsubscribe (receiver: SetSource.Receiver<T, any[]>): void { this.onDemandChanged.unsubscribe?.(this.source, receiver); }
  };
}
