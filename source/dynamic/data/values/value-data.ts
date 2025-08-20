import { disposeOnAbort } from '../../../general/disposables';
import { Async, isAsync } from '../../async/async';
import { isOnDemandAsync, OnDemandAsync } from '../../async/on-demand-async';
import { isValueSource, ValueSource } from '../../sources';

export type ValueData<T> = ValueData.ExplicitAsync<T> | ValueData.NotAsync<T>;
export namespace ValueData {
  export type ExplicitAsync<T> = Async<NotAsync<T>> | OnDemandAsync<NotAsync<T>>;
  export type NotAsync<T> = ValueSource<T> | Exclude<T, ValueSource<T>>;
  export type Immediate<T> =
    | ValueSource.Immediate<T>
    | Exclude<T, ValueSource.Immediate<T>>;

  export function snapshot<T> (source: Immediate<T>): T {
    return isValueSource(source) ? source.value : source;
  }

  export function unboxInto<T> (out: ValueSource.Manual<T>, source: ValueData<T>, options: { abortSignal: AbortSignal; freeze: boolean }) {
    if (isOnDemandAsync(source)) {
      const async = source.require();
      disposeOnAbort(options.abortSignal, async);
      unboxInto(out, async, options);
    }
    else if (isAsync(source)) {
      if (source.finalized) return unboxInto(out, source.result, options);
      source.then((_source) => {
        if (options.abortSignal.aborted) return;
        unboxInto(out, _source, options);
      });
    }
    else if (isValueSource(source)) {
      if (ValueSource.isImmediate(source) && source.isFinalized) {
        out.set(source.value);
        if (options.freeze) out.freeze();
        return;
      }
      ValueSource.subscribe(options.abortSignal, source, new Receiver(out, options));
    }
    else {
      out.set(source);
      if (options.freeze) out.freeze();
    }
  }

  export function toSource<T> (data: ValueData<T>): ValueSource<T> {
    return ValueSource.onDemand(new ValueDataDemandObserver(data));
  }
}

class Receiver<T> implements ValueSource.Receiver<T> {
  constructor (
    private readonly out: ValueSource.Manual<T>,
    private readonly options: { abortSignal: AbortSignal; freeze: boolean }
  ) {}

  init (subscription: ValueSource.Subscription<T>) {
    this.out.set(subscription.value);
    if (subscription.isFinalized && this.options.freeze) this.out.freeze();
  }
  event (value: T) {
    if (this.options.abortSignal.aborted) return;
    this.out.set(value);
  }
  end () {
    if (this.options.freeze) this.out.freeze();
  }
}

class ValueDataDemandObserver<T> implements ValueSource.Manual.DemandObserver<T> {
  constructor (
    private readonly source: ValueData<T>,
  ) {}
  #abortController: AbortController;

  online (out: ValueSource.Manual<T>) {
    this.#abortController = new AbortController();
    ValueData.unboxInto(out, this.source, { abortSignal: this.#abortController.signal, freeze: true });
  }
  offline () {
    this.#abortController.abort();
  }
}