import { dispose } from '../../../../general/disposables';
import type { ValueData } from '../../../data';
import { isValueSource, ValueSource } from '../../value-source/value-source';
import { FixedRecordSource } from '../fixed-record-source';

type ValueType<T extends Record<string, ValueData.NotAsync<unknown>>, K extends SRecord.KeyOf<T>> = T[K] extends ValueData.NotAsync<infer V> ? V : never;

export class GetValueFromFixedRecordSourceDemandObserver<T extends Record<string, ValueData.NotAsync<unknown>>, E extends MapRecord<T, any>, K extends SRecord.KeyOf<T>>
implements ValueSource.DemandObserver<ValueType<T, K>>, FixedRecordSource.EventReceiver<T, E> {
  constructor (
    private readonly source: FixedRecordSource<T>,
    private readonly key: K,
  ) {}
  #out: ValueSource.Manual<ValueType<T, K>>;
  #sub_record: FixedRecordSource.Subscription<T> | undefined;
  #sub_value: ValueSource.Subscription<ValueType<T, K>> | undefined;

  online (out: ValueSource.Manual<ValueType<T, K>>): void {
    this.#out = out;
    this.#sub_record = FixedRecordSource.subscribe(this.source, this);
    this._consume(this.#sub_record.__record[this.key]);
  }
  offline (out: ValueSource.Manual<ValueType<T, K>>): void {
    dispose(this.#sub_record!);
    this.#sub_record = undefined;
  }

  set (values: Partial<T>): void {
    if (this.key in values) {
      const source = values[this.key]!;
      this._consume(source);
    }
  }
  patch (changes: Partial<E>): void {
    if (this.key in changes) {
      const value = changes[this.key] as ValueType<T, K>;
      this.#out.set(value);
    }
  }
  batch (events: readonly FixedRecordSource.Event<T, E>[], receiver: FixedRecordSource.Receiver<T, E, any[]>): void {
    this.#out.hold();
    for (const event of events) {
      receiver.event(event);
    }
    this.#out.release();
  }

  _consume (source: T[K]): void {
    if (this.#sub_value) dispose(this.#sub_value);
    if (isValueSource(source)) {
      if (this.#sub_value) dispose(this.#sub_value);
      this.#sub_value = ValueSource.subscribe(source, this._set);
    }
    else {
      this.#out.set(source as ValueType<T, K>);
    }
  }
  _set = (value: ValueType<T, K>): void => {
    this.#out.set(value);
  };
}
