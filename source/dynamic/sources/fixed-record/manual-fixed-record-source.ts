import { Subscribable } from '../../core/subscribable';
import { FixedRecordSourceSubscription, FixedRecordSourceTag, type InternalFixedRecordSource } from './common';
import type { FixedRecordSource } from './fixed-record-source';

export class ManualFixedRecordSource<TRecord extends AnyRecord, TEventPerField extends MapRecord<TRecord, unknown>>
implements InternalFixedRecordSource<TRecord, TEventPerField>, FixedRecordSource.Manual<TRecord, TEventPerField> {
  constructor (initialRecord: TRecord, onDemandChanged?: FixedRecordSource.Manual.DemandObserver<TRecord, TEventPerField>) {
    this.#record = initialRecord;
    this.#emitter = onDemandChanged
      ? new Subscribable.Controller(new ManualFixedRecordSource.DemandObserverAdapter(this, onDemandChanged))
      : new Subscribable.Controller();
  }
  readonly #emitter: Subscribable.Controller<[event: FixedRecordSource.Event<TRecord, TEventPerField>]>;
  readonly #status = new Subscribable.SignalStatus<[FixedRecordSource.Event<TRecord, TEventPerField>]>();
  readonly #record: TRecord;

  get [FixedRecordSourceTag] () { return true as const; }

  get __record () { return this.#record; }

  subscribe<A extends any[]> (onChange: FixedRecordSource.Subscriber<TRecord, TEventPerField, A>, ...args: A): FixedRecordSource.Subscription<TRecord> {
    const subscription = this.#emitter.subscribe(onChange, ...args);
    return new FixedRecordSourceSubscription<TRecord>(this, subscription);
  }

  hold (): void {
    if (this.#status.initiateHold()) {
      this.#emitter.hold();
    }
  }
  release (): void {
    if (this.#status.releaseHold()) {
      for (const [event] of this.#status.flush()) {
        this._pushEvent(event);
      }
      this.#emitter.release();
    }
  }

  private _pushEvent (event: FixedRecordSource.Event<TRecord, TEventPerField>) {
    this.#emitter.event(event);
  }

  set<K extends keyof TRecord> (keyOrValues: K | Partial<TRecord>, value?: TRecord[K]): void {
    if (typeof keyOrValues === 'object') {
      Object.assign(this.#record, keyOrValues);
      if (this.#emitter.demandExists) {
        const event: FixedRecordSource.Event<TRecord, TEventPerField> = { kind: 'set', values: keyOrValues };
        if (this.#status.isOnHold) {
          this.#status.holdEvent(event);
        }
        else {
          this._pushEvent(event);
        }
      }
    }
    else {
      const values = { [keyOrValues]: value } as Partial<TRecord>;
      Object.assign(this.#record, values);
      if (this.#emitter.demandExists) {
        const event: FixedRecordSource.Event<TRecord, TEventPerField> = { kind: 'set', values };
        if (this.#status.isOnHold) {
          this.#status.holdEvent(event);
        }
        else {
          this._pushEvent(event);
        }
      }
    }
  }

  static DemandObserverAdapter = class DemandObserverAdapter<TRecord extends AnyRecord, TEventPerField extends MapRecord<TRecord, unknown>>
  implements Subscribable.DemandObserver.ListenerInterface<[event: FixedRecordSource.Event<TRecord, TEventPerField>]> {
    constructor (
      private readonly source: ManualFixedRecordSource<TRecord, TEventPerField>,
      private readonly onDemandChanged: FixedRecordSource.Manual.DemandObserver<TRecord, TEventPerField>
    ) {}
    online (): void { this.onDemandChanged.online?.(this.source); }
    offline (): void { this.onDemandChanged.offline?.(this.source); }
    subscribe (receiver: FixedRecordSource.Receiver<TRecord, TEventPerField, any[]>): void { this.onDemandChanged.subscribe?.(this.source, receiver); }
    unsubscribe (receiver: FixedRecordSource.Receiver<TRecord, TEventPerField, any[]>): void { this.onDemandChanged.unsubscribe?.(this.source, receiver); }
  };
}
