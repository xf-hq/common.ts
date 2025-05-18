import { bindMethod } from '../../../general/functional';
import { isUndefined } from '../../../general/type-checking';
import { dispose } from '../../../general/disposables';
import { Subscribable } from '../../core/subscribable';
import { FixedRecordSourceSubscription, FixedRecordSourceTag } from './common';
import type { FixedRecordSource } from './fixed-record-source';

export class MappedFixedRecordSource<
  TRecordA extends AnyRecord,
  TRecordB extends MapRecord<TRecordA, unknown>,
  TEventPerFieldA extends MapRecord<TRecordA, unknown>,
  TEventPerFieldB extends MapRecord<TRecordB, unknown>
> implements FixedRecordSource<TRecordB, TEventPerFieldB> {
  constructor (
    private readonly source: FixedRecordSource<TRecordA, TEventPerFieldA>,
    private readonly mappers: { [K in keyof TRecordA]: (value: TRecordA[K]) => TRecordB[K] },
    private readonly patch?: (record: TRecordB, changes: Partial<TEventPerFieldA>) => Partial<TEventPerFieldB>,
  ) {}

  readonly #emitter = new Subscribable.Controller<[event: FixedRecordSource.Event<TRecordB, TEventPerFieldB>]>(bindMethod(this.onDemandChange, this));
  #upstreamSubscription: FixedRecordSource.Subscription<TRecordA> | undefined;
  #mappedRecord: TRecordB | undefined;

    get [FixedRecordSourceTag] () { return true as const; }

  get __record (): Readonly<TRecordB> { return this.#mappedRecord!; }

  subscribe<A extends any[]> (onChange: FixedRecordSource.Subscriber<TRecordB, TEventPerFieldB, A>, ...args: A): FixedRecordSource.Subscription<TRecordB> {
    const subscription = this.#emitter.subscribe(onChange, ...args);
    return new FixedRecordSourceSubscription(this, subscription);
  }

  onDemandChange (event: Subscribable.DemandObserver.Event): void {
    switch (event) {
      case 'online': this.online(); break;
      case 'offline': this.offline(); break;
    }
  }

  online () {
    this.#upstreamSubscription = this.source.subscribe(this);
    this.#mappedRecord = this.mapValues(this.#upstreamSubscription.__record) as TRecordB;
  }

  offline () {
    dispose(this.#upstreamSubscription!);
    this.#upstreamSubscription = undefined;
    this.#mappedRecord = undefined;
  }

  signal (event: FixedRecordSource.Event<TRecordA, TEventPerFieldA>): void {
    const mappedEvent = this.applyEvent(event);
    this.#emitter.signal(mappedEvent);
  }

  private applyEvent (event: FixedRecordSource.Event<TRecordA, TEventPerFieldA>): FixedRecordSource.Event<TRecordB, TEventPerFieldB> {
    switch (event.kind) {
      case 'set': {
        const mappedValues = this.mapValues(event.values);
        Object.assign(this.#mappedRecord!, mappedValues);
        return { kind: 'set', values: mappedValues };
      }
      case 'patch': {
        if (isUndefined(this.patch)) throw new Error(`This mapped record source does not support patching`);
        const mappedChanges = this.patch(this.#mappedRecord!, event.changes);
        return { kind: 'patch', changes: mappedChanges };
      }
      case 'batch': {
        const mappedEvents = event.events.map(bindMethod(this.applyEvent, this));
        return { kind: 'batch', events: mappedEvents };
      }
    }
  }

  private mapValues (values: Partial<TRecordA>): Partial<TRecordB> {
    const mappedValues = {} as any;
    for (const key in values) {
      const map = this.mappers[key] as (value: any) => any;
      mappedValues[key] = map(values[key]);
    }
    return mappedValues;
  }
}
