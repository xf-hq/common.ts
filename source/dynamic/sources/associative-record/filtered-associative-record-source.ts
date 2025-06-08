import { dispose } from '../../../general/disposables';
import { throwError } from '../../../general/errors';
import { bindMethod } from '../../../general/functional';
import { Subscribable } from '../../core/subscribable';
import type { AssociativeRecordSource } from './associative-record-source';
import { AssociativeRecordSourceSubscription, AssociativeRecordSourceTag, type InternalAssociativeRecordSource } from './common';

export class FilteredAssociativeRecordSource<V> implements InternalAssociativeRecordSource<V>, Subscribable.Receiver<[event: AssociativeRecordSource.Event<V>]> {
  constructor (f: (value: V, key: string) => boolean, source: AssociativeRecordSource<V>) {
    this.#f = f;
    this.#source = source;
  }
  readonly #f: (value: V, key: string) => boolean;
  readonly #source: AssociativeRecordSource<V>;
  readonly #emitter = new Subscribable.Controller<[event: AssociativeRecordSource.Event<V>]>(bindMethod(this.onDemandChange, this));
  #upstreamSubscription: AssociativeRecordSource.Subscription<V> | undefined;
  #filteredRecord: Record<string, V> | undefined;

  get [AssociativeRecordSourceTag] () { return true as const; }

  /** @internal */
  get __record () { return this.#filteredRecord ??= throwError('Internal record not initialized.'); }

  subscribe<A extends any[]> (onChange: AssociativeRecordSource.Subscriber<V, A>, ...args: A): AssociativeRecordSource.Subscription<V> {
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
    this.#filteredRecord = {};
    const source = this.#upstreamSubscription.__record;
    for (const key in source) {
      const value = source[key];
      if (this.testValue(value, key)) {
        this.#filteredRecord[key] = value;
      }
    }
  }

  offline () {
    dispose(this.#upstreamSubscription!);
    this.#upstreamSubscription = undefined;
    this.#filteredRecord = undefined;
  }

  signal (event: AssociativeRecordSource.Event<V>): void {
    const record = this.#filteredRecord!;
    switch (event.kind) {
      case 'set': {
        const filteredChanges: Record<string, V> = {};
        const deletedKeys: string[] = [];

        for (const [key, value] of Object.entries(event.changes)) {
          const passes = this.testValue(value, key);
          if (passes) {
            filteredChanges[key] = value;
          }
          else if (key in record) {
            deletedKeys.push(key);
          }
        }

        if (Object.keys(filteredChanges).length > 0) {
          Object.assign(record, filteredChanges);
          this.#emitter.signal({ kind: 'set', changes: filteredChanges });
        }

        for (const key of deletedKeys) {
          delete record[key];
          this.#emitter.signal({ kind: 'delete', key });
        }
        break;
      }
      case 'delete': {
        if (event.key in record) {
          delete record[event.key];
          this.#emitter.signal(event);
        }
        break;
      }
      case 'clear': {
        const previousSize = Object.keys(record).length;
        if (previousSize > 0) {
          for (const key in record) {
            delete record[key];
          }
          this.#emitter.signal({ kind: 'clear', previousSize });
        }
        break;
      }
    }
  }

  testValue (value: V, key: string): boolean {
    return this.#f(value, key);
  }
}
