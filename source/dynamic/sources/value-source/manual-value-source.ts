import { dispose } from '../../../general/disposables';
import { isDefined } from '../../../general/type-checking';
import { Subscribable } from '../../core/subscribable';
import { Async } from '../../async/async';
import { ValueSourceTag } from './common';
import type { ValueSource } from './value-source';

export class ManualValueSource<T> implements ValueSource.Manual<T> {
  constructor (initialValue: T, onDemandChanged?: ValueSource.DemandObserver<T>) {
    this.#value = initialValue;
    this.#emitter = onDemandChanged
      ? new Subscribable.Controller(new DemandObserverAdapter(this, onDemandChanged))
      : new Subscribable.Controller();
  }
  readonly #emitter: Subscribable.Controller<[value: T]>;
  #finalization?: Async.Manual<true>;
  #isManuallyFinalized = false;
  #value: T;

    get [ValueSourceTag] () { return true as const; }

  get value (): T { return this.#value; }
  get finalization (): Async<true> { return this.#finalization ??= Async.create(); }
  get isFinalized () {
    if (this.#isManuallyFinalized) return true;
    const finalization = this.#finalization;
    return isDefined(finalization) && finalization.finalized && finalization.result;
  }

  subscribe<A extends any[]> (callback: (subscription: ValueSource.Subscription<T>, ...args: A) => ValueSource.Subscriber<T, A>, ...args: A): ValueSource.Subscription<T> {
    const subscription = new ManualValueSource.Subscription(this);

    // Force the source to be in an online state before we do anything else, just in case the 'online' event would
    // lead to an initial value assignment. As soon as we invoke the callback it is likely that the caller will try to
    // read an initial value from the subscription object. The emitter controls demand signalling, so we don't want to
    // be in a situation where the demand handler is expecting to to be able to assign an initial value when 'online'
    // is called, but only ends up being called _after_ the callback for the first subscriber has been invoked.

    this.#emitter.__incrementDemand();

    const subscriber = callback(subscription, ...args);
    const disposable = this.#emitter.subscribe(subscriber, ...args);
    subscription.__setDisposable(disposable);

    this.#emitter.__decrementDemand();

    return subscription;
  }

  set (value: T, final = false): void {
    if (this.isFinalized) {
      throw new Error(`Cannot set value. Source has already been finalized.`);
    }
    if (value === this.#value) return;
    this.#value = value;
    // We're about to signal subscribers, and they might check whether the value is finalized, so we need to pre-set
    // isManuallyFinalized to true before signalling.
    if (final) this.#isManuallyFinalized = true;
    this.#emitter?.signal(value);
    // We trigger the actual finalization event only after the change signal has been emitted (above), otherwise we'll
    // end up having to violate our own rules by telling subscribers that the value has changed after we've told them
    // that it has been finalized.
    if (final) this.finalizeInternal();
  }

  finalize () {
    if (this.isFinalized) return;
    this.#isManuallyFinalized = true;
    this.finalizeInternal();
  }

  private finalizeInternal () {
    const finalization = this.#finalization ??= Async.create();
    finalization.set(true);
    this.#emitter.end();
  }

  static Subscription = class Subscription<T> implements ValueSource.Subscription<T> {
    constructor (source: ManualValueSource<T>) {
      this.#source = source;
    }
    readonly #source: ManualValueSource<T>;
    #disposable: Disposable;
    #disposed = false;

    get value () {
      this.assertNotDisposed();
      return this.#source.value;
    }
    get finalization () {
      this.assertNotDisposed();
      return this.#source.finalization;
    }
    get isFinalized () {
      this.assertNotDisposed();
      return this.#source.isFinalized;
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
  };
}

export class ManualCounterSource extends ManualValueSource<number> implements ValueSource.Counter {
  constructor (initialValue: number = 0) {
    super(initialValue);
    this.#initialValue = initialValue;
  }
  readonly #initialValue: number;

  increment (amount = 1) { this.set(this.value + amount); }
  decrement (amount = 1) { this.set(this.value - amount); }
  reset () { this.set(this.#initialValue); }
}

class DemandObserverAdapter<T> implements Subscribable.DemandObserver.ListenerInterface<[value: T]> {
  constructor (
    private readonly source: ValueSource.Manual<T>,
    private readonly onDemandChanged: ValueSource.DemandObserver<T>
  ) {}
  online (): void { this.onDemandChanged.online?.(this.source); }
  offline (): void { this.onDemandChanged.offline?.(this.source); }
  subscribe (receiver: ValueSource.Receiver<T, unknown[]>): void { this.onDemandChanged.subscribe?.(this.source, receiver); }
  unsubscribe (receiver: ValueSource.Receiver<T, unknown[]>): void { this.onDemandChanged.unsubscribe?.(this.source, receiver); }
}
