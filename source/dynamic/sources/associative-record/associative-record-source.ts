import { disposeOnAbort } from '../../../general/disposables';
import { Subscribable } from '../../core/subscribable';
import { AssociativeRecordSourceTag } from './common';
import { FilteredAssociativeRecordSource } from './filtered-associative-record-source';
import { ManualAssociativeRecordSource } from './manual-associative-record-source';
import { MappedAssociativeRecordSource } from './mapped-associative-record-source';

export function isAssociativeRecordSource (value: any): value is AssociativeRecordSource<any> {
  return value?.[AssociativeRecordSourceTag] === true;
}

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
  export type Subscriber<V, A extends any[]> = Receiver<V, A> | Receiver<V, A>['event'];
  export interface Receiver<V, A extends any[] = []> extends Subscribable.Receiver<[event: AssociativeRecordSource.Event<V>], A> {
    init? (subscription: Subscription<V>, ...args: A): void;
  }
  export interface Subscription<V> extends Disposable {
    readonly __record: Readonly<Record<string, V>>;
  }

  export interface Event<V> {
    readonly add: Readonly<Record<string, V>> | null;
    readonly change: Readonly<Record<string, V>> | null;
    readonly delete: ReadonlyArray<string> | null;
  }
  export type DraftEvent<V> = {
    add: Record<string, V> | null;
    change: Record<string, V> | null;
    delete: string[] | null;
  };

  export function subscribe<V, A extends any[]> (abort: AbortSignal, source: AssociativeRecordSource<V>, receiver: Subscriber<V, A>, ...args: A): Subscription<V> {
    const sub = source.subscribe(receiver, ...args);
    disposeOnAbort(abort, sub);
    return sub;
  }

  export interface Immediate<V> extends AssociativeRecordSource<V> {
    readonly __record: Readonly<Record<string, V>>;
  }
  export interface Manual<V> extends Immediate<V> {
    hold (): void;
    release (): void;

    set (key: string, value: V): void;
    set (assignments: Record<string, V> | null, deletions?: string[] | null): void;
    delete (key: string): boolean;
    delete (keys: string[]): boolean;
    clear (): void;

    has (key: string): boolean;
    get (key: string): V | undefined;
    getOrThrow (key: string): V;
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
