import { disposeOnAbort } from '../../../general/disposables';
import { Subscribable } from '../../core/subscribable';
import type { ValueData } from '../../data';
import { ValueSource } from '../value-source/value-source';
import { FixedRecordSourceTag } from './common';
import { ManualFixedRecordSource } from './manual-fixed-record-source';
import { MappedFixedRecordSource } from './mapped-fixed-record-source';
import { MappedFixedRecordSourceA2, type RecordMapperA2 } from './mapped-fixed-record-source-a2';
import { GetValueFromFixedRecordSourceDemandObserver } from './projections/get-value-from-fixed-record-source';

export function isFixedRecordSource (source: any): source is FixedRecordSource<any, any> {
  return source?.[FixedRecordSourceTag] === true;
}

/**
 * To consume a `FixedRecordSource`:
 * - First define any state that needs to be maintained based on the record.
 * - Next call `subscribe` with an event handler function that will be invoked whenever the record changes. The method
 *   can optionally be passed additional tail arguments which will be forwarded to the event handler. This allows
 *   handler functions to be defined in advance without the need for closures around any state they will be managing.
 * - The `subscribe` method returns a `Subscription` object exposing the current record (read-only). This can be sampled
 *   on demand to get the current state of the record.
 */
export interface FixedRecordSource<TRecord extends AnyRecord, TEventPerField extends MapRecord<TRecord, unknown> = MapRecord<TRecord, unknown>> {
  readonly [FixedRecordSourceTag]: true;
  subscribe<A extends any[]> (onChange: FixedRecordSource.Subscriber<TRecord, TEventPerField, A>, ...args: A): FixedRecordSource.Subscription<TRecord>;
}
export namespace FixedRecordSource {
  export type RecordOf<TSource extends FixedRecordSource<any, any>> = TSource extends FixedRecordSource<infer TRecord, any> ? TRecord : never;
  export type Keys<TSource extends FixedRecordSource<any, any>> = keyof RecordOf<TSource>;
  export type ValueOf<TSource extends FixedRecordSource<any, any>, TKey extends Keys<TSource>> = RecordOf<TSource>[TKey] extends ValueData.NotAsync<infer V> ? V : never;

  export type Subscriber<TRecord extends AnyRecord, TEventPerField extends MapRecord<TRecord, unknown>, A extends any[]> = Receiver<TRecord, TEventPerField, A> | Receiver<TRecord, TEventPerField, A>['event'];
  export interface Receiver<TRecord extends AnyRecord, TEventPerField extends MapRecord<TRecord, unknown>, A extends any[]> extends Subscribable.Receiver<[event: FixedRecordSource.Event<TRecord, TEventPerField>], A> {
    init? (subscription: FixedRecordSource.Subscription<TRecord>, ...args: A): void;
  }
  export interface Subscription<TRecord extends AnyRecord> extends Disposable {
    readonly __record: Readonly<TRecord>;
  }

  export type Event<TRecord extends AnyRecord, TEventPerField extends MapRecord<TRecord, unknown> = MapRecord<TRecord, unknown>> =
    | Event.Set<TRecord>
    | Event.Patch<TEventPerField>
    | Event.Batch<TRecord, TEventPerField>;
  export namespace Event {
    export interface Set<TRecord extends AnyRecord> {
      readonly kind: 'set';
      readonly values: Partial<TRecord>;
    }

    export interface Patch<TEventPerField extends AnyRecord> {
      readonly kind: 'patch';
      readonly changes: Partial<TEventPerField>;
    }

    export interface Batch<TRecord extends AnyRecord, TEventPerField extends MapRecord<TRecord, unknown>> {
      readonly kind: 'batch';
      readonly events: readonly Event<TRecord, TEventPerField>[];
    }
  }

