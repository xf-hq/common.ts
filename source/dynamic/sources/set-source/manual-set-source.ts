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
    this.#set.add(value);
    this.#emitter.signal({ kind: 'add', value });
  }
  delete (value: T): boolean {
    if (!this.#set.delete(value)) return false;
    this.#emitter.signal({ kind: 'delete', value });
    return true;
  }
  clear (): void {
    const previousSize = this.#set.size;
    if (previousSize === 0) return;
    this.#set.clear();
    this.#emitter.signal({ kind: 'clear', previousSize });
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
