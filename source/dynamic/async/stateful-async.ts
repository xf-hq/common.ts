import { Async } from './async';
import { BaseAsync } from './common';

export class StatefulAsync<T, S> extends BaseAsync<T> {
  static load<T, S> (driver: Async.StatefulDriver<T, S>) {
    const instance = new StatefulAsync(driver);
    instance.initialize();
    return instance;
  }
  constructor (driver: Async.StatefulDriver<T, S>) {
    super();
    this.#driver = driver;
    const { promise, resolve, reject } = Promise.withResolvers<T>();
    this.#promise = promise;
    this.#resolve = resolve;
    this.#reject = reject;
  }
  readonly #driver: Async.StatefulDriver<T, S>;
  readonly #promise: Promise<T>;
  #resolve: (result: T) => void;
  #reject: (reason?: any) => void;
  #state: S;
  #finalized = false;
  #disposed = false;
  #success: boolean;
  #result: T;
  #rejectionReason: any;

  private initialize () {
    this.#state = this.#driver.initialize(
      (result) => this.onResolve(result),
      (reason) => this.onReject(reason),
    );
  }

  private onResolve (result: T) {
    if (this.#disposed) return;
    this.#result = result;
    this.#finalized = true;
    this.#success = true;
    this.#resolve(result);
  }
  private onReject (reason: any) {
    if (this.#disposed) return;
    this.#finalized = true;
    this.#success = false;
    this.#rejectionReason = reason;
    this.#reject(reason);
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
    this.#driver.release(this.#state);
  }
}