  export function subscribe<TRecord extends AnyRecord, TEventPerField extends MapRecord<TRecord, unknown>> (source: FixedRecordSource<TRecord, TEventPerField>, receiver: EventReceiver<TRecord, TEventPerField>): Subscription<TRecord>;
  export function subscribe<TRecord extends AnyRecord, TEventPerField extends MapRecord<TRecord, unknown>> (abort: AbortSignal, source: FixedRecordSource<TRecord, TEventPerField>, receiver: EventReceiver<TRecord, TEventPerField>): Subscription<TRecord>;
  export function subscribe<TRecord extends AnyRecord, TEventPerField extends MapRecord<TRecord, unknown>, A extends any[]> (abort: AbortSignal, source: FixedRecordSource<TRecord, TEventPerField>, receiver: Subscriber<TRecord, TEventPerField, A>, ...args: A): Subscription<TRecord>;
  export function subscribe<TRecord extends AnyRecord, TEventPerField extends MapRecord<TRecord, unknown>> (arg0: AbortSignal | FixedRecordSource<TRecord, TEventPerField>) {
    let abortSignal: AbortSignal | undefined;
    let source: FixedRecordSource<TRecord, TEventPerField>;
    let receiver: EventReceiver<TRecord, TEventPerField> | Subscriber<TRecord, TEventPerField, any[]>;
    let args: any[];
    if (arg0 instanceof AbortSignal) {
      abortSignal = arg0;
      source = arguments[1];
      receiver = arguments[2];
      args = Array.prototype.slice.call(arguments, 3);
    }
    else {
      source = arg0;
      receiver = arguments[1];
      args = Array.prototype.slice.call(arguments, 2);
    }
    if ('set' in receiver) receiver = new EventReceiverAdapter(receiver) as Receiver<TRecord, TEventPerField, any[]>;
    const sub = source.subscribe(receiver, ...args);
    if (abortSignal) {
      disposeOnAbort(abortSignal, sub);
    }
    return sub;
  }

  export interface EventReceiver<TRecord extends AnyRecord, TEventPerField extends MapRecord<TRecord, unknown>> {
    init? (subscription: FixedRecordSource.Subscription<TRecord>): void;
    set (values: Partial<TRecord>): void;
    patch (changes: Partial<TEventPerField>): void;
    batch (events: readonly Event<TRecord, TEventPerField>[], receiver: Receiver<TRecord, TEventPerField, any[]>): void;
    end? (): void;
    unsubscribed? (): void;
  }

  export class EventReceiverAdapter<TRecord extends AnyRecord, TEventPerField extends MapRecord<TRecord, unknown>> implements Receiver<TRecord, TEventPerField, any[]> {
    constructor (private readonly receiver: EventReceiver<TRecord, TEventPerField>) {}
    init (subscription: Subscription<TRecord>): void {
      this.receiver.init?.(subscription);
    }
    event (event: Event<TRecord, TEventPerField>): void {
      switch (event.kind) {
        case 'set': {
          this.receiver.set(event.values);
          break;
        }
        case 'patch': {
          this.receiver.patch(event.changes);
          break;
        }
        case 'batch': {
          this.receiver.batch(event.events, this);
          break;
        }
      }
    }
    end (): void {
      this.receiver.end?.();
    }
    unsubscribed (): void {
      this.receiver.unsubscribed?.();
    }
  }

  export interface Immediate<TRecord extends AnyRecord, TEventPerField extends MapRecord<TRecord, unknown> = MapRecord<TRecord, unknown>> extends FixedRecordSource<TRecord, TEventPerField> {
    readonly __record: Readonly<TRecord>;
  }
  export interface Manual<TRecord extends AnyRecord, TEventPerField extends MapRecord<TRecord, unknown> = MapRecord<TRecord, unknown>> extends Immediate<TRecord, TEventPerField> {
    set<K extends keyof TRecord> (key: K, value: TRecord[K]): void;
    set (changes: Partial<TRecord>): void;
  }
  export namespace Manual {
    export interface DemandObserver<TRecord extends AnyRecord, TEventPerField extends MapRecord<TRecord, unknown>> {
      online? (source: ManualFixedRecordSource<TRecord, TEventPerField>): void;
      offline? (source: ManualFixedRecordSource<TRecord, TEventPerField>): void;
      subscribe? (source: ManualFixedRecordSource<TRecord, TEventPerField>, receiver: Receiver<TRecord, TEventPerField, any[]>): void;
      unsubscribe? (source: ManualFixedRecordSource<TRecord, TEventPerField>, receiver: Receiver<TRecord, TEventPerField, any[]>): void;
    }
  }

  export function create<TRecord extends AnyRecord, TEventPerField extends MapRecord<TRecord, unknown> = MapRecord<TRecord, unknown>> (
    record: TRecord,
    onDemandChanged?: Manual.DemandObserver<TRecord, TEventPerField>
  ): Manual<TRecord, TEventPerField> {
    return new ManualFixedRecordSource(record, onDemandChanged);
  }

  /**
   * A `get` function for fields that hold either a raw value or a `ValueSource` containing the raw value. A
   * `ValueSource` is returned representing the raw value, regardless of whether the source holds it in a raw form or
   * delivers it via a `ValueSource`.
   */
  export function getAndUnboxValueDataField<TSource extends FixedRecordSource<{ [P in K]: ValueData<any> }, any>, K extends Keys<TSource>> (key: K, source: TSource): ValueOf<TSource, K>;
  export function getAndUnboxValueDataField (key: any, source: FixedRecordSource<any, any>): ValueSource<any> {
    const demandObserver = new GetValueFromFixedRecordSourceDemandObserver(source, key);
    // If it's not a FixedRecordSource.Immediate, the following will still work as expected.
    return ValueSource.create((source as any).__record, demandObserver);
  }

