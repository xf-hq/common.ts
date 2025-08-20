import { dispose } from '../../../general/disposables';
import { isFunction } from '../../../general/type-checking';
import type { Async } from '../../async/async';
import type { ValueSource } from './value-source';

export const ValueSourceTag: unique symbol = Symbol('ValueSource');
export const ImmediateValueSourceTag: unique symbol = Symbol('ValueSource.Immediate');

export function normalizeValueSourceReceiverArg<T, A extends any[]> (
  receiverArg: ValueSource.Receiver<T, A> | ValueSource.Receiver<T, A>['event']
): ValueSource.Receiver<T, A> {
  return isFunction(receiverArg) ? { event: receiverArg } : receiverArg;
}

export class SubscriptionToImmediateValueSource<T> implements ValueSource.Subscription<T> {
  constructor (source: ValueSource.PossiblyImmediate<T>, receiver: ValueSource.Receiver<T, any>, args: any[]) {
    this.#source = source;
    this.#receiver = receiver;
    this.#args = args;
  }
  readonly #source: ValueSource.PossiblyImmediate<T>;
  readonly #receiver: ValueSource.Receiver<T, any>;
  readonly #args: any[];
  #disposable: Disposable;
  #disposed = false;

  get value (): T {
    this.assertNotDisposed();
    return this.#source.value;
  }
  get finalization (): Async<true> {
    this.assertNotDisposed();
    return this.#source.finalization;
  }
  get isFinalized (): boolean {
    this.assertNotDisposed();
    return this.#source.isFinalized;
  }

  echo (): this {
    this.assertNotDisposed();
    this.#receiver.event(this.value, ...this.#args);
    return this;
  }

  __setDisposable (disposable: Disposable) {
    this.#disposable = disposable;
  }

  private assertNotDisposed () {
    if (this.#disposed) {
      throw new Error(`Cannot interact with a disposed subscription.`);
    }
  }

  [Symbol.dispose] () {
    if (this.#disposed) return;
    this.#disposed = true;
    dispose(this.#disposable);
  }
}
