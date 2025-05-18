import { dispose } from '../../../general/disposables';
import { bindMethod } from '../../../general/functional';
import { Subscribable } from '../../core/subscribable';
import type { MapSource } from '../map-source/map-source';
import { ArraySource } from './array-source';
import { ArraySourceSubscription, ArraySourceTag } from './common';

export class MapSourceEntriesArraySource<K, V> implements ArraySource<[K, V]>, Subscribable.Receiver<[event: MapSource.Event<K, V>]> {
  constructor (source: MapSource<K, V>) {
    this.#source = source;
  }
  readonly #source: MapSource<K, V>;
  readonly #emitter = new Subscribable.Controller<[event: ArraySource.Event<[K, V]>]>(bindMethod(this.onDemandChange, this));
  #upstreamSubscription: MapSource.Subscription<K, V> | undefined;
  #array: [K, V][] | undefined;

    get [ArraySourceTag] () { return true as const; }

  /** @internal */
  get __array () { return this.#array; }

  subscribe<A extends any[]> (subscriber: Subscribable.Subscriber<[event: ArraySource.Event<[K, V]>], A>, ...args: A): ArraySource.Subscription<[K, V]> {
    const subscription = this.#emitter.subscribe(subscriber, ...args);
    return new ArraySourceSubscription(this, subscription);
  }

  onDemandChange (event: Subscribable.DemandObserver.Event): void {
    switch (event) {
      case 'online': this.online(); break;
      case 'offline': this.offline(); break;
    }
  }

  online () {
    this.#upstreamSubscription = this.#source.subscribe(this);
    this.#array = Array.from(this.#upstreamSubscription.__map.entries());
  }

  offline () {
    dispose(this.#upstreamSubscription!);
    this.#upstreamSubscription = undefined;
    this.#array = undefined;
  }

  signal (event: MapSource.Event<K, V>): void {
    const array = this.#array!;
    switch (event.kind) {
      case 'set': {
        const index = array.findIndex(([key]) => key === event.key);
        if (index !== -1) {
          array[index] = [event.key, event.value];
          this.#emitter.signal({ kind: 'set', index, value: [event.key, event.value] });
        }
        else {
          array.push([event.key, event.value]);
          this.#emitter.signal({ kind: 'push', values: [[event.key, event.value]] });
        }
        break;
      }
      case 'delete': {
        const index = array.findIndex(([key]) => key === event.key);
        if (index !== -1) {
          array.splice(index, 1);
          this.#emitter.signal({ kind: 'splice', index, deletions: 1, insertions: [] });
        }
        break;
      }
      case 'clear': {
        const previousSize = array.length;
        array.length = 0;
        this.#emitter.signal({ kind: 'splice', index: 0, deletions: previousSize, insertions: [] });
        break;
      }
    }
  }
}
