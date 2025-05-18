import { Subscribable } from '../../core/subscribable';
import { FixedRecordSourceTag } from './common';
import { ManualFixedRecordSource } from './manual-fixed-record-source';
import { MappedFixedRecordSourceA2, type RecordMapperA2 } from './mapped-fixed-record-source-a2';
import { MappedFixedRecordSource } from './mapped-fixed-record-source';

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
  export type Subscriber<TRecord extends AnyRecord, TEventPerField extends MapRecord<TRecord, unknown>, A extends any[]>
    = Subscribable.Subscriber<[event: FixedRecordSource.Event<TRecord, TEventPerField>], A>;
  export type Receiver<TRecord extends AnyRecord, TEventPerField extends MapRecord<TRecord, unknown>, A extends any[]>
    = Subscribable.Receiver<[event: FixedRecordSource.Event<TRecord, TEventPerField>], A>;
  export interface Subscription<TRecord extends AnyRecord> extends Disposable {
    readonly __record: Readonly<TRecord>;
  }

  // export interface DemandObserver<T> {
  //   online? (source: ManualValueSource<T>): void;
  //   offline? (source: ManualValueSource<T>): void;
  //   subscribe? (source: ManualValueSource<T>, receiver: Receiver<T, unknown[]>): void;
  //   unsubscribe? (source: ManualValueSource<T>, receiver: Receiver<T, unknown[]>): void;
  // }
  // class DemandObserverAdapter<T> implements Subscribable.DemandObserver.ListenerInterface<[value: T]> {
  //   constructor (
  //     private readonly source: ManualValueSource<T>,
  //     private readonly onDemandChanged: DemandObserver<T>
  //   ) {}
  //   online (): void { this.onDemandChanged.online?.(this.source); }
  //   offline (): void { this.onDemandChanged.offline?.(this.source); }
  //   subscribe (receiver: Receiver<T, unknown[]>): void { this.onDemandChanged.subscribe?.(this.source, receiver); }
  //   unsubscribe (receiver: Receiver<T, unknown[]>): void { this.onDemandChanged.unsubscribe?.(this.source, receiver); }
  // }

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
      readonly events: ReadonlyArray<Event<TRecord, TEventPerField>>;
    }
  }

  export interface Manual<TRecord extends AnyRecord, TEventPerField extends MapRecord<TRecord, unknown> = MapRecord<TRecord, unknown>> extends FixedRecordSource<TRecord, TEventPerField> {
    readonly __record: Readonly<TRecord>;
    set<K extends keyof TRecord> (key: K, value: TRecord[K]): void;
    set (changes: Partial<TRecord>): void;
  }
  export namespace Manual {
    export interface DemandObserver<TRecord extends AnyRecord> {
      online? (source: ManualFixedRecordSource<TRecord, any>): void;
      offline? (source: ManualFixedRecordSource<TRecord, any>): void;
      subscribe? (source: ManualFixedRecordSource<TRecord, any>, receiver: Receiver<TRecord, any, any[]>): void;
      unsubscribe? (source: ManualFixedRecordSource<TRecord, any>, receiver: Receiver<TRecord, any, any[]>): void;
    }
  }

  export function create<TRecord extends AnyRecord, TEventPerField extends MapRecord<TRecord, unknown> = MapRecord<TRecord, unknown>> (
    record: TRecord,
    onDemandChanged?: Manual.DemandObserver<TRecord>
  ): Manual<TRecord, TEventPerField> {
    return new ManualFixedRecordSource(record, onDemandChanged);
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
