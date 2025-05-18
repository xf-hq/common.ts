import { dispose } from '../../../general/disposables';
import { Subscribable } from '../../core/subscribable';
import type { ArraySource } from '../array/array-source';
import { type MapSourceTag } from './common';
import { FilteredMapSource } from './filtered-map-source';
import { ManualMapSource } from './manual-map-source';
import { MapSourceFromEntries } from './map-source-from-entries';
import { MappedMapSource } from './mapped-map-source';
import { StatefulMappedMapSource } from './stateful-mapped-map-source';
import { isDefined, isIterable } from '../../../general/type-checking';

/**
 * To consume a `MapSource`:
 * - First define any state that needs to be maintained based on the map.
 * - Next call `subscribe` with an event handler function that will be invoked whenever the map changes. The method can
 *   optionally be passed additional tail arguments which will be forwarded to the event handler. This allows handler
 *   functions to be defined in advance without the need for closures around any state they will be managing.
 * - The `subscribe` method returns a `Subscription` object exposing the current map (read-only). This can be sampled on
 *   demand to get the current state of the map.
 */
export interface MapSource<K, V> {
  readonly [MapSourceTag]: true;
  subscribe<A extends any[]> (onChange: MapSource.Subscriber<K, V, A>, ...args: A): MapSource.Subscription<K, V>;
}
export namespace MapSource {
  export type Receiver<K, V, A extends any[] = []> = Subscribable.Receiver<[event: MapSource.Event<K, V>], A>;
  export type Subscriber<K, V, A extends any[] = []> = Subscribable.Subscriber<[event: MapSource.Event<K, V>], A>;

  export interface Subscription<K, V> extends Disposable {
    readonly __map: ReadonlyMap<K, V>;
  }

  export type Event<K, V> = Event.Set<K, V> | Event.Delete<K, V> | Event.Clear;
  export namespace Event {
    interface BaseEvent<T extends string> {
      readonly kind: T;
    }
    export interface Set<K, V> extends BaseEvent<'set'> {
      readonly key: K;
      readonly value: V;
    }
    export interface Delete<K, V> extends BaseEvent<'delete'> {
      readonly key: K;
      readonly value: V;
    }
    export interface Clear extends BaseEvent<'clear'> {
      readonly previousSize: number;
    }
  }

  export interface Manual<K, V> extends MapSource<K, V> {
    readonly __map: ReadonlyMap<K, V>;
    readonly __emitter: Subscribable.Controller.Auxiliary<[event: MapSource.Event<K, V>]>;
    readonly size: number;

    set (key: K, value: V): boolean;
    delete (key: K): boolean;
    clear (): void;

    get (key: K): V | undefined;
    has (key: K): boolean;
    keys (): Iterable<K>;
    values (): Iterable<V>;
    entries (): Iterable<[K, V]>;
  }
  export namespace Manual {
    export interface DemandObserver<K, V> {
      online? (source: Manual<K, V>): void;
      offline? (source: Manual<K, V>): void;
      subscribe? (source: Manual<K, V>, receiver: Receiver<K, V, any[]>): void;
      unsubscribe? (source: Manual<K, V>, receiver: Receiver<K, V, any[]>): void;
    }
  }

  export function create<K, V> (map?: Map<K, V>): Manual<K, V>;
  export function create<K, V> (map: Map<K, V>, onDemandChanged: Manual.DemandObserver<K, V>): Manual<K, V>;
  export function create<K, V> (onDemandChanged: Manual.DemandObserver<K, V>): Manual<K, V>;
  export function create<K, V> (arg0?: Map<K, V> | Manual.DemandObserver<K, V>, arg1?: Manual.DemandObserver<K, V>): Manual<K, V> {
    const [map, onDemandChanged] = isIterable(arg0) ? [arg0, arg1] : [new Map<K, V>(), arg0];
    return new ManualMapSource(map, onDemandChanged);
  }

  export interface EventReceiver<K, V> {
    set? (event: Event.Set<K, V>): void;
    delete? (event: Event.Delete<K, V>): void;
    clear? (event: Event.Clear): void;
    end? (): void;
    unsubscribed? (): void;
  }
  export class EventReceiverAdapter<K, V> implements Receiver<K, V> {
    constructor (private readonly receiver: EventReceiver<K, V>) {}
    signal (event: Event<K, V>): void {
      switch (event.kind) {
        case 'set': this.receiver.set?.(event); break;
        case 'delete': this.receiver.delete?.(event); break;
        case 'clear': this.receiver.clear?.(event); break;
      }
    }
    end (): void {
      this.receiver.end?.();
    }
    unsubscribed (): void {
      this.receiver.unsubscribed?.();
    }
  }
  export function subscribe<K, V> (source: MapSource<K, V>, receiver: EventReceiver<K, V>): Subscription<K, V> {
    return source.subscribe(new EventReceiverAdapter(receiver));
  }

  export interface StatefulMapper<K, VA, VB, TItemState, TCommonState = void> {
    shared?: {
      init: (itemStates: TItemState[]) => TCommonState;
      dispose: (commonState: TCommonState) => void;
    };
    item: {
      /**
       * This is where the initial mapping is actually performed for each key. The mapping can be updated if an `update`
       * method is provided, otherwise the state will be disposed and reinitialized each time the value associated with
       * a given key is updated.
       */
      init: (a: VA, key: K, commonState: TCommonState) => TItemState;
      /**
       * If `update` is not defined, when a new value for an existing key is assigned upstream, the state for the old
       * value will be disposed and a new state will be initialized for the new value. The `update` method allows state
       * to be updated in place instead of starting from scratch.
       */
      update?: (a: VA, key: K, itemState: TItemState, commonState: TCommonState) => TItemState;
      /**
       * Extracts the mapped value from the item's state.
       */
      map: (itemState: TItemState, commonState: TCommonState) => VB;
      dispose: (itemState: TItemState, commonState: TCommonState) => void;
    };
    event?: {
      [K in MapSource.Event<K, VA>['kind']]?: (
        event: Extract<MapSource.Event<K, VA>, { kind: K }>,
        itemStates: TItemState[],
        commonState: TCommonState
      ) => void;
    };
  }

  export function map<K, VA, VB, TItemState, TCommonState = void> (mapper: MapSource.StatefulMapper<K, VA, VB, TItemState, TCommonState>, source: MapSource<K, VA>): MapSource<K, VB>;
  export function map<K, VA, VB> (f: (a: VA) => VB, source: MapSource<K, VA>): MapSource<K, VB>;
  export function map<K, VA, VB, TItemState, TCommonState = void> (arg: ((a: VA) => VB) | MapSource.StatefulMapper<K, VA, VB, TItemState, TCommonState>, source: MapSource<K, VA>): MapSource<K, VB> {
    if (typeof arg === 'function') {
      return new MappedMapSource(arg, source);
    }
    else {
      return new StatefulMappedMapSource(arg, source);
    }
  }

  export function mapToDisposable<K, VA, VB extends Disposable> (f: (a: VA) => VB, source: MapSource<K, VA>): MapSource<K, VB> {
    return map({
      item: {
        init: (a) => f(a),
        map: (b) => b,
        dispose: (b) => dispose(b),
      },
    }, source);
  }

  export function filter<K, V> (f: (value: V, key: K) => boolean, source: MapSource<K, V>): MapSource<K, V> {
    return new FilteredMapSource(f, source);
  }

  export function fromEntries<K, V> (source: ArraySource<readonly [K, V]>): MapSource<K, V> {
    return new MapSourceFromEntries(source);
  }
}
