import { dispose } from '../../../general/disposables';
import { bindMethod } from '../../../general/functional';
import { Subscribable } from '../../core/subscribable';
import type { ArraySource } from '../array/array-source';
import { MapSourceSubscription, MapSourceTag } from './common';
import { MapSource } from './map-source';

export class MapSourceFromEntries<K, V> implements MapSource<K, V>, Subscribable.Receiver<[event: ArraySource.Event<readonly [K, V]>]> {
  constructor (source: ArraySource<readonly [K, V]>) {
    this.#source = source;
  }
  readonly #source: ArraySource<readonly [K, V]>;
  readonly #emitter = new Subscribable.Controller<[event: MapSource.Event<K, V>]>(bindMethod(this.onDemandChange, this));
  #upstreamSubscription: ArraySource.Subscription<readonly [K, V]> | undefined;
  #map: Map<K, V> | undefined;

  get [MapSourceTag] () { return true as const; }

  get __map () { return this.#map; }

  subscribe<A extends any[]> (onChange: Subscribable.Subscriber<[event: MapSource.Event<K, V>], A>, ...args: A): MapSource.Subscription<K, V> {
    const subscription = this.#emitter.subscribe(onChange, ...args);
    return new MapSourceSubscription(this, subscription);
  }

  onDemandChange (event: Subscribable.DemandObserver.Event): void {
    switch (event) {
      case 'online': this.online(); break;
      case 'offline': this.offline(); break;
    }
  }

  online () {
    this.#upstreamSubscription = this.#source.subscribe(this);
    this.#map = new Map(this.#upstreamSubscription.__array);
  }

  offline () {
    dispose(this.#upstreamSubscription!);
    this.#upstreamSubscription = undefined;
    this.#map = undefined;
  }
  event (event: ArraySource.Event<readonly [K, V]>): void {
    const map = this.#map!;
    
    let mapAdditions: Map<K, V> | null = null;
    let mapChanges: Map<K, V> | null = null;
    let mapDeletions: K[] | null = null;

    switch (event.kind) {
      case 'push': {
        for (const [key, value] of event.values) {
          const wasExisting = map.has(key);
          map.set(key, value);
          if (wasExisting) {
            (mapChanges ??= new Map()).set(key, value);
          }
          else {
            (mapAdditions ??= new Map()).set(key, value);
          }
        }
        break;
      }
      case 'splice': {
        const { index, deletions, insertions } = event;
        for (let i = 0; i < deletions; i++) {
          const [key, value] = this.#upstreamSubscription!.__array[index + i];
          map.delete(key);
          (mapDeletions ??= []).push(key);
        }
        for (const [key, value] of insertions) {
          const wasExisting = map.has(key);
          map.set(key, value);
          if (wasExisting) {
            (mapChanges ??= new Map()).set(key, value);
          }
          else {
            (mapAdditions ??= new Map()).set(key, value);
          }
        }
        break;
      }
      case 'set': {
        const { index, value: [key, value] } = event;
        const wasExisting = map.has(key);
        map.set(key, value);
        if (wasExisting) {
          (mapChanges ??= new Map()).set(key, value);
        }
        else {
          (mapAdditions ??= new Map()).set(key, value);
        }
        break;
      }
      case 'pop': {
        const [key, value] = this.#upstreamSubscription!.__array[this.#upstreamSubscription!.__array.length - 1];
        map.delete(key);
        (mapDeletions ??= []).push(key);
        break;
      }
      case 'shift': {
        const [key, value] = this.#upstreamSubscription!.__array[0];
        map.delete(key);
        (mapDeletions ??= []).push(key);
        break;
      }
      case 'unshift': {
        for (const [key, value] of event.values) {
          const wasExisting = map.has(key);
          map.set(key, value);
          if (wasExisting) {
            (mapChanges ??= new Map()).set(key, value);
          }
          else {
            (mapAdditions ??= new Map()).set(key, value);
          }
        }
        break;
      }
      case 'batch': {
        for (const batchEvent of event.events) {
          this.event(batchEvent);
        }
        break;
      }
    }
    // Emit map event if any changes occurred
    if (mapAdditions || mapChanges || mapDeletions) {
      this.#emitter.event({
        add: mapAdditions,
        change: mapChanges,
        delete: mapDeletions,
      });
    }
  }
}
