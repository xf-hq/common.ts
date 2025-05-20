import { Subscribable } from '../../core/subscribable';
import { FixedRecordSourceSubscription, FixedRecordSourceTag, type InternalFixedRecordSource } from './common';
import type { FixedRecordSource } from './fixed-record-source';

export class ManualFixedRecordSource<TRecord extends AnyRecord, TEventPerField extends MapRecord<TRecord, unknown>> implements InternalFixedRecordSource<TRecord, TEventPerField>, FixedRecordSource.Manual<TRecord, TEventPerField> {
  constructor (initialRecord: TRecord, onDemandChanged?: FixedRecordSource.Manual.DemandObserver<TRecord>) {
    this.#record = initialRecord;
    this.#emitter = onDemandChanged
      ? new Subscribable.Controller(new ManualFixedRecordSource.DemandObserverAdapter(this, onDemandChanged))
      : new Subscribable.Controller();
  }
  readonly #emitter: Subscribable.Controller<[event: FixedRecordSource.Event<TRecord, TEventPerField>]>;
  readonly #record: TRecord;

    get [FixedRecordSourceTag] () { return true as const; }

  get __record () { return this.#record; }

  subscribe<A extends any[]> (onChange: FixedRecordSource.Subscriber<TRecord, TEventPerField, A>, ...args: A): FixedRecordSource.Subscription<TRecord> {
    const subscription = this.#emitter.subscribe(onChange, ...args);
    return new FixedRecordSourceSubscription<TRecord>(this, subscription);
  }

  set<K extends keyof TRecord> (keyOrValues: K | Partial<TRecord>, value?: TRecord[K]): void {
    if (typeof keyOrValues === 'object') {
      Object.assign(this.#record, keyOrValues);
      this.#emitter.signal({ kind: 'set', values: keyOrValues });
    }
    else {
      const values = { [keyOrValues]: value } as Partial<TRecord>;
      Object.assign(this.#record, values);
      this.#emitter.signal({ kind: 'set', values });
    }
  }

  static DemandObserverAdapter = class DemandObserverAdapter<TRecord extends AnyRecord> implements Subscribable.DemandObserver.ListenerInterface<[event: FixedRecordSource.Event<TRecord, any>]> {
    constructor (
      private readonly source: ManualFixedRecordSource<TRecord, any>,
      private readonly onDemandChanged: FixedRecordSource.Manual.DemandObserver<TRecord>
    ) {}
    online (): void { this.onDemandChanged.online?.(this.source); }
    offline (): void { this.onDemandChanged.offline?.(this.source); }
    subscribe (receiver: FixedRecordSource.Receiver<TRecord, any, any[]>): void { this.onDemandChanged.subscribe?.(this.source, receiver); }
    unsubscribe (receiver: FixedRecordSource.Receiver<TRecord, any, any[]>): void { this.onDemandChanged.unsubscribe?.(this.source, receiver); }
  };
}
