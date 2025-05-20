import { dispose } from '../../../general/disposables';
import type { AssociativeRecordSource } from './associative-record-source';

export const AssociativeRecordSourceTag: unique symbol = Symbol('AssociativeRecordSource');
export class AssociativeRecordSourceSubscription<V> implements AssociativeRecordSource.Subscription<V> {
  constructor (
    private readonly source: { readonly __record: Readonly<Record<string, V>> | undefined },
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

export interface InternalAssociativeRecordSource<V> extends AssociativeRecordSource<V> {
  readonly __record: Record<string, V>;
}
