import { BaseAsync } from './common';

export class ResolvedAsync<T> extends BaseAsync<T> {
  constructor (value: T) {
    super();
    this.#value = value;
  }
  readonly #value: T;
  #promise?: Promise<T>;

  override get promise () { return this.#promise ??= Promise.resolve(this.#value); }
  override get result () { return this.#value; }
  override get finalized () { return true; }
  override get success () { return true; }
  override get rejectionReason () {
    throw new Error(`'rejectionReason' is not accessible when 'success' is true.`);
  }

  override [Symbol.dispose] () {}
}
