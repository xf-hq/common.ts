import { disposeOnAbort } from '../../../general/disposables';
import { Async } from '../../async/async';
import { Subscribable } from '../../core/subscribable';
import { BinaryOperationSource, UnaryOperationSource } from './base-operation-value-sources';
import { ValueSourceTag } from './common';
import { ConstantValueSource } from './constant-value-source';
import { ManualCounterSource, ManualValueSource } from './manual-value-source';
import type { NumberSource } from './number-source';

/**
 * To consume a `ValueSource`:
 * - First define any state that needs to be maintained based on the value.
 * - Next call `subscribe` with an event handler function that will be invoked whenever the value changes. The method can
 *   optionally be passed additional tail arguments which will be forwarded to the event handler. This allows handler
 *   functions to be defined in advance without the need for closures around any state they will be managing.
 * - The `subscribe` method returns a `Subscription` object exposing the current value. This can be sampled on
 *   demand to get the current value of the source.
 */
export interface ValueSource<T = any> {
  readonly [ValueSourceTag]: true;
  /**
   * The subscriber will never be signalled before the call to the `subscribe` method returns. The initial value and
   * state of the source will always be able to be consumed before any signals are emitted.
   */
  subscribe<A extends any[]> (subscriber: ValueSource.SubscribeCallback<T, A> | ValueSource.Receiver<T, A>, ...args: A): ValueSource.Subscription<T>;
}
export namespace ValueSource {
  export type SubscribeCallback<T, A extends any[]> = (subscription: Subscription<T>, ...args: A) => Subscriber<T, A>;
  export type Subscriber<T, A extends any[]> = Receiver<T, A> | Receiver<T, A>['signal'];
  export interface Receiver<T, A extends any[]> extends Subscribable.Receiver<[value: T], A> {
    init? (subscription: Subscription<T>, ...args: A): void;
  }
  export interface Subscription<T> extends Disposable {
    readonly value: T;
    readonly finalization: Async<true>;
    readonly isFinalized: boolean;
  }
  export interface DemandObserver<T> {
    online? (source: Manual<T>): void;
    offline? (source: Manual<T>): void;
    subscribe? (source: Manual<T>, receiver: Receiver<T, unknown[]>): void;
    unsubscribe? (source: Manual<T>, receiver: Receiver<T, unknown[]>): void;
  }

  export function subscribe<T, A extends any[]> (source: ValueSource<T>, subscriber: ValueSource.SubscribeCallback<T, A> | ValueSource.Receiver<T, A>, ...args: A): Subscription<T>;
  export function subscribe<T, A extends any[]> (source: ValueSource<T>, abortSignal: AbortSignal, subscriber: ValueSource.SubscribeCallback<T, A> | ValueSource.Receiver<T, A>, ...args: A): Subscription<T>;
  export function subscribe<T, A extends any[]> (source: ValueSource<T>, arg1: ValueSource.SubscribeCallback<T, A> | ValueSource.Receiver<T, A> | AbortSignal, ...rest: any[]): Subscription<T> {
    let subscriber: ValueSource.SubscribeCallback<T, A> | ValueSource.Receiver<T, A>;
    let args: A;
    let abortSignal: AbortSignal | undefined;
    if (arg1 instanceof AbortSignal) {
      abortSignal = arg1;
      subscriber = rest[0];
      args = rest.slice(1) as A;
    }
    else {
      subscriber = arg1;
      args = rest as A;
    }
    const subscription = source.subscribe(subscriber, ...args);
    if (abortSignal) {
      abortSignal.throwIfAborted();
      disposeOnAbort(abortSignal, subscription);
    }
    return subscription;
  }

  export type Maybe<T = unknown> = ValueSource<ValueSource<T> | null>;
  export namespace Maybe {
    export type Subscriber<T, A extends any[]> = Subscribable.Subscriber<[source: ValueSource<T> | null], A>;
    export type Subscription<T> = ValueSource.Subscription<ValueSource<T> | null>;
    export type Receiver<T, A extends any[]> = Subscribable.Receiver<[source: ValueSource<T> | null], A>;
    export type Manual<T = unknown> = ValueSource.Manual<ValueSource<T> | null>;
    export function create<T> (initialValue: ValueSource<T> | null = null, onDemandChanged?: DemandObserver<ValueSource<T> | null>) {
      return ValueSource.create(initialValue, onDemandChanged);
    }
  }

  export interface Immediate<T = any> extends ValueSource<T> {
    get value (): T;
    get finalization (): Async<true>;
    get isFinalized (): boolean;
    get status (): Subscribable.Status;
  }
  export interface Manual<T = unknown> extends Immediate<T> {
    set (value: T, final?: boolean): boolean;
    finalize (): void;
  }
  export function create<T> (initialValue: T, onDemandChanged?: DemandObserver<T>): Manual<T> {
    return new ManualValueSource(initialValue, onDemandChanged);
  }

  export interface Counter extends NumberSource.Manual {
    increment (amount?: number): void;
    decrement (amount?: number): void;
    reset (): void;
  }
  export function counter (initialValue: number = 0): Counter {
    return new ManualCounterSource(initialValue);
  }

  export function constant<T> (value: T): ValueSource<T> {
    return new ConstantValueSource(value);
  }

  export function map<A, B> (compute: (a: A) => B): (a: ValueSource<A>) => ValueSource<B>;
  export function map<A, B> (compute: (a: A) => B, a: ValueSource<A>): ValueSource<B>;
  export function map<A, B> (compute: (a: A) => B, a?: ValueSource<A>): any {
    if (arguments.length === 1) return UnaryOperationSource.define(compute);
    return new UnaryOperationSource(a!, { compute });
  }

  export function map2<A, B, C> (compute: (a: A, b: B) => C): (a: ValueSource<A>, b: ValueSource<B>) => ValueSource<C>;
  export function map2<A, B, C> (compute: (a: A, b: B) => C, a: ValueSource<A>, b: ValueSource<B>): ValueSource<C>;
  export function map2<A, B, C> (compute: (a: A, b: B) => C, a?: ValueSource<A>, b?: ValueSource<B>): any {
    if (arguments.length === 1) return BinaryOperationSource.define(compute);
    return new BinaryOperationSource(a!, b!, { compute });
  }
}
