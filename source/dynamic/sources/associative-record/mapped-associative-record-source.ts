import { dispose } from '../../../general/disposables';
import { throwError } from '../../../general/errors';
import { bindMethod } from '../../../general/functional';
import { Subscribable } from '../../core/subscribable';
import type { AssociativeRecordSource } from './associative-record-source';
import { AssociativeRecordSourceSubscription, AssociativeRecordSourceTag, type InternalAssociativeRecordSource } from './common';

export class MappedAssociativeRecordSource<VA, VB> implements InternalAssociativeRecordSource<VB>, Subscribable.Receiver<[event: AssociativeRecordSource.Event<VA>]> {
  constructor (f: (a: VA) => VB, source: AssociativeRecordSource<VA>) {
    this.#f = f;
    this.#source = source;
  }
  readonly #f: (a: VA) => VB;
  readonly #source: AssociativeRecordSource<VA>;
  readonly #emitter = new Subscribable.Controller<[event: AssociativeRecordSource.Event<VB>]>(bindMethod(this.onDemandChange, this));
  #upstreamSubscription: AssociativeRecordSource.Subscription<VA> | undefined;
  #mappedRecord: Record<string, VB> | undefined;

    get [AssociativeRecordSourceTag] () { return true as const; }

  /** @internal */
  get __record () { return this.#mappedRecord ??= throwError('Internal record not initialized.'); }

  subscribe<A extends any[]> (onChange: AssociativeRecordSource.Subscriber<VB, A>, ...args: A): AssociativeRecordSource.Subscription<VB> {
    const subscription = this.#emitter.subscribe(onChange, ...args);
    return new AssociativeRecordSourceSubscription(this, subscription);
  }

  onDemandChange (event: Subscribable.DemandObserver.Event): void {
    switch (event) {
      case 'online': this.online(); break;
      case 'offline': this.offline(); break;
    }
  }

  online () {
    this.#upstreamSubscription = this.#source.subscribe(this);
    this.#mappedRecord = {};
    const source = this.#upstreamSubscription.__record;
    for (const key in source) {
      this.#mappedRecord[key] = this.mapValue(source[key]);
    }
  }

  offline () {
    dispose(this.#upstreamSubscription!);
    this.#upstreamSubscription = undefined;
    this.#mappedRecord = undefined;
  }

  signal (event: AssociativeRecordSource.Event<VA>): void {
    const record = this.#mappedRecord!;
    switch (event.kind) {
      case 'set': {
        const mappedChanges: Record<string, VB> = {};
        for (const [key, value] of Object.entries(event.changes)) {
          mappedChanges[key] = this.mapValue(value);
        }
        Object.assign(record, mappedChanges);
        this.#emitter.signal({ kind: 'set', changes: mappedChanges });
        break;
      }
      case 'delete': {
        delete record[event.key];
        this.#emitter.signal({ kind: 'delete', key: event.key });
        break;
      }
      case 'clear': {
        for (const key in record) {
          delete record[key];
        }
        this.#emitter.signal({ kind: 'clear', previousSize: event.previousSize });
        break;
      }
    }
  }

  mapValue (value: VA): VB {
    return this.#f(value);
  }
}
