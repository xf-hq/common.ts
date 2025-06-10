import { bindMethod } from '../../../general/functional';
import { isFunction, isUndefined } from '../../../general/type-checking';
import { dispose } from '../../../general/disposables';
import { Subscribable } from '../../core/subscribable';
import { FixedRecordSourceSubscription, FixedRecordSourceTag } from './common';
import type { FixedRecordSource } from './fixed-record-source';

export type RecordMapperA2<TMap extends Record<keyof any, (left: any, right: any) => any>> = { [K in keyof TMap]: ReturnType<TMap[K]> };

export class MappedFixedRecordSourceA2<
  TRecordA extends AnyRecord,
  TRecordB extends AnyRecord,
  TMap extends { [K in keyof TRecordA]: (leftValue: TRecordA[K], rightValue: TRecordB[K]) => unknown },
  TEventPerFieldA extends MapRecord<TRecordA, unknown>,
  TEventPerFieldB extends MapRecord<TRecordB, unknown>,
  TEventPerFieldC extends { [K in keyof RecordMapperA2<TMap>]: unknown }
> implements FixedRecordSource<RecordMapperA2<TMap>, TEventPerFieldC> {
  constructor (
    private readonly leftSource: FixedRecordSource<TRecordA, TEventPerFieldA>,
    private readonly rightSource: FixedRecordSource<TRecordB, TEventPerFieldB>,
    private readonly map: TMap | ((leftValue: TRecordA[keyof TRecordA], rightValue: TRecordB[keyof TRecordB]) => RecordMapperA2<TMap>[keyof RecordMapperA2<TMap>]),
    private readonly patch?: {
      left: (record: RecordMapperA2<TMap>, changes: Partial<TEventPerFieldA>) => Partial<TEventPerFieldC>;
      right: (record: RecordMapperA2<TMap>, changes: Partial<TEventPerFieldB>) => Partial<TEventPerFieldC>;
    },
  ) {}

  readonly #emitter = new Subscribable.Controller<[event: FixedRecordSource.Event<RecordMapperA2<TMap>, TEventPerFieldC>]>(bindMethod(this.onDemandChange, this));
  #leftSubscription: FixedRecordSource.Subscription<TRecordA> | undefined;
  #rightSubscription: FixedRecordSource.Subscription<TRecordB> | undefined;
  #mappedRecord: RecordMapperA2<TMap> | undefined;

  get [FixedRecordSourceTag] () { return true as const; }

  get __record (): Readonly<RecordMapperA2<TMap>> { return this.#mappedRecord!; }

  subscribe<A extends any[]> (onChange: FixedRecordSource.Subscriber<RecordMapperA2<TMap>, TEventPerFieldC, A>, ...args: A): FixedRecordSource.Subscription<RecordMapperA2<TMap>> {
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
    this.#leftSubscription = this.leftSource.subscribe(bindMethod(this.signalA, this));
    this.#rightSubscription = this.rightSource.subscribe(bindMethod(this.signalB, this));
    const mappedRecord = {} as RecordMapperA2<TMap>;
    const recordA = this.#leftSubscription.__record;
    const recordB = this.#rightSubscription.__record;
    for (const key in recordA) {
      mappedRecord[key] = this.mapValue(key, recordA[key], recordB[key]);
    }
    this.#mappedRecord = mappedRecord;
  }

  offline () {
    dispose(this.#leftSubscription!);
    dispose(this.#rightSubscription!);
    this.#leftSubscription = undefined;
    this.#rightSubscription = undefined;
    this.#mappedRecord = undefined;
  }

  signalA (event: FixedRecordSource.Event<TRecordA, TEventPerFieldA>): void {
    const mappedEvent = this.applyEventA(event);
    this.#emitter.event(mappedEvent);
  }
  signalB (event: FixedRecordSource.Event<TRecordB, TEventPerFieldB>): void {
    const mappedEvent = this.applyEventB(event);
    this.#emitter.event(mappedEvent);
  }

  private applyEventA (event: FixedRecordSource.Event<TRecordA, TEventPerFieldA>): FixedRecordSource.Event<RecordMapperA2<TMap>, TEventPerFieldC> {
    switch (event.kind) {
      case 'set': {
        const mappedValues = this.mapValuesA(event.values);
        Object.assign(this.#mappedRecord!, mappedValues);
        return { kind: 'set', values: mappedValues };
      }
      case 'patch': {
        if (isUndefined(this.patch)) throw new Error(`This mapped record source does not support patching`);
        const mappedChanges = this.patch.left(this.#mappedRecord!, event.changes);
        return { kind: 'patch', changes: mappedChanges };
      }
      case 'batch': {
        const mappedEvents = event.events.map(bindMethod(this.applyEventA, this));
        return { kind: 'batch', events: mappedEvents };
      }
    }
  }

  private applyEventB (event: FixedRecordSource.Event<TRecordB, TEventPerFieldB>): FixedRecordSource.Event<RecordMapperA2<TMap>, TEventPerFieldC> {
    switch (event.kind) {
      case 'set': {
        const mappedValues = this.mapValuesB(event.values);
        Object.assign(this.#mappedRecord!, mappedValues);
        return { kind: 'set', values: mappedValues };
      }
      case 'patch': {
        if (isUndefined(this.patch)) throw new Error(`This mapped record source does not support patching`);
        const mappedChanges = this.patch.right(this.#mappedRecord!, event.changes);
        return { kind: 'patch', changes: mappedChanges };
      }
      case 'batch': {
        const mappedEvents = event.events.map(bindMethod(this.applyEventB, this));
        return { kind: 'batch', events: mappedEvents };
      }
    }
  }

  private mapValue (key: any, left: any, right: any): any {
    const map = isFunction(this.map) ? this.map : this.map[key];
    return map(left, right);
  }
  private mapValuesA (values: Partial<TRecordA>): Partial<RecordMapperA2<TMap>> {
    const mappedValues = {} as any;
    for (const key in values) {
      mappedValues[key] = this.mapValue(key, values[key], this.#rightSubscription?.__record[key]);
    }
    return mappedValues;
  }

  private mapValuesB (values: Partial<TRecordB>): Partial<RecordMapperA2<TMap>> {
    const mappedValues = {} as any;
    for (const key in values) {
      mappedValues[key] = this.mapValue(key, this.#leftSubscription?.__record[key], values[key]);
    }
    return mappedValues;
  }
}
