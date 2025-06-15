import { Async } from '../../async/async';
import { normalizeValueSourceReceiverArg, ValueSourceTag } from './common';
import type { ValueSource } from './value-source';

export class ConstantValueSource<T> implements ValueSource<T> {
  // Every subscription will be the same and has no effect on disposal, so we may as well just create one in advance
  // and share it with all subscribers.
  constructor (value: T) { this.#value = value; }
  readonly #value: T;

  get [ValueSourceTag] () { return true as const; }

  subscribe<A extends any[]> (receiver: ValueSource.Receiver<T, A> | ((value: T, ...refArgs: A) => void), ...args: A): ValueSource.Subscription<T> {
    receiver = normalizeValueSourceReceiverArg(receiver);
    const subscription = new ConstantValueSource.Subscription(this.#value, receiver, args);
    receiver.init?.(subscription, ...args);
    return subscription;
  }

  static Subscription = class Subscription<T> implements ValueSource.Subscription<T> {
    constructor (value: T, receiver: ValueSource.Receiver<T, any>, args: any[]) {
      this.#value = value;
      this.#receiver = receiver;
      this.#args = args;
    }
    readonly #value: T;
    readonly #receiver: ValueSource.Receiver<T, any>;
    readonly #args: any[];
    #disposed = false;

    get value () {
      this.assertNotDisposed();
      return this.#value;
    }
    get finalization () {
      this.assertNotDisposed();
      return Async.resolved(true as const);
    }
    get isFinalized () {
      this.assertNotDisposed();
      return true;
    }

    echo (): this {
      this.assertNotDisposed();
      this.#receiver.event(this.value, ...this.#args);
      return this;
    }

    private assertNotDisposed () {
      if (this.#disposed) {
        throw new Error(`Cannot interact with a disposed subscription.`);
      }
    }

    [Symbol.dispose] () {
      if (this.#disposed) return;
      this.#disposed = true;
    }
  };
}
