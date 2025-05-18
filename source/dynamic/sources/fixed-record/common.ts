import { dispose } from '../../../general/disposables';
import type { FixedRecordSource } from './fixed-record-source';

export const FixedRecordSourceTag: unique symbol = Symbol('FixedRecordSource');
export class FixedRecordSourceSubscription<TRecord extends AnyRecord> implements FixedRecordSource.Subscription<TRecord> {
  constructor (
    private readonly source: { readonly __record: Readonly<TRecord> | undefined },
    private readonly subscription: Disposable
  ) {}

  get __record () {
    if (this.#disposed) {
      throw new Error(`Cannot access record after the view has been disposed`);
    }
    return this.source.__record!;
  }

  #disposed = false;
  [Symbol.dispose] () {
    if (this.#disposed) return;
    this.#disposed = true;
    dispose(this.subscription);
  }
}

export interface InternalFixedRecordSource<TRecord extends AnyRecord, TEventPerField extends MapRecord<TRecord, unknown>> extends FixedRecordSource<TRecord, TEventPerField> {
  readonly __record: TRecord;
}
