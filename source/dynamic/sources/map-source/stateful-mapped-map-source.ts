import { isDefined } from '../../../general/type-checking';
import { dispose } from '../../../general/disposables';
import { throwError } from '../../../general/errors';
import { bindMethod } from '../../../general/functional';
import { Subscribable } from '../../core/subscribable';
import { MapSourceSubscription, MapSourceTag } from './common';
import { MapSource } from './map-source';

export class StatefulMappedMapSource<K, VA, VB, S, C> implements MapSource.Immediate<K, VB>, Subscribable.Receiver<[event: MapSource.Event<K, VA>]> {
  constructor (mapper: MapSource.StatefulMapper<K, VA, VB, S, C>, source: MapSource<K, VA>) {
    this.#mapper = mapper;
    this.#source = source;
  }
  readonly #mapper: MapSource.StatefulMapper<K, VA, VB, S, C>;
  readonly #source: MapSource<K, VA>;
  readonly #emitter = new Subscribable.Controller<[event: MapSource.Event<K, VB>]>(bindMethod(this.onDemandChange, this));
  #upstreamSubscription: MapSource.Subscription<K, VA> | undefined;
  #states: Map<K, S> | undefined;
  #commonState: C | undefined;
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
    const mapper = this.#mapper;
    const itemStates: Map<K, S> = this.#states = new Map();
    const mappedMap: Map<K, VB> = this.#mappedMap = new Map();
    if (mapper.shared) {
      this.#commonState = mapper.shared.init(Array.from(itemStates.values()));
    }
    this.#upstreamSubscription = this.#source.subscribe(this);
    const sourceMap = this.#upstreamSubscription.__map;
    for (const [key, value] of sourceMap) {
      const state = mapper.item.init(value, key, this.#commonState!);
      itemStates.set(key, state);
      mappedMap.set(key, mapper.item.map(state, this.#commonState!));
    }
  }

  offline () {
    for (const state of this.#states!.values()) {
      this.#mapper.item.dispose(state, this.#commonState!);
    }
    if (this.#mapper.shared) {
      this.#mapper.shared.dispose(this.#commonState!);
    }
    dispose(this.#upstreamSubscription!);
    this.#upstreamSubscription = undefined;
    this.#states = undefined;
    this.#commonState = undefined;
    this.#mappedMap = undefined;
  }

  event (event: MapSource.Event<K, VA>): void {
    const mappedEvent = this.applyEvent(event);
    this.#emitter.event(mappedEvent);
    if (this.#disposalQueue.length === 0) return;
    const disposalQueue = [...this.#disposalQueue];
    this.#disposalQueue.length = 0;
    for (const state of disposalQueue) {
      this.#mapper.item.dispose(state, this.#commonState!);
    }
  }
  readonly #disposalQueue: S[] = [];
  private applyEvent (event: MapSource.Event<K, VA>): MapSource.Event<K, VB> {
    const states = this.#states!;
    const map = this.#mappedMap!;
    const mapper = this.#mapper;
    const commonState = this.#commonState!;
    const itemHandler = mapper.item;

    let mappedAdditions: Map<K, VB> | null = null;
    let mappedChanges: Map<K, VB> | null = null;
    let mappedDeletions: K[] | null = null;

    // Handle additions
    if (event.add) {
      const addEntries = Array.from(event.add.entries());
      if (mapper.event?.add) {
        mapper.event.add(event.add, addEntries.map(([k]) => states.get(k)!), commonState);
      }

      for (const [key, value] of addEntries) {
        const state = itemHandler.init(value, key, commonState);
        states.set(key, state);
        const mappedValue = itemHandler.map(state, commonState);
        map.set(key, mappedValue);
        (mappedAdditions ??= new Map()).set(key, mappedValue);
      }
    }

    // Handle changes
    if (event.change) {
      const changeEntries = Array.from(event.change.entries());
      if (mapper.event?.change) {
        mapper.event.change(event.change, changeEntries.map(([k]) => states.get(k)!), commonState);
      }

      for (const [key, value] of changeEntries) {
        let state: S;
        if (itemHandler.update && states.has(key)) {
          state = itemHandler.update(value, key, states.get(key)!, commonState);
        }
        else {
          const oldState = states.get(key);
          if (oldState) this.#disposalQueue.push(oldState);
          state = itemHandler.init(value, key, commonState);
        }
        states.set(key, state);
        const mappedValue = itemHandler.map(state, commonState);
        map.set(key, mappedValue);
        (mappedChanges ??= new Map()).set(key, mappedValue);
      }
    }

    // Handle deletions
    if (event.delete) {
      if (mapper.event?.delete) {
        mapper.event.delete(event.delete, event.delete.map(k => states.get(k)!), commonState);
      }

      for (const key of event.delete) {
        const state = states.get(key);
        if (state) {
          states.delete(key);
          map.delete(key);
          this.#disposalQueue.push(state);
          (mappedDeletions ??= []).push(key);
        }
      }
    }

    return {
      add: mappedAdditions,
      change: mappedChanges,
      delete: mappedDeletions,
    };
  }
}
