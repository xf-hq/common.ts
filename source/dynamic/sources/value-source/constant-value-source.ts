import { Async } from '../../async/async';
import { ValueSourceTag } from './common';
import type { ValueSource } from './value-source';

export class ConstantValueSource<T> implements ValueSource<T> {
  // Every subscription will be the same and has no effect on disposal, so we may as well just create one in advance
  // and share it with all subscribers.
  constructor (value: T) { this.#subscription = new ConstantValueSource.Subscription(value); }
  readonly #subscription: ValueSource.Subscription<T>;

    get [ValueSourceTag] () { return true as const; }

  subscribe (): ValueSource.Subscription<T> { return this.#subscription; }

  static Subscription = class Subscription<T> implements ValueSource.Subscription<T> {
    constructor (value: T) { this.#value = value; }
    readonly #value: T;
    get value () { return this.#value; }
    get finalization () { return Async.resolved(true as const); }
    get isFinalized () { return true; }
    [Symbol.dispose] () {}
  };
}
