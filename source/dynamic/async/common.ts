import type { Async } from './async';

export const AsyncTag: unique symbol = Symbol('Async');
export abstract class BaseAsync<T> implements Async<T> {
    get [AsyncTag] () { return true as const; }

  abstract get promise (): PromiseLike<T>;
  abstract get finalized (): boolean;
  abstract get success (): boolean;
  abstract get result (): T;
  abstract get rejectionReason (): any;
  private get nativePromiseLike () { return this.promise as Promise<T>; }

  then<TResult1 = T, TResult2 = never> (onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null | undefined, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null | undefined): PromiseLike<TResult1 | TResult2> {
    return this.promise.then(onfulfilled, onrejected);
  }
  catch<TResult = never> (onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null | undefined): PromiseLike<T | TResult> {
    if (this.nativePromiseLike.catch) return this.nativePromiseLike.catch(onrejected);
    return this.nativePromiseLike.then(undefined, onrejected);
  }
  finally (onfinally?: (() => void) | null | undefined): PromiseLike<T> {
    if (this.nativePromiseLike.finally) return this.nativePromiseLike.finally(onfinally);
    return this.nativePromiseLike.then((result) => { onfinally?.(); return result; }, (error) => { onfinally?.(); throw error; });
  }

  abstract [Symbol.dispose] (): void;
}
