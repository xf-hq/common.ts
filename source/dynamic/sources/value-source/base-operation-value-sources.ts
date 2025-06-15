import { dispose } from '../../../general/disposables';
import { bindMethod } from '../../../general/functional';
import { isFunction, isUndefined } from '../../../general/type-checking';
import { Async } from '../../async/async';
import { Subscribable } from '../../core/subscribable';
import { normalizeValueSourceReceiverArg, ValueSourceTag } from './common';
import { ValueSource } from './value-source';

export namespace UnaryOperationSource {
  export interface Driver<A, B> { readonly compute: (value: A) => B }
}
export class UnaryOperationSource<A, B> implements ValueSource.Immediate<B> {
  static define<A, B = A> (compute: UnaryOperationSource.Driver<A, B> | UnaryOperationSource.Driver<A, B>['compute']) {
    const driver = isFunction(compute) ? { compute } : compute;
    return (source: ValueSource<A>): ValueSource<B> => new UnaryOperationSource(source, driver);
  }
  constructor (source: ValueSource<A>, driver: UnaryOperationSource.Driver<A, B>) {
    this.#source = source;
    this.#driver = driver;
  }
  readonly #source: ValueSource<A>;
  readonly #driver: UnaryOperationSource.Driver<A, B>;
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
    const subscription = new InternalSource.Subscription(this, receiver, args);
    receiver.init?.(subscription, ...args);
    const disposable = this.#emitter.subscribe(receiver, ...args);
    subscription.__setDisposable(disposable);
    return subscription;
  }

  onDemandChange (event: Subscribable.DemandObserver.Event): void {
    switch (event) {
      case 'online': this.online(); break;
      case 'offline': this.offline(); break;
    }
  }
  online () {
    const input = this.#inputsub = this.#source.subscribe(new UnaryOperationSource.UpstreamReceiver(this));
    this.#current = {
      value: this.#driver.compute(input.value),
      finalization: input.finalization,
      isFinalized: input.isFinalized,
    };
  }
  offline () {
    dispose(this.#inputsub!);
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
export namespace UnaryOperationSource {
  export class UpstreamReceiver<A> implements Subscribable.Receiver<[value: A]> {
    constructor (private readonly source: UnaryOperationSource<A, any>) {}
    event (value: A): void { this.source.__onSignal(value); }
    end (): void { this.source.__onEnd(); }
  }
}

export namespace BinaryOperationSource {
  export interface Driver<A, B, C> { compute (left: A, right: B): C }
}
export class BinaryOperationSource<A, B = A, C = A> implements ValueSource.Immediate<C> {
  static define<A, B, C> (compute: BinaryOperationSource.Driver<A, B, C> | BinaryOperationSource.Driver<A, B, C>['compute']) {
    const driver = isFunction(compute) ? { compute } : compute;
    return (left: ValueSource<A>, right: ValueSource<B>): ValueSource<C> => new BinaryOperationSource(left, right, driver);
  }
  static defineCombinedLTR<T> (compute: BinaryOperationSource.Driver<T, T, T> | BinaryOperationSource.Driver<T, T, T>['compute'], sourceIfEmpty?: ValueSource<T>) {
    const empty = isUndefined(sourceIfEmpty) ? () => { throw new Error(`Cannot compute a binary operation with no sources.`); } : () => sourceIfEmpty;
    const driver = isFunction(compute) ? { compute } : compute;
    return (...sources: ValueSource<T>[]): ValueSource<T> => {
      if (sources.length === 0) return empty();
      let source: ValueSource<T> = sources[sources.length - 1];
      for (let i = sources.length - 2; i >= 0; i--) {
        source = new BinaryOperationSource(sources[i], source, driver);
      }
      return source;
    };
  }
  constructor (left: ValueSource<A>, right: ValueSource<B>, driver: BinaryOperationSource.Driver<A, B, C>) {
    this.#left = left;
    this.#right = right;
    this.#driver = driver;
  }
  readonly #left: ValueSource<A>;
  readonly #right: ValueSource<B>;
  readonly #driver: BinaryOperationSource.Driver<A, B, C>;
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

  get [ValueSourceTag] () { return true as const; }

  get value (): C { return this.#current!.value; }
  get finalization (): Async<true> { return this.#current!.finalization; }
  get isFinalized (): boolean { return this.#current!.isFinalized; }
  get status (): Subscribable.DemandStatus { return this.#emitter; }

  subscribe<A extends any[]> (receiver: ValueSource.Receiver<C, A> | ValueSource.Receiver<C, A>['event'], ...args: A): ValueSource.Subscription<C> {
    receiver = normalizeValueSourceReceiverArg(receiver);
    const subscription = new InternalSource.Subscription(this, receiver, args);
    receiver.init?.(subscription, ...args);
    const disposable = this.#emitter.subscribe(receiver, ...args);
    subscription.__setDisposable(disposable);
    return subscription;
  }

  onDemandChange (event: Subscribable.DemandObserver.Event): void {
    switch (event) {
      case 'online': this.online(); break;
      case 'offline': this.offline(); break;
    }
  }
  online () {
    const left = this.#leftsub = this.#left.subscribe(new BinaryOperationSource.LeftReceiver(this));
    const right = this.#rightsub = this.#right.subscribe(new BinaryOperationSource.RightReceiver(this));
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

export namespace BinaryOperationSource {
  export class LeftReceiver<A> implements Subscribable.Receiver<[value: A]> {
    constructor (private readonly source: BinaryOperationSource<A, any, any>) {}
    event (value: A): void { this.source.__onLeftSignal(value); }
    end (): void { this.source.__onLeftEnd(); }
  }
  export class RightReceiver<B> implements Subscribable.Receiver<[value: B]> {
    constructor (private readonly source: BinaryOperationSource<any, B, any>) {}
    event (value: B): void { this.source.__onRightSignal(value); }
    end (): void { this.source.__onRightEnd(); }
  }
}

export interface InternalSource<T> extends ValueSource<T> {
  readonly value: T;
  readonly finalization: Async<true>;
  readonly isFinalized: boolean;
}
export namespace InternalSource {
  export class Subscription<T> implements ValueSource.Subscription<T> {
    constructor (source: ValueSource.Immediate<T>, receiver: ValueSource.Receiver<T, any>, args: any[]) {
      this.#source = source;
      this.#receiver = receiver;
      this.#args = args;
    }
    readonly #source: ValueSource.Immediate<T>;
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

    echo (): void {
      this.assertNotDisposed();
      this.#receiver.event(this.value, ...this.#args);
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
}
