import { createChildAbortController } from '../../../general/abort-signals';
import { dispose, disposeOnAbort } from '../../../general/disposables';
import { returnVoid } from '../../../general/presets';
import { isArray, isFunction } from '../../../general/type-checking';
import { Subscribable } from '../../core/subscribable';
import type { MapSource } from '../map-source/map-source';
import { ArraySourceTag } from './common';
import { ConcatArraySource } from './concat-array-source';
import { FilteredArraySource } from './filtered-array-source';
import { FluentArraySource } from './fluent-array-source';
import { ForEachArraySourceElement } from './for-each-array-source-element';
import { ManualArraySource } from './manual-array-source';
import { MapSourceEntriesArraySource } from './map-source-entries-array-source';
import { MappedArraySource } from './mapped-array-source';
import { SortedArraySource } from './sorted-array-source';
import { StatefulMappedArraySource } from './stateful-mapped-array-source';

export function isArraySource (source: any): source is ArraySource<any> {
  return source?.[ArraySourceTag] === true;
}

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
  subscribe<A extends any[]> (subscriber: ArraySource.Subscriber<T, A>, ...args: A): ArraySource.Subscription<T>;
}
export namespace ArraySource {
  export interface Receiver<T, A extends any[] = []> extends Subscribable.Receiver<[event: ArraySource.Event<T>], A> {
    init? (subscription: ArraySource.Subscription<T>, ...args: A): void;
  }
  export type Subscriber<T, A extends any[]> = Receiver<T, A> | Receiver<T, A>['event'];
  export interface Subscription<T> extends Disposable {
    readonly __array: readonly T[];
  }

  export type Event<T> = Event.Push<T> | Event.Pop | Event.Unshift<T> | Event.Shift | Event.Splice<T> | Event.Set<T> | Event.Batch<T>;
  export namespace Event {
    interface BaseEvent<K extends string> {
      readonly kind: K;
    }
    export interface Push<T> extends BaseEvent<'push'> {
      readonly values: readonly T[];
    }
    export interface Pop extends BaseEvent<'pop'> {}
    export interface Unshift<T> extends BaseEvent<'unshift'> {
      readonly values: readonly T[];
    }
    export interface Shift extends BaseEvent<'shift'> {}
    export interface Splice<T> extends BaseEvent<'splice'> {
      readonly index: number;
      readonly deletions: number;
      readonly insertions: readonly T[];
    }
    export interface Set<T> extends BaseEvent<'set'> {
      readonly index: number;
      readonly value: T;
    }
    /**
     * Events of this type are to be applied in the order they are specified; events appearing later in the array may
     * assume an array state that is not reflected by the target array if applied out of order.
     * @remarks
     * Batch events are generally intended for use only where multiple events need to be grouped together that can't be
     * simplified into a more appropriate event (e.g. it could be used to capture multiple non-contiguous splice
     * operations). If you're just batching multiple events that could be flattened to a single event, you're likely
     * "doing it wrong", so to speak.
     */
    export interface Batch<T> extends BaseEvent<'batch'> {
      readonly events: readonly Event<T>[];
    }
  }

  export function subscribe<V> (abort: AbortSignal, source: ArraySource<V>, receiver: EventReceiver<V>): Subscription<V>;
  export function subscribe<V, A extends any[]> (abort: AbortSignal, source: ArraySource<V>, receiver: Subscriber<V, A>, ...args: A): Subscription<V>;
  export function subscribe<V> (abort: AbortSignal, source: ArraySource<V>, receiver: Subscriber<V, any> | EventReceiver<V>, ...args: any[]): Subscription<V> {
    if ('push' in receiver) receiver = new EventReceiverAdapter(receiver) as Receiver<V>;
    const sub = source.subscribe(receiver, ...args);
    disposeOnAbort(abort, sub);
    return sub;
  }

  export interface EventReceiver<T> {
    init? (subscription: ArraySource.Subscription<T>): void;
    push (values: readonly T[]): void;
    pop (): void;
    unshift (values: readonly T[]): void;
    shift (): void;
    splice (index: number, deletions: number, insertions: readonly T[]): void;
    set (index: number, value: T): void;
    batch (events: readonly Event<T>[], receiver: Receiver<T>): void;
    end? (): void;
    unsubscribed? (): void;
  }

  export class EventReceiverAdapter<T> implements Receiver<T> {
    constructor (private readonly receiver: EventReceiver<T>) {}

    init (subscription: Subscription<T>): void {
      this.receiver.init?.(subscription);
    }

