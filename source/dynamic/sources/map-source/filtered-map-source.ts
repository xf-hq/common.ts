import { dispose } from '../../../general/disposables';
import { throwError } from '../../../general/errors';
import { bindMethod } from '../../../general/functional';
import { Subscribable } from '../../core/subscribable';
import { MapSourceSubscription, MapSourceTag } from './common';
import { MapSource } from './map-source';

export class FilteredMapSource<K, V> implements MapSource.Immediate<K, V>, Subscribable.Receiver<[event: MapSource.Event<K, V>]> {
  constructor (f: (value: V, key: K) => boolean, source: MapSource<K, V>) {
    this.#f = f;
    this.#source = source;
  }
  readonly #f: (value: V, key: K) => boolean;
  readonly #source: MapSource<K, V>;
  readonly #emitter = new Subscribable.Controller<[event: MapSource.Event<K, V>]>(bindMethod(this.onDemandChange, this));
  #upstreamSubscription: MapSource.Subscription<K, V> | undefined;
  #filteredMap: Map<K, V> | undefined;

  get [MapSourceTag] () { return true as const; }

  /** @internal */
  get __map () { return this.#filteredMap ??= throwError('Internal map not initialized.'); }
  get size () { return this.__map.size; }

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
    this.#filteredMap = new Map(
      Array.from(this.#upstreamSubscription.__map.entries())
        .filter(([k, v]) => this.testValue(v, k))
    );
  }

  offline () {
    dispose(this.#upstreamSubscription!);
    this.#upstreamSubscription = undefined;
    this.#filteredMap = undefined;
  }
  event (event: MapSource.Event<K, V>): void {
    const map = this.#filteredMap!;
    
    let filteredAdditions: Map<K, V> | null = null;
    let filteredChanges: Map<K, V> | null = null;
    let filteredDeletions: K[] | null = null;

    // Handle additions
    if (event.add) {
      for (const [key, value] of event.add) {
        if (this.testValue(value, key)) {
          map.set(key, value);
          (filteredAdditions ??= new Map()).set(key, value);
        }
      }
    }

    // Handle changes
    if (event.change) {
      for (const [key, value] of event.change) {
        const passes = this.testValue(value, key);
        const wasPresent = map.has(key);
        
        if (passes) {
          map.set(key, value);
          if (wasPresent) {
            (filteredChanges ??= new Map()).set(key, value);
          }
          else {
            (filteredAdditions ??= new Map()).set(key, value);
          }
        }
        else if (wasPresent) {
          map.delete(key);
          (filteredDeletions ??= []).push(key);
        }
      }
    }

    // Handle deletions
    if (event.delete) {
      for (const key of event.delete) {
        if (map.has(key)) {
          map.delete(key);
          (filteredDeletions ??= []).push(key);
        }
      }
    }

    // Emit filtered event if any changes occurred
    if (filteredAdditions || filteredChanges || filteredDeletions) {
      this.#emitter.event({
        add: filteredAdditions,
        change: filteredChanges,
        delete: filteredDeletions,
      });
    }
  }

  testValue (value: V, key: K): boolean {
    return this.#f(value, key);
  }
}
