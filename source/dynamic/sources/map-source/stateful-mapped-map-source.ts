import { isDefined } from '../../../general/type-checking';
import { dispose } from '../../../general/disposables';
import { throwError } from '../../../general/errors';
import { bindMethod } from '../../../general/functional';
import { Subscribable } from '../../core/subscribable';
import { type InternalMapSource, MapSourceSubscription, MapSourceTag } from './common';
import { MapSource } from './map-source';

export class StatefulMappedMapSource<K, VA, VB, S, C> implements InternalMapSource<K, VB>, Subscribable.Receiver<[event: MapSource.Event<K, VA>]> {
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

  signal (event: MapSource.Event<K, VA>): void {
    const mappedEvent = this.applyEvent(event);
    this.#emitter.signal(mappedEvent);
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

    const applyStateChanges = mapper.event?.[event.kind] as ((event: MapSource.Event<K, VA>, itemStates: Map<K, S>, commonState: C) => void) | undefined;
    if (isDefined(applyStateChanges)) applyStateChanges(event, states, commonState);

    switch (event.kind) {
      case 'set': {
        const { key, value } = event;
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
        const mappedValue = map.set(key, itemHandler.map(state, commonState)).get(key)!;
        return { kind: 'set', key, value: mappedValue };
      }
      case 'delete': {
        const { key } = event;
        const state = states.get(key)!;
        states.delete(key);
        map.delete(key);
        this.#disposalQueue.push(state);
        return { kind: 'delete', key, value: itemHandler.map(state, commonState) };
      }
      case 'clear': {
        const previousSize = map.size;
        for (const state of states.values()) {
          this.#disposalQueue.push(state);
        }
        states.clear();
        map.clear();
        return { kind: 'clear', previousSize };
      }
    }
  }
}
