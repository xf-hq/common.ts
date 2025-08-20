import { dispose } from '../../../general/disposables';
import { bindMethod } from '../../../general/functional';
import { isFunction } from '../../../general/type-checking';
import { Async } from '../../async/async';
import { Subscribable } from '../../core/subscribable';
import { normalizeValueSourceReceiverArg, SubscriptionToImmediateValueSource, ValueSourceTag } from './common';
import { ValueSource } from './value-source';

export namespace ComputedValueSourceA1 {
  export interface Driver<A, B> { readonly compute: (value: A) => B }
}
export class ComputedValueSourceA1<A, B> implements ValueSource.Immediate<B> {
  static define<A, B = A> (compute: ComputedValueSourceA1.Driver<A, B> | ComputedValueSourceA1.Driver<A, B>['compute']): {
    (source: ValueSource.Immediate<A>): ValueSource.Immediate<B>;
    (source: ValueSource<A>): ValueSource<B>;
  } {
    const driver = isFunction(compute) ? { compute } : compute;
    return (source: ValueSource<A>) => new ComputedValueSourceA1(source, driver);
  }
  constructor (source: ValueSource<A>, driver: ComputedValueSourceA1.Driver<A, B>) {
    this.#source = source;
    this.#driver = driver;
  }
  readonly #source: ValueSource<A>;
  readonly #driver: ComputedValueSourceA1.Driver<A, B>;
  readonly #emitter = new Subscribable.Controller<[value: B]>(bindMethod(this.onDemandChange, this));
  #inputsub: ValueSource.Subscription<A> | undefined;
  #current: {
    value: B;
    finalization: Async<true>;
    isFinalized: boolean;
  } | null = null;

  get [ValueSourceTag] () { return true as const; }

  get value (): B { return this.#current!.value; }
  get finalization (): Async<true> { return this.#current!.finalization; }
  get isFinalized (): boolean { return this.#current!.isFinalized; }
  get status (): Subscribable.DemandStatus { return this.#emitter; }

  subscribe<A extends any[]> (receiver: ValueSource.Receiver<B, A> | ValueSource.Receiver<B, A>['event'], ...args: A): ValueSource.Subscription<B> {
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
    const input = this.#source.subscribe(new ComputedValueSourceA1.UpstreamReceiver(this));
    this.#current = {
      value: this.#driver.compute(input.value),
      finalization: input.finalization,
      isFinalized: input.isFinalized,
    };
    this.#inputsub = input;
  }
  offline () {
    dispose(this.#inputsub!);
    this.#inputsub = undefined;
    this.#current = null;
  }

  __onSignal (value: A): void {
    const updatedValue = this.#driver.compute(value);
    if (updatedValue === this.#current!.value) return;
    this.#current!.value = updatedValue;
    this.#emitter.event(updatedValue);
  }

  __onEnd () {
    this.#emitter.end();
  }
}
export namespace ComputedValueSourceA1 {
  export class UpstreamReceiver<A> implements Subscribable.Receiver<[value: A]> {
    constructor (private readonly source: ComputedValueSourceA1<A, any>) {}
    event (value: A): void { this.source.__onSignal(value); }
    end (): void { this.source.__onEnd(); }
  }
}
