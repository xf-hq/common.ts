import { Subscribable } from '../../core/subscribable';
import { ArraySource } from './array-source';
import { ArraySourceTag, createArraySourceSubscription } from './common';

export class ManualArraySource<T> implements ArraySource.Manual<T> {
  constructor (initialArray: T[] = [], onDemandChanged?: ArraySource.Manual.DemandObserver<T>) {
    this.#array = initialArray;
    this.#emitter = onDemandChanged
      ? new Subscribable.Controller<[event: ArraySource.Event<T>]>(new ManualArraySource.DemandObserverAdapter(this, onDemandChanged))
      : new Subscribable.Controller<[event: ArraySource.Event<T>]>();
  }
  readonly #emitter: Subscribable.Controller<[event: ArraySource.Event<T>]>;
  readonly #array: T[];

  get [ArraySourceTag] () { return true as const; }

  /** @internal */
  get __array () { return this.#array; }

  get length () { return this.#array.length; }

  subscribe<A extends any[]> (subscriber: Subscribable.Subscriber<[event: ArraySource.Event<T>], A>, ...args: A): ArraySource.Subscription<T> {
    return createArraySourceSubscription(this, this.#emitter, subscriber, args);
  }

  #batchDepth = 0;
  #bufferedEvents: ArraySource.Event<T>[] | undefined;
  private pushEvent (event: ArraySource.Event<T>) {
    if (this.#batchDepth > 0) {
      this.#bufferedEvents!.push(event);
    }
    else {
      this.#emitter.event(event);
    }
  }

  push (...values: T[]): void {
    if (values.length === 0) return;
    this.#array.push(...values);
    this.pushEvent({ kind: 'push', values });
  }
  pop (): T | undefined {
    if (this.#array.length === 0) return;
    const value = this.#array.pop()!;
    this.pushEvent({ kind: 'pop' });
    return value;
  }
  unshift (...values: T[]): void {
    if (values.length === 0) return;
    this.#array.unshift(...values);
    this.pushEvent({ kind: 'unshift', values });
  }
  shift (): T | undefined {
    if (this.#array.length === 0) return;
    const value = this.#array.shift()!;
    this.pushEvent({ kind: 'shift' });
    return value;
  }
  splice (index: number, deletions: number, ...insertions: T[]): void {
    if (deletions === 0 && insertions.length === 0) return;
    this.#array.splice(index, deletions, ...insertions);
    this.pushEvent({ kind: 'splice', index, deletions, insertions });
  }
  set (index: number, value: T): void {
    this.#array[index] = value;
    this.pushEvent({ kind: 'set', index, value });
  }
  batch (callback: (source: ArraySource.Manual<T>) => void): void {
    if (++this.#batchDepth === 1) {
      this.#bufferedEvents = [];
    }
    callback(this);
    if (--this.#batchDepth === 0) {
      const events = this.#bufferedEvents!;
      this.#bufferedEvents = undefined;
      switch (events.length) {
        case 0: break;
        case 1: this.#emitter.event(events[0]); break;
        default: this.#emitter.event({ kind: 'batch', events });
      }
    }
  }
  clear (): void {
    this.splice(0, this.length);
  }

  static DemandObserverAdapter = class DemandObserverAdapter<T> implements Subscribable.DemandObserver.ListenerInterface<[event: ArraySource.Event<T>]> {
    constructor (
      private readonly source: ManualArraySource<T>,
      private readonly onDemandChanged: ArraySource.Manual.DemandObserver<T>
    ) {}
    online (): void { this.onDemandChanged.online?.(this.source); }
    offline (): void { this.onDemandChanged.offline?.(this.source); }
    subscribe (receiver: ArraySource.Receiver<T, any[]>): void { this.onDemandChanged.subscribe?.(this.source, receiver); }
    unsubscribe (receiver: ArraySource.Receiver<T, any[]>): void { this.onDemandChanged.unsubscribe?.(this.source, receiver); }
  };
}
