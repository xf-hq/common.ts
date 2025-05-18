import { dispose } from '../../general/disposables';
import { Async } from './async';
import { AsyncFromPromise } from './async-from-promise';
import { BaseAsync } from './common';

export class ManualAsync<T> extends BaseAsync<T> {
  constructor () {
    super();
    const { promise, resolve, reject } = Promise.withResolvers<T>();
    this.#resolve = resolve;
    this.#reject = reject;
    this.#inner = AsyncFromPromise.create(promise);
  }
  readonly #inner: Async<T>;
  #resolve: (result: T) => void;
  #reject: (error: Error) => void;

  override get promise () { return this.#inner.promise; }
  override get finalized () { return this.#inner.finalized; }
  override get success () { return this.#inner.success; }
  override get result () { return this.#inner.result; }
  override get rejectionReason () { return this.#inner.rejectionReason; }

  set (result: T) {
    if (this.#inner.finalized) {
      throw new Error(`Cannot set the resolved value of an already-finalized 'Async' instance.`);
    }
    this.#resolve(result);
  }
  throw (error: Error) {
    if (this.#inner.finalized) {
      throw new Error(`Cannot reject an already-finalized 'Async' instance.`);
    }
    this.#reject(error);
  }

  override [Symbol.dispose] () { dispose(this.#inner); }
}
