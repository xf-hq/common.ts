import { dispose, tryDispose } from '../../../../general/disposables';
import { Async, isAsync } from '../../../async/async';
import { isOnDemandAsync } from '../../../async/on-demand-async';
import { Subscribable } from '../../../core';
import { ValueData } from '../../../data';
import { normalizeValueSourceReceiverArg, ValueSourceTag } from '../../value-source/common';
import { isValueSource, ValueSource } from '../../value-source/value-source';
import { FixedRecordSource } from '../fixed-record-source';

type ValueType<T extends Record<string, ValueData<unknown>>, K extends SRecord.KeyOf<T>> = T[K] extends ValueData<infer V> ? V : never;
type RawValue<T extends Record<string, ValueData<unknown>>, K extends SRecord.KeyOf<T>> = ValueData<ValueType<T, K>>;

export class GetValueFromFixedRecordSource<T extends Record<string, ValueData<unknown>>, K extends SRecord.KeyOf<T>>
implements ValueSource<ValueType<T, K>>, Subscribable.DemandObserver.ListenerInterface<[value: ValueType<T, K>]> {
  constructor (
    private readonly source: FixedRecordSource<T> | FixedRecordSource.Immediate<T>,
    private readonly key: K,
  ) {}
  readonly #emitter = new Subscribable.Controller<[value: ValueType<T, K>]>(this);
  #state: State<T, K> | undefined;

  get [ValueSourceTag] (): true { return true; }

  subscribe<A extends any[]> (receiver: ValueSource.Subscriber<ValueType<T, K>, A>, ...args: A): ValueSource.Subscription<ValueType<T, K>> {
    receiver = normalizeValueSourceReceiverArg(receiver);
    const disposable = this.#emitter.subscribe(receiver, ...args);
    return new Subscription<T, K, A>(this.#state!, disposable, receiver, args);
  }

  online (out: Subscribable.Controller<[value: ValueType<T, K>]>): void {
    const state: State<T, K> = this.#state = {
      innerAsync: null,
      outerSubscription: null,
      innerSubscription: null,
      finalization: Async.create(),
      outerEnded: false,
      innerEnded: false,
      rawValue: undefined!,
      value: undefined!,
    };
    FixedRecordSource.subscribe(this.source, new RecordEventReceiver(this.key, out, state));
  }
  offline (out: Subscribable.Controller<[value: ValueType<T, K>]>): void {
    const state = this.#state!;
    tryDispose(state.outerSubscription);
    tryDispose(state.innerSubscription);
    this.#state = undefined;
  }
}

interface State<T extends Record<string, ValueData<unknown>>, K extends SRecord.KeyOf<T>> {
  innerAsync: Disposable | null;
  outerSubscription: FixedRecordSource.Subscription<T> | null;
  innerSubscription: ValueSource.Subscription<ValueType<T, K>> | null;
  finalization: Async.Manual<true>;
  outerEnded: boolean;
  innerEnded: boolean;
  rawValue: RawValue<T, K>;
  value: ValueType<T, K>;
}

class RecordEventReceiver<T extends Record<string, ValueData<unknown>>, K extends SRecord.KeyOf<T>> implements FixedRecordSource.EventReceiver<T, MapRecord<T, any>> {
  constructor (
    private readonly _key: K,
    private readonly _emitter: Subscribable.Controller<[value: ValueType<T, K>]>,
    private readonly _state: State<T, K>,
  ) {}

  init (sub: FixedRecordSource.Subscription<T>): void {
    const state = this._state;
    state.outerSubscription = sub;
    const rawValue = sub.__record[this._key] as RawValue<T, K>;
    this._setRaw(rawValue);
  }
  set (values: Partial<T>): void {
    if (!(this._key in values)) return;
    const rawValue = values[this._key] as RawValue<T, K>;
    if (rawValue === this._state.rawValue) return;
    this._setRaw(rawValue);
  }
  patch (changes: Partial<MapRecord<T, any>>): void {
    if (!(this._key in changes)) return;
    throw new Error(`Not Implemented`);
  }
  batch (events: readonly FixedRecordSource.Event<T, MapRecord<T, any>>[], receiver: FixedRecordSource.Receiver<T, MapRecord<T, any>, any[]>): void {
    this._emitter.hold();
    for (const event of events) {
      receiver.event(event);
    }
    this._emitter.release();
  }
  end (): void {
    this._state.outerEnded = true;
    if (this._state.innerEnded) {
      this._emitter.end();
    }
  }

  _setRaw (rawValue: RawValue<T, K>): void {
    const state = this._state;
    state.rawValue = rawValue;
    tryDispose(state.innerAsync);
    tryDispose(state.innerSubscription);
    if (isValueSource(rawValue)) {
      state.innerEnded = false;
      ValueSource.subscribe(rawValue, new ValueReceiver(this._emitter, state));
    }
    else if (isAsync(rawValue)) {
      rawValue.then((_rawValue) => {
        if (state.rawValue !== rawValue) return;
        this._setRaw(_rawValue);
      });
    }
    else if (isOnDemandAsync(rawValue)) {
      const async = rawValue.require();
      state.innerAsync = async;
      async.then((_rawValue) => this._setRaw(_rawValue));
    }
    else {
      state.innerEnded = true;
      state.value = rawValue;
      this._emitter.event(rawValue);
    }
  }
}

class ValueReceiver<T extends Record<string, ValueData<unknown>>, K extends SRecord.KeyOf<T>> implements ValueSource.Receiver<ValueType<T, K>> {
  constructor (
    private readonly _emitter: Subscribable.Controller<[value: ValueType<T, K>]>,
    private readonly _state: State<T, K>,
  ) {}

  init (sub: ValueSource.Subscription<ValueType<T, K>>): void {
    this._state.innerSubscription = sub;
    this._state.value = sub.value;
  }
  event (value: ValueType<T, K>): void {
    const state = this._state;
    if (state.innerEnded || state.value === value) return;
    state.value = value;
    this._emitter.event(value);
  }
  end (): void {
    this._state.innerEnded = true;
    if (this._state.outerEnded) {
      this._emitter.end();
    }
  }
}

class Subscription<T extends Record<string, ValueData<unknown>>, K extends SRecord.KeyOf<T>, A extends any[]> implements ValueSource.Subscription<ValueType<T, K>> {
  constructor (
    private readonly _state: State<T, K>,
    private readonly _disposable: Disposable,
    private readonly _receiver: ValueSource.Receiver<ValueType<T, K>, A>,
    private readonly _args: A,
  ) {}
  #disposed = false;

  get value (): ValueType<T, K> {
    this._assertNotDisposed();
    return this._state.value;
  }
  get finalization (): Async<true> {
    this._assertNotDisposed();
    return this._state.finalization;
  }
  get isFinalized (): boolean {
    this._assertNotDisposed();
    return this._state.finalization.finalized;
  }

  echo (): this {
    this._assertNotDisposed();
    this._receiver.event(this._state.value, ...this._args);
    return this;
  }

  [Symbol.dispose] (): void {
    if (this.#disposed) return;
    dispose(this._disposable);
  }

  private _assertNotDisposed (): void {
    if (this.#disposed) {
      throw new Error(`Subscription is disposed`);
    }
  }
}
