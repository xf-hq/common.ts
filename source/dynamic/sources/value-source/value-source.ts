import { disposeOnAbort } from '../../../general/disposables';
import { Async } from '../../async/async';
import { Subscribable } from '../../core/subscribable';
import { BinaryOperationSource, UnaryOperationSource } from './base-operation-value-sources';
import { ValueSourceTag } from './common';
import { ConstantValueSource } from './constant-value-source';
import { ManualCounterSource, ManualValueSource } from './manual-value-source';
import type { NumberSource } from './number-source';

export function isValueSource (value: any): value is ValueSource {
  return value?.[ValueSourceTag] === true;
}
export namespace isValueSource {
  export function Immediate<T> (value: ValueSource<T>): value is ValueSource.Immediate<T> {
    return 'value' in value;
  }
}

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
  subscribe<A extends any[]> (receiver: ValueSource.Receiver<T, A> | ValueSource.Receiver<T, A>['event'], ...args: A): ValueSource.Subscription<T>;
}
export namespace ValueSource {
  export type SubscribeCallback<T, A extends any[]> = (subscription: Subscription<T>, ...args: A) => Subscriber<T, A>;
  export type Subscriber<T, A extends any[]> = Receiver<T, A> | Receiver<T, A>['event'];
  export interface Receiver<T, A extends any[] = []> extends Subscribable.Receiver<[value: T], A> {
    init? (subscription: Subscription<T>, ...args: A): void;
  }
  export interface Subscription<T> extends Disposable {
    readonly value: T;
    readonly finalization: Async<true>;
    readonly isFinalized: boolean;
    /**
     * Emits the current value to the receiver.
     */
    echo (): this;
  }
  export interface DemandObserver<T> {
    online? (source: Manual<T>): void;
    offline? (source: Manual<T>): void;
    subscribe? (source: Manual<T>, receiver: Receiver<T, unknown[]>): void;
    unsubscribe? (source: Manual<T>, receiver: Receiver<T, unknown[]>): void;
  }

  export function subscribe<T, A extends any[]> (source: ValueSource<T>, receiver: Subscriber<T, A>, ...args: A): ValueSource.Subscription<T>;
  export function subscribe<T, A extends any[]> (abort: AbortSignal, source: ValueSource<T>, receiver: Subscriber<T, A>, ...args: A): ValueSource.Subscription<T>;
  export function subscribe<T, A extends any[]> (arg0: AbortSignal | ValueSource<T>) {
    let abort: AbortSignal | undefined;
    let source: ValueSource<T>;
    let receiver: Subscriber<T, A>;
    let args: A;
    if (arg0 instanceof AbortSignal) {
      abort = arg0;
      source = arguments[1];
      receiver = arguments[2];
      args = Array.prototype.slice.call(arguments, 3) as A;
    }
    else {
      source = arg0;
      receiver = arguments[1];
      args = Array.prototype.slice.call(arguments, 2) as A;
    }
    const sub = source.subscribe(receiver, ...args);
    if (abort) disposeOnAbort(abort, sub);
    return sub;
  }

  export interface Immediate<T = any> extends ValueSource<T> {
    get value (): T;
    get finalization (): Async<true>;
    get isFinalized (): boolean;
    get status (): Subscribable.DemandStatus;
  }
  export interface Manual<T = unknown> extends Immediate<T> {
    hold (): void;
    release (): void;
    set (value: T, final?: boolean): boolean;
    freeze (): void;
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
