import { dispose } from '../../../general/disposables';
import { returnVoid } from '../../../general/presets';
import { isArray, isFunction } from '../../../general/type-checking';
import { Subscribable } from '../../core/subscribable';
import type { MapSource } from '../map-source/map-source';
import { ArraySourceTag } from './common';
import { FilteredArraySource } from './filtered-array-source';
import { ManualArraySource } from './manual-array-source';
import { MapSourceEntriesArraySource } from './map-source-entries-array-source';
import { MappedArraySource } from './mapped-array-source';
import { SortedArraySource } from './sorted-array-source';
import { StatefulMappedArraySource } from './stateful-mapped-array-source';

/**
 * To consume an `ArraySource`:
 * - First define any state that needs to be maintained based on the array.
 * - Next call `subscribe` with an event handler function that will be invoked whenever the array changes. The method
 *   can optionally be passed additional tail arguments which will be forwarded to the event handler. This allows
 *   handler functions to be defined in advance without the need for closures around any state they will be managing.
 * - The `subscribe` method returns a `Subscription` object exposing the current array (read-only). This can be sampled
 *   on demand to get the current state of the array.
 * @see {@link ArraySourceExample}
 */
export interface ArraySource<T> {
  readonly [ArraySourceTag]: true;
  subscribe<A extends any[]> (subscriber: Subscribable.Subscriber<[event: ArraySource.Event<T>], A>, ...args: A): ArraySource.Subscription<T>;
}
export namespace ArraySource {
  export type Receiver<T, A extends any[] = []> = Subscribable.Receiver<[event: ArraySource.Event<T>], A>;
  export type Subscriber<T, A extends any[]> = Subscribable.Subscriber<[event: ArraySource.Event<T>], A>;
  export interface Subscription<T> extends Disposable {
    readonly __array: readonly T[];
  }

  export type Event<T> = Event.Push<T> | Event.Pop | Event.Unshift<T> | Event.Shift | Event.Splice<T> | Event.Set<T> | Event.Batch<T>;
  export namespace Event {
    interface BaseEvent<K extends string> {
      readonly kind: K;
    }
    export interface Push<T> extends BaseEvent<'push'> {
      readonly values: T[];
    }
    export interface Pop extends BaseEvent<'pop'> {}
    export interface Unshift<T> extends BaseEvent<'unshift'> {
      readonly values: T[];
    }
    export interface Shift extends BaseEvent<'shift'> {}
    export interface Splice<T> extends BaseEvent<'splice'> {
      readonly index: number;
      readonly deletions: number;
      readonly insertions: T[];
    }
    export interface Set<T> extends BaseEvent<'set'> {
      readonly index: number;
      readonly value: T;
    }
    export interface Batch<T> extends BaseEvent<'batch'> {
      readonly events: Event<T>[];
    }
  }

  function end<A extends any[]> (subscriber: Subscriber<any, A>, ...args: A): void {
    if (!isFunction(subscriber)) subscriber.end?.(...args);
  }
  function release<A extends any[]> (subscriber: Subscriber<any, A>, ...args: A): void {
    if (!isFunction(subscriber)) subscriber.terminated?.(...args);
  }

  const EMPTY_ARRAY: readonly any[] = [];
  export const Empty: ArraySource<any> = {
    [ArraySourceTag]: true,
    subscribe<A extends any[]>(subscriber: Subscribable.Subscriber<[event: ArraySource.Event<any>], A>, ...args: A): Subscription<any> {
      queueMicrotask(() => end(subscriber, ...args));
      let disposed = false;
      return {
        __array: EMPTY_ARRAY,
        [Symbol.dispose]: () => {
          if (disposed) return;
          disposed = true;
          release(subscriber, ...args);
        },
      };
    },
  };

  export interface Manual<T> extends ArraySource<T> {
    readonly __array: T[];
    push (...values: T[]): void;
    pop (): T | undefined;
    unshift (...values: T[]): void;
    shift (): T | undefined;
    splice (index: number, deletions: number, ...insertions: T[]): void;
    set (index: number, value: T): void;
    batch (callback: (arraySource: Manual<T>) => void): void;
  }
  export namespace Manual {
    export interface DemandObserver<T> {
      online? (source: Manual<T>): void;
      offline? (source: Manual<T>): void;
      subscribe? (source: Manual<T>, receiver: Subscribable.Receiver<[event: ArraySource.Event<T>], any[]>): void;
      unsubscribe? (source: Manual<T>, receiver: Subscribable.Receiver<[event: ArraySource.Event<T>], any[]>): void;
    }
  }

