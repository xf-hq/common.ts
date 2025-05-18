import { bindMethod } from '../../general/functional';
import { Async } from './async';
import { BaseAsync } from './common';

export class AsyncFromPromise<T> extends BaseAsync<T> {
  static create<T> (promise: PromiseLike<T>): Async<T> {
    const instance = new AsyncFromPromise(promise);
    promise.then(bindMethod(instance.onResolve, instance), bindMethod(instance.onReject, instance));
    return instance;
  }
  constructor (promise: PromiseLike<T>) {
    super();
    this.#promise = promise;
  }
  readonly #promise: PromiseLike<T>;
  #result!: T;
  #finalized = false;
  #success: boolean;
  #rejectionReason: any;
  #disposed = false;

  private onResolve (result: T) {
    if (this.#disposed) return;
    this.#finalized = true;
    this.#success = true;
    this.#result = result;
  }
  private onReject (rejectionReason?: any) {
    this.#finalized = true;
    this.#success = false;
    this.#rejectionReason = rejectionReason;
  }

  override get promise () {
    if (this.#disposed) {
      throw new Error(`'onReady' is not accessible after disposal.`);
    }
    return this.#promise;
  }
  override get finalized () {
    if (this.#disposed) {
      throw new Error(`'finalized' is not accessible after disposal.`);
    }
    return this.#finalized;
  }
  override get success () {
    if (this.#disposed) {
      throw new Error(`'success' is not accessible after disposal.`);
    }
    if (!this.#finalized) {
      throw new Error(`'success' is not accessible before 'finalized' is true.`);
    }
    return this.#success;
  }
  override get result () {
    if (this.#disposed) {
      throw new Error(`'result' is not accessible after disposal.`);
    }
    if (!this.#finalized) {
      throw new Error(`'result' is not accessible before 'finalized' is true.`);
    }
    if (!this.#success) {
      throw this.#rejectionReason;
    }
    return this.#result;
  }
  override get rejectionReason () {
    if (this.#disposed) {
      throw new Error(`'rejectionReason' is not accessible after disposal.`);
    }
    if (!this.#finalized) {
      throw new Error(`'rejectionReason' is not accessible before 'finalized' is true.`);
    }
    if (this.#success) {
      throw new Error(`'rejectionReason' is not accessible when 'success' is true.`);
    }
    return this.#rejectionReason;
  }

  override [Symbol.dispose] () {
    if (this.#disposed) return;
    this.#disposed = true;
  }
}
