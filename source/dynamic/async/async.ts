import { isFunction, isPromiseLike } from '../../general/type-checking';
import { AsyncFromPromise } from './async-from-promise';
import { AsyncTag } from './common';
import { ManualAsync } from './manual-async';
import { OnDemandAsync } from './on-demand-async';
import { ResolvedAsync } from './resolved-async';
import { StatefulAsync } from './stateful-async';

export function isAsync<T> (value: any): value is Async<T> {
  return value?.[AsyncTag] === true;
}

export type AsyncIfPromiseLike<T, R extends T | PromiseLike<T>> = R extends PromiseLike<T> ? Async<T> : T;
export function AsyncIfPromiseLike<T, R extends T | PromiseLike<T>> (value: T | PromiseLike<T>): AsyncIfPromiseLike<T, R>;
export function AsyncIfPromiseLike (value: unknown) { return isPromiseLike(value) ? Async(value) : value; }

export interface Async<T> extends Disposable, ModernPromiseLike<T> {
  readonly [AsyncTag]: true;
  readonly promise: PromiseLike<T> | ModernPromiseLike<T>;
  readonly finalized: boolean;
  /**
   * If false, resolving `promise` will result in a rejection, and accessing the `result` property will throw whatever
   * error the `promise` was rejected with.
  */
  readonly success: boolean;
  readonly result: T;
  readonly rejectionReason: any;

  then<TResult1 = T, TResult2 = never> (onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null | undefined, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null | undefined): PromiseLike<TResult1 | TResult2>;
  catch<TResult = never> (onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null | undefined): PromiseLike<T | TResult>;
  finally(onfinally?: (() => void) | null | undefined): PromiseLike<T>;
}
export function Async<T, S> (arg: PromiseLike<T> | Async.PromiseInit<T> | Async.StatefulDriver<T, S>): Async<T> {
  return 'initialize' in arg
    ? Async.using(arg)
    : Async.fromPromise(arg);
}
export namespace Async {
  export interface StatefulDriver<T, S = void> {
    /**
     * Called immediately upon construction of the new `Async` instance.
     * @param resolve A function that must be called with the result of the asynchronous operation.
     */
    initialize (resolve: (result: T) => void, reject: (reason?: any) => void): S;
    release (state: S): void;
  }
  export namespace Driver {
    export interface WithAsyncInitializer<T> {
      initialize (resolve: (result: T) => void, reject: (reason?: any) => void): void;
    }
  }
  export type PromiseInit<T> = ((resolve: (value: T | PromiseLike<T> | ModernPromiseLike<T>) => void, reject: (reason?: any) => void) => void);
  export interface OnDemand<T> {
    require (): Async<T>;
  }

  export type Manual<T> = ManualAsync<T>;
  export function create<T> () { return new ManualAsync<T>(); }
  export function using<T, S> (driver: StatefulDriver<T, S>): Async<T> { return StatefulAsync.load(driver); }
  export function fromPromise<T> (promise: PromiseLike<T> | PromiseInit<T>): Async<T> {
    if (isFunction(promise)) promise = new Promise<T>(promise);
    return AsyncFromPromise.create(promise);
  }
  export function onDemand<T> (driver: StatefulDriver<T>): OnDemandAsync<T> { return OnDemandAsync.create(driver); }
  export function map<A, B> (f: (a: A) => B, source: Async<A>): Async<B> { return Async.fromPromise(source.then(f)); }

  export const resolved = <T>(value: T): Async<T> => new ResolvedAsync(value);
}