    event (event: Event<T>): void {
      switch (event.kind) {
        case 'push': {
          this.receiver.push(event.values);
          break;
        }
        case 'pop': {
          this.receiver.pop();
          break;
        }
        case 'unshift': {
          this.receiver.unshift(event.values);
          break;
        }
        case 'shift': {
          this.receiver.shift();
          break;
        }
        case 'splice': {
          this.receiver.splice(event.index, event.deletions, event.insertions);
          break;
        }
        case 'set': {
          this.receiver.set(event.index, event.value);
          break;
        }
        case 'batch': {
          this.receiver.batch(event.events, this);
          break;
        }
      }
    }

    end (): void {
      this.receiver.end?.();
    }

    unsubscribed (): void {
      this.receiver.unsubscribed?.();
    }
  }

  export interface Immediate<T> extends ArraySource<T> {
    readonly __array: readonly T[];
    readonly length: number;
  }
  export interface Manual<T> extends Immediate<T> {
    hold (): void;
    release (): void;

    push (...values: T[]): void;
    pop (): T | undefined;
    unshift (...values: T[]): void;
    shift (): T | undefined;
    splice (index: number, deletions: number, ...insertions: T[]): T[];
    set (index: number, value: T): void;
    batch (callback: (arraySource: Manual<T>) => void): void;
    clear (): void;
  }
  export namespace Manual {
    export interface DemandObserver<T> {
      online? (source: Manual<T>): void;
      offline? (source: Manual<T>): void;
      subscribe? (source: Manual<T>, receiver: ArraySource.Receiver<T, any[]>): void;
      unsubscribe? (source: Manual<T>, receiver: ArraySource.Receiver<T, any[]>): void;
    }
    export namespace DemandObserver {
      export function create<T> (online: (abortSignal: AbortSignal, array: Manual<T>) => void): DemandObserver<T>;
      export function create<T> (abortSignal: AbortSignal, online: (abortSignal: AbortSignal, array: Manual<T>) => void): DemandObserver<T>;
      export function create<T> (arg0: AbortSignal | ((abortSignal: AbortSignal, array: Manual<T>) => void), arg1?: (abortSignal: AbortSignal, array: Manual<T>) => void): DemandObserver<T> {
        let abortController: AbortController | undefined;
        return {
          online (source: Manual<T>) {
            if (isFunction(arg0)) {
              abortController = new AbortController();
              arg0(abortController.signal, source);
            }
            else {
              abortController = createChildAbortController(arg0 as AbortSignal);
              arg1!(abortController.signal, source);
            }
          },
          offline () {
            abortController!.abort();
            abortController = undefined;
          },
        };
      }
    }
  }

  export function create<T> (array?: T[]): Manual<T>;
  export function create<T> (array: T[], onDemandChanged: Manual.DemandObserver<T>): Manual<T>;
  export function create<T> (onDemandChanged: Manual.DemandObserver<T>): Manual<T>;
  export function create<T> (arg0?: T[] | Manual.DemandObserver<T>, arg1?: Manual.DemandObserver<T>): Manual<T> {
    const [array, onDemandChanged] = isArray(arg0) ? [arg0, arg1] : [[], arg0];
    return new ManualArraySource(array, onDemandChanged);
  }

  export interface Fluent<T> extends ArraySource<T> {
    forEach (abortSignal: AbortSignal, callback: (value: T, abortSignal: AbortSignal) => void): void;
    map<U> (f: (a: T) => U): FluentArraySource<U>;
    map<U, TItemState, TCommonState = void> (mapper: ArraySource.StatefulMapper<T, U, TItemState, TCommonState>): FluentArraySource<U>;
    mapToDisposable<U extends Disposable> (f: (a: T) => U): FluentArraySource<U>;
    filter (f: (value: T) => boolean): FluentArraySource<T>;
    sort (compareFn: (a: T, b: T) => number): FluentArraySource<T>;
    concat (other: ArraySource<T>): FluentArraySource<T>;
    tap<A> (source: ArraySource<A>): Disposable;
  }

  export function createFluent<T> (onDemandChanged: Manual.DemandObserver<T>): Fluent<T> {
    const source = create(onDemandChanged);
    return new FluentArraySource(source);
  }

  export function fluent<T> (source: ArraySource<T>): Fluent<T> {
    return source instanceof FluentArraySource ? source : new FluentArraySource(source);
  }

  export function forEach<T> (abortSignal: AbortSignal, source: ArraySource<T>, callback: (value: T, abortSignal: AbortSignal) => void): void {
    subscribe(abortSignal, source, new ForEachArraySourceElement(abortSignal, callback));
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

  export function concat<T> (sourceA: ArraySource<T>, sourceB: ArraySource<T>): ArraySource<T> {
    return new ConcatArraySource(sourceA, sourceB);
  }

  export function tap<A> (source: ArraySource<A>): Disposable {
    return source.subscribe(returnVoid, source);
  }

  export function entriesFromMapSource<K, V> (source: MapSource<K, V>): ArraySource<[K, V]> {
    return new MapSourceEntriesArraySource(source);
  }
}