  // export function create<K, V> (map?: Map<K, V>): Manual<K, V>;
  // export function create<K, V> (map: Map<K, V>, onDemandChanged: Manual.DemandObserver<K, V>): Manual<K, V>;
  // export function create<K, V> (onDemandChanged: Manual.DemandObserver<K, V>): Manual<K, V>;
  // export function create<K, V> (arg0?: Map<K, V> | Manual.DemandObserver<K, V>, arg1?: Manual.DemandObserver<K, V>): Manual<K, V> {
  //   const [map, onDemandChanged] = isIterable(arg0) ? [arg0, arg1] : [new Map<K, V>(), arg0];
  //   return new ManualMapSource(map, onDemandChanged);
  // }
  export function create<T> (array?: T[]): Manual<T>;
  export function create<T> (array: T[], onDemandChanged: Manual.DemandObserver<T>): Manual<T>;
  export function create<T> (onDemandChanged: Manual.DemandObserver<T>): Manual<T>;
  export function create<T> (arg0?: T[] | Manual.DemandObserver<T>, arg1?: Manual.DemandObserver<T>): Manual<T> {
    const [array, onDemandChanged] = isArray(arg0) ? [arg0, arg1] : [[], arg0];
    return new ManualArraySource(array, onDemandChanged);
  }

  export interface StatefulMapper<A, B, TItemState, TCommonState = void> {
    shared?: {
      init: (itemStates: TItemState[]) => TCommonState;
      dispose: (commonState: TCommonState) => void;
    };
    item: {
      /**
       * This is where the initial mapping is actually performed for each array index. The mapping can be updated if an
       * `update` method is provided, otherwise the state will be disposed and reinitialized each time the value
       * associated with a given index is updated.
       */
      init: (a: A, commonState: TCommonState) => TItemState;
      /**
       * If `update` is not defined, when a new value for an existing index is assigned upstream, the state for the old
       * value will be disposed and a new state will be initialized for the new value. The `update` method allows state
       * to be updated in place instead of starting from scratch.
       */
      update?: (a: A, itemState: TItemState, commonState: TCommonState) => TItemState;
      /**
       * Extracts the mapped value from the item's state.
       */
      map: (itemState: TItemState, commonState: TCommonState) => B;
      dispose: (itemState: TItemState, commonState: TCommonState) => void;
    };
    event?: {
      [K in Event<A>['kind']]?: (event: Extract<Event<A>, { kind: K }>, itemStates: TItemState[], commonState: TCommonState) => void;
    };
  }
  export function map<A, B, TItemState, TCommonState = void> (mapper: ArraySource.StatefulMapper<A, B, TItemState, TCommonState>, source: ArraySource<A>): ArraySource<B>;
  export function map<A, B> (f: (a: A) => B, source: ArraySource<A>): ArraySource<B>;
  export function map<A, B, TItemState, TCommonState = void> (arg: ((a: A) => B) | ArraySource.StatefulMapper<A, B, TItemState, TCommonState>, source: ArraySource<A>): ArraySource<B> {
    if (isFunction(arg)) {
      return new MappedArraySource(arg, source);
    }
    else {
      return new StatefulMappedArraySource(arg, source);
    }
  }

  export function mapToDisposable<A, B extends Disposable> (f: (a: A) => B, source: ArraySource<A>): ArraySource<B> {
    return map({
      item: {
        init: (a) => f(a),
        map: (b) => b,
        dispose: (b) => dispose(b),
      },
    }, source);
  }

  export function filter<T> (f: (value: T) => boolean, source: ArraySource<T>): ArraySource<T> {
    return new FilteredArraySource(f, source);
  }

  export function sort<T> (compareFn: (a: T, b: T) => number, source: ArraySource<T>): ArraySource<T> {
    return new SortedArraySource(compareFn, source);
  }

  export function tap<A> (source: ArraySource<A>): Disposable {
    return source.subscribe(returnVoid, source);
  }

  export function entriesFromMapSource<K, V> (source: MapSource<K, V>): ArraySource<[K, V]> {
    return new MapSourceEntriesArraySource(source);
  }
}
