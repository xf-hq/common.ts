import { dispose } from '../../../general/disposables';
import { IdGenerator } from '../../../general/ids-and-caching';
import { isDefined } from '../../../general/type-checking';
import { Async } from '../../async/async';
import { Subscribable } from '../../core/subscribable';
import { normalizeValueSourceReceiverArg, ValueSourceTag } from './common';
import { isValueSource, type ValueSource } from './value-source';

export class ManualValueSource<T> implements ValueSource.Manual<T> {
  constructor (initialValue: T, onDemandChanged?: ValueSource.DemandObserver<T>) {
    if (isValueSource(initialValue)) {
      throw new Error(`This looks like a mistake. The initial value should be a value, not a ValueSource.`);
    }
    this.#value = initialValue;
    this.#emitter = onDemandChanged
      ? new Subscribable.Controller(new DemandObserverAdapter(this, onDemandChanged))
      : new Subscribable.Controller();
  }
  id = IdGenerator.global();
  readonly #emitter: Subscribable.Controller<[value: T]>;
  readonly #status = new Subscribable.SignalStatus<[]>();
  #finalization?: Async.Manual<true>;
  #isManuallyFinalized = false;
  #value: T;
  /** Only used when in a holding state */
  #hold: { unchangedValue: T } | undefined;

  get [ValueSourceTag] () { return true as const; }

  get value (): T { return this.#value; }
  get finalization (): Async<true> { return this.#finalization ??= Async.create(); }
  get isFinalized () {
    if (this.#isManuallyFinalized) return true;
    const finalization = this.#finalization;
    return isDefined(finalization) && finalization.finalized && finalization.result;
  }
  get status () { return this.#emitter; }

  subscribe<A extends any[]> (receiver: ValueSource.Receiver<T, A> | ValueSource.Receiver<T, A>['event'], ...args: A): ValueSource.Subscription<T> {
    receiver = normalizeValueSourceReceiverArg(receiver);
    const subscription = new ManualValueSource.Subscription(this, receiver, args);

    // Force the source to be in an online state before we do anything else, just in case the 'online' event would
    // lead to an initial value assignment. As soon as we invoke the callback it is likely that the caller will try to
    // read an initial value from the subscription object. The emitter controls demand signalling, so we don't want to
    // be in a situation where the demand handler is expecting to to be able to assign an initial value when 'online'
    // is called, but only ends up being called _after_ the callback for the first subscriber has been invoked.

    this.#emitter.__incrementDemand();
    receiver.init?.(subscription, ...args);
    const disposable = this.#emitter.subscribe(receiver, ...args);
    subscription.__setDisposable(disposable);

    this.#emitter.__decrementDemand();

    return subscription;
  }

  hold (): void {
    if (this.isFinalized) return;

    this.#hold = { unchangedValue: this.#value };
    if (this.#status.initiateHold()) {
      this.#emitter.hold();
    }
  }
  release (): void {
    if (!this.#hold) return;

    if (this.#status.releaseHold()) {
      let unchangedValue = this.#hold!.unchangedValue;
      while (unchangedValue !== this.#value) {
        // Just in case `event` cycles back to a call to `set` before the `event` call returns:
        this.#hold.unchangedValue = this.#value;
        this.#emitter.event(this.#value);
        unchangedValue = this.#hold!.unchangedValue;
      }
      this.#hold = undefined;
      if (this.isFinalized) {
        this.finalizeInternal();
      }
      this.#emitter.release();
    }
  }

  set (value: T, final = false): boolean {
    if (this.isFinalized) {
      throw new Error(`Cannot set value. Source has already been finalized.`);
    }
    if (isValueSource(value)) {
      throw new Error(`This looks like a mistake. The value should be a value, not a ValueSource.`);
    }
    if (value === this.#value) return false;
    this.#value = value;
    // We're about to signal subscribers, and they might check whether the value is finalized, so we need to pre-set
    // isManuallyFinalized to true before signalling.
    if (final) this.#isManuallyFinalized = true;
    if (!this.#status.isOnHold) {
      this.#emitter?.event(value);
      // We trigger the actual finalization event only after the change signal has been emitted (above), otherwise we'll
      // end up having to violate our own rules by telling subscribers that the value has changed after we've told them
      // that it has been finalized.
      if (final) this.finalizeInternal();
    }
    return true;
  }

  finalize () {
    if (this.isFinalized) return;
    this.#isManuallyFinalized = true;
    if (!this.#status.isOnHold) {
      this.finalizeInternal();
    }
  }

  private finalizeInternal () {
    const finalization = this.#finalization ??= Async.create();
    finalization.set(true);
    this.#emitter.end();
  }

  static Subscription = class Subscription<T> implements ValueSource.Subscription<T> {
    constructor (source: ManualValueSource<T>, receiver: ValueSource.Receiver<T, any>, args: any[]) {
      this.#source = source;
      this.#receiver = receiver;
      this.#args = args;
    }
    readonly #source: ManualValueSource<T>;
    readonly #receiver: ValueSource.Receiver<T, any>;
    readonly #args: any[];
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
  onSubscribe (receiver: ValueSource.Receiver<T, unknown[]>): void { this.onDemandChanged.subscribe?.(this.source, receiver); }
  onUnsubscribe (receiver: ValueSource.Receiver<T, unknown[]>): void { this.onDemandChanged.unsubscribe?.(this.source, receiver); }
}
