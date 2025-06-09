import { dispose } from '../../../general/disposables';
import { throwError } from '../../../general/errors';
import { bindMethod } from '../../../general/functional';
import { Subscribable } from '../../core/subscribable';
import { MapSourceSubscription, MapSourceTag } from './common';
import { MapSource } from './map-source';

export class MappedMapSource<K, VA, VB> implements MapSource.Immediate<K, VB>, Subscribable.Receiver<[event: MapSource.Event<K, VA>]> {
  constructor (f: (a: VA) => VB, source: MapSource<K, VA>) {
    this.#f = f;
    this.#source = source;
  }
  readonly #f: (a: VA) => VB;
  readonly #source: MapSource<K, VA>;
  readonly #emitter = new Subscribable.Controller<[event: MapSource.Event<K, VB>]>(bindMethod(this.onDemandChange, this));
  #upstreamSubscription: MapSource.Subscription<K, VA> | undefined;
  #mappedMap: Map<K, VB> | undefined;

  get [MapSourceTag] () { return true as const; }

  /** @internal */
  get __map () { return this.#mappedMap ??= throwError('Internal map not initialized.'); }
  get size () { return this.__map.size; }

  subscribe<A extends any[]> (onChange: Subscribable.Subscriber<[event: MapSource.Event<K, VB>], A>, ...args: A): MapSource.Subscription<K, VB> {
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
    this.#mappedMap = new Map(
      Array.from(this.#upstreamSubscription.__map.entries())
        .map(([k, v]) => [k, this.mapValue(v)])
    );
  }

  offline () {
    dispose(this.#upstreamSubscription!);
    this.#upstreamSubscription = undefined;
    this.#mappedMap = undefined;
  }
  signal (event: MapSource.Event<K, VA>): void {
    const map = this.#mappedMap!;
    
    let mappedAdditions: Map<K, VB> | null = null;
    let mappedChanges: Map<K, VB> | null = null;
    let mappedDeletions: K[] | null = null;

    // Handle additions
    if (event.add) {
      for (const [key, value] of event.add) {
        const mappedValue = this.mapValue(value);
        map.set(key, mappedValue);
        (mappedAdditions ??= new Map()).set(key, mappedValue);
      }
    }

    // Handle changes
    if (event.change) {
      for (const [key, value] of event.change) {
        const mappedValue = this.mapValue(value);
        map.set(key, mappedValue);
        (mappedChanges ??= new Map()).set(key, mappedValue);
      }
    }

    // Handle deletions
    if (event.delete) {
      for (const key of event.delete) {
        map.delete(key);
        (mappedDeletions ??= []).push(key);
      }
    }

    // Emit mapped event if any changes occurred
    if (mappedAdditions || mappedChanges || mappedDeletions) {
      this.#emitter.signal({
        add: mappedAdditions,
        change: mappedChanges,
        delete: mappedDeletions,
      });
    }
  }

  mapValue (value: VA): VB {
    return this.#f(value);
  }
}
