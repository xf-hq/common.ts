import { Subscribable } from '../../core/subscribable';
import { AssociativeRecordSourceTag } from './common';
import { FilteredAssociativeRecordSource } from './filtered-associative-record-source';
import { ManualAssociativeRecordSource } from './manual-associative-record-source';
import { MappedAssociativeRecordSource } from './mapped-associative-record-source';

/**
 * To consume a `AssociativeRecordSource`:
 * - First define any state that needs to be maintained based on the record.
 * - Next call `subscribe` with an event handler function that will be invoked whenever the record changes. The method
 *   can optionally be passed additional tail arguments which will be forwarded to the event handler. This allows
 *   handler functions to be defined in advance without the need for closures around any state they will be managing.
 * - The `subscribe` method returns a `Subscription` object exposing the current record (read-only). This can be sampled
 *   on demand to get the current state of the record.
 */
export interface AssociativeRecordSource<V> {
  readonly [AssociativeRecordSourceTag]: true;
  subscribe<A extends any[]> (onChange: AssociativeRecordSource.Subscriber<V, A>, ...args: A): AssociativeRecordSource.Subscription<V>;
}
export namespace AssociativeRecordSource {
  export type Subscriber<V, A extends any[]> = Subscribable.Subscriber<[event: AssociativeRecordSource.Event<V>], A>;
  export interface Subscription<V> extends Disposable {
    readonly __record: Readonly<Record<string, V>>;
  }

  export type Event<V> = Event.Set<V> | Event.Delete | Event.Clear;
  export namespace Event {
    interface BaseEvent<T extends string> {
      readonly kind: T;
    }
    export interface Set<V> extends BaseEvent<'set'> {
      readonly changes: Readonly<Record<string, V>>;
    }
    export interface Delete extends BaseEvent<'delete'> {
      readonly key: string;
    }
    export interface Clear extends BaseEvent<'clear'> {
      readonly previousSize: number;
    }
  }

  export interface Manual<V> extends AssociativeRecordSource<V> {
    readonly __record: Record<string, V>;
    set (key: string, value: V): void;
    set (changes: Record<string, V>): void;
    delete (key: string): boolean;
    clear (): void;
  }

  export function create<V> (record: Record<string, V> = {}): Manual<V> {
    return new ManualAssociativeRecordSource(record);
  }

  export function map<VA, VB> (f: (a: VA) => VB, source: AssociativeRecordSource<VA>): AssociativeRecordSource<VB> {
    return new MappedAssociativeRecordSource(f, source);
  }

  export function filter<V> (f: (value: V, key: string) => boolean, source: AssociativeRecordSource<V>): AssociativeRecordSource<V> {
    return new FilteredAssociativeRecordSource(f, source);
  }
}
