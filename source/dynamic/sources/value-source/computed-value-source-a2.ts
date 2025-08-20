import { dispose } from '../../../general/disposables';
import { bindMethod } from '../../../general/functional';
import { isFunction, isUndefined } from '../../../general/type-checking';
import { Async } from '../../async/async';
import { Subscribable } from '../../core/subscribable';
import { normalizeValueSourceReceiverArg, SubscriptionToImmediateValueSource, ValueSourceTag } from './common';
import { ValueSource } from './value-source';

export namespace ComputedValueSourceA2 {
  export interface Driver<A, B, C> { compute (left: A, right: B): C }
}
export class ComputedValueSourceA2<A, B = A, C = A> implements ValueSource.Immediate<C> {
  static define<A, B, C> (compute: ComputedValueSourceA2.Driver<A, B, C> | ComputedValueSourceA2.Driver<A, B, C>['compute']): {
    (left: ValueSource.Immediate<A>, right: ValueSource.Immediate<B>): ValueSource.Immediate<C>;
    (left: ValueSource<A>, right: ValueSource<B>): ValueSource<C>;
  } {
    const driver = isFunction(compute) ? { compute } : compute;
    return (left: ValueSource<A>, right: ValueSource<B>) => new ComputedValueSourceA2(left, right, driver);
  }
  static defineCombinedLTR<T> (compute: ComputedValueSourceA2.Driver<T, T, T> | ComputedValueSourceA2.Driver<T, T, T>['compute'], sourceIfEmpty?: ValueSource<T>) {
    const empty = isUndefined(sourceIfEmpty) ? () => { throw new Error(`Cannot compute a binary operation with no sources.`); } : () => sourceIfEmpty;
    const driver = isFunction(compute) ? { compute } : compute;
    return (...sources: ValueSource<T>[]): ValueSource<T> => {
      if (sources.length === 0) return empty();
      let source: ValueSource<T> = sources[sources.length - 1];
      for (let i = sources.length - 2; i >= 0; i--) {
        source = new ComputedValueSourceA2(sources[i], source, driver);
      }
      return source;
    };
  }
  constructor (left: ValueSource<A>, right: ValueSource<B>, driver: ComputedValueSourceA2.Driver<A, B, C>) {
    this.#left = left;
    this.#right = right;
    this.#driver = driver;
  }
  readonly #left: ValueSource<A>;
  readonly #right: ValueSource<B>;
  readonly #driver: ComputedValueSourceA2.Driver<A, B, C>;
  readonly #emitter = new Subscribable.Controller<[value: C]>(bindMethod(this.onDemandChange, this));
  #leftsub: ValueSource.Subscription<A> | undefined;
  #rightsub: ValueSource.Subscription<B> | undefined;
  #current: {
    value: C;
    finalization: Async<true>;
    isFinalized: boolean;
    leftEnded: boolean;
    rightEnded: boolean;
  } | null = null;
  #finalization?: Async<true>;

  get [ValueSourceTag] () { return true as const; }

  get value (): C { return this.#current!.value; }
  // get finalization (): Async<true> { return this.#current!.finalization; }
  get finalization (): Async<true> {
    if (isUndefined(this.#finalization)) {
      const left = this.#left;
      const right = this.#right;
      if (ValueSource.isImmediate(left) && ValueSource.isImmediate(right)) {
        this.#finalization = Async(left.finalization.then(() => right.finalization));
      }
      else {
        // External access to the `finalization` property shouldn't happen except when both operands are `Immediate`,
        // which is the only way the consumer would see the type of this instance as also being `Immediate`. As such, if
        // we reach this point in the code, the only valid assumption is that the call originates from the
        // `finalization` property of a subscription, implying that this instance is currently online, and therefore
        // that the `#current` property is currently readable.
        this.#finalization = this.#current!.finalization;
      }
    }
    return this.#finalization;
  }
  get isFinalized (): boolean { return this.#current!.isFinalized; }
  get status (): Subscribable.DemandStatus { return this.#emitter; }

  subscribe<A extends any[]> (receiver: ValueSource.Receiver<C, A> | ValueSource.Receiver<C, A>['event'], ...args: A): ValueSource.Subscription<C> {
    receiver = normalizeValueSourceReceiverArg(receiver);
    const subscription = new SubscriptionToImmediateValueSource(this, receiver, args);
    const disposable = this.#emitter.subscribe(receiver, ...args);
    subscription.__setDisposable(disposable);
    receiver.init?.(subscription, ...args);
    return subscription;
  }

  onDemandChange (event: Subscribable.DemandObserver.Event): void {
    switch (event) {
      case 'online': this.online(); break;
      case 'offline': this.offline(); break;
    }
  }
  online () {
    const left = this.#leftsub = this.#left.subscribe(new ComputedValueSourceA2.LeftReceiver(this));
    const right = this.#rightsub = this.#right.subscribe(new ComputedValueSourceA2.RightReceiver(this));
    this.#current = {
      value: this.#driver.compute(left.value, right.value),
      finalization: Async.fromPromise(left.finalization.then(() => right.finalization)),
      isFinalized: left.isFinalized && right.isFinalized,
      leftEnded: false,
      rightEnded: false,
    };
  }
  offline () {
    dispose(this.#leftsub!);
    dispose(this.#rightsub!);
    this.#current = null;
  }

  __onLeftSignal (value: A): void {
    this.recompute(value, this.#rightsub!.value);
  }
  __onRightSignal (value: B): void {
    this.recompute(this.#leftsub!.value, value);
  }
  __onLeftEnd (): void {
    const current = this.#current;
    if (!current || current.leftEnded) return;
    current.leftEnded = true;
    if (current.rightEnded) this.#emitter.end();
  }
  __onRightEnd (): void {
    const current = this.#current;
    if (!current || current.rightEnded) return;
    current.rightEnded = true;
    if (current.leftEnded) this.#emitter.end();
  }

  private recompute (left: A, right: B): void {
    const updatedValue = this.#driver.compute(left, right);
    if (updatedValue === this.#current!.value) return;
    this.#current!.value = updatedValue;
    this.#emitter.event(updatedValue);
  }
}
export namespace ComputedValueSourceA2 {
  export class LeftReceiver<A> implements Subscribable.Receiver<[value: A]> {
    constructor (private readonly source: ComputedValueSourceA2<A, any, any>) {}
    event (value: A): void { this.source.__onLeftSignal(value); }
    end (): void { this.source.__onLeftEnd(); }
  }
  export class RightReceiver<B> implements Subscribable.Receiver<[value: B]> {
    constructor (private readonly source: ComputedValueSourceA2<any, B, any>) {}
    event (value: B): void { this.source.__onRightSignal(value); }
    end (): void { this.source.__onRightEnd(); }
  }
}