  export function map<
    TRecordA extends AnyRecord,
    TRecordB extends MapRecord<TRecordA, unknown>,
    TEventPerFieldA extends MapRecord<TRecordA, unknown>,
    TEventPerFieldB extends MapRecord<TRecordB, unknown>
  > (
    source: FixedRecordSource<TRecordA, TEventPerFieldA>,
    mappers: { [K in keyof TRecordA]: (value: TRecordA[K]) => TRecordB[K] },
    patch?: (record: TRecordB, changes: Partial<TEventPerFieldA>) => Partial<TEventPerFieldB>,
  ): FixedRecordSource<TRecordB, TEventPerFieldB> {
    return new MappedFixedRecordSource(source, mappers, patch);
  }

  export function mapA2<
    TRecordA extends AnyRecord,
    TRecordB extends { [K in keyof TRecordA]: TRecordB[K] },
    TMap extends { [K in keyof TRecordA]: (leftValue: TRecordA[K], rightValue: TRecordB[K]) => unknown },
    TEventPerFieldA extends MapRecord<TRecordA, unknown>,
    TEventPerFieldB extends MapRecord<TRecordB, unknown>,
    TEventPerFieldC extends MapRecord<TMap, unknown>
  > (
    leftSource: FixedRecordSource<TRecordA, TEventPerFieldA>,
    rightSource: FixedRecordSource<TRecordB, TEventPerFieldB>,
    map: TMap,
    patch?: {
      left: (record: RecordMapperA2<TMap>, changes: Partial<TEventPerFieldA>) => Partial<TEventPerFieldC>;
      right: (record: RecordMapperA2<TMap>, changes: Partial<TEventPerFieldB>) => Partial<TEventPerFieldC>;
    },
  ): FixedRecordSource<RecordMapperA2<TMap>, TEventPerFieldC>;
  export function mapA2<
    TRecordA extends AnyRecord,
    TRecordB extends { [K in keyof TRecordA]: TRecordB[K] },
    TMap extends (leftValue: TRecordA[keyof TRecordA], rightValue: TRecordB[keyof TRecordB]) => unknown,
    TEventPerFieldA extends MapRecord<TRecordA, unknown>,
    TEventPerFieldB extends MapRecord<TRecordB, unknown>,
    TEventPerFieldC extends MapRecord<TRecordA, unknown>
  > (
    leftSource: FixedRecordSource<TRecordA, TEventPerFieldA>,
    rightSource: FixedRecordSource<TRecordB, TEventPerFieldB>,
    map: TMap,
    patch?: {
      left: (record: MapRecord<TRecordA, ReturnType<TMap>>, changes: Partial<TEventPerFieldA>) => Partial<TEventPerFieldC>;
      right: (record: MapRecord<TRecordB, ReturnType<TMap>>, changes: Partial<TEventPerFieldB>) => Partial<TEventPerFieldC>;
    },
  ): FixedRecordSource<MapRecord<TRecordA, ReturnType<TMap>>, TEventPerFieldC>;
  export function mapA2<
    TRecordA extends AnyRecord,
    TRecordB extends { [K in keyof TRecordA]: TRecordB[K] },
    TMap extends { [K in keyof TRecordA]: (leftValue: TRecordA[K], rightValue: TRecordB[K]) => unknown },
    TEventPerFieldA extends MapRecord<TRecordA, unknown>,
    TEventPerFieldB extends MapRecord<TRecordB, unknown>,
    TEventPerFieldC extends MapRecord<TMap, unknown>
  > (
    leftSource: FixedRecordSource<TRecordA, TEventPerFieldA>,
    rightSource: FixedRecordSource<TRecordB, TEventPerFieldB>,
    map: TMap,
    patch?: {
      left: (record: RecordMapperA2<TMap>, changes: Partial<TEventPerFieldA>) => Partial<TEventPerFieldC>;
      right: (record: RecordMapperA2<TMap>, changes: Partial<TEventPerFieldB>) => Partial<TEventPerFieldC>;
    },
  ): FixedRecordSource<RecordMapperA2<TMap>, TEventPerFieldC> {
    return new MappedFixedRecordSourceA2(leftSource, rightSource, map, patch);
  }
}
