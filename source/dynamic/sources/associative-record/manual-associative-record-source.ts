import { Subscribable } from '../../core/subscribable';
import type { AssociativeRecordSource } from './associative-record-source';
import { AssociativeRecordSourceSubscription, AssociativeRecordSourceTag, type InternalAssociativeRecordSource } from './common';

export class ManualAssociativeRecordSource<V> implements InternalAssociativeRecordSource<V>, AssociativeRecordSource.Manual<V> {
  constructor (initialRecord: Record<string, V> = {}) {
    this.#record = initialRecord;
  }
  readonly #emitter = new Subscribable.Controller<[event: AssociativeRecordSource.Event<V>]>();
  readonly #record: Record<string, V>;

    get [AssociativeRecordSourceTag] () { return true as const; }

  get __record () { return this.#record; }

  subscribe<A extends any[]> (onChange: AssociativeRecordSource.Subscriber<V, A>, ...args: A): AssociativeRecordSource.Subscription<V> {
    const subscription = this.#emitter.subscribe(onChange, ...args);
    return new AssociativeRecordSourceSubscription(this, subscription);
  }

  set (keyOrChanges: string | Record<string, V>, value?: V): void {
    if (typeof keyOrChanges === 'string') {
      const key = keyOrChanges;
      const changes = { [key]: value! };
      Object.assign(this.#record, changes);
      this.#emitter.signal({ kind: 'set', changes });
    }
    else {
      Object.assign(this.#record, keyOrChanges);
      this.#emitter.signal({ kind: 'set', changes: keyOrChanges });
    }
  }

  delete (key: string): boolean {
    if (!(key in this.#record)) return false;
    delete this.#record[key];
    this.#emitter.signal({ kind: 'delete', key });
    return true;
  }

  clear (): void {
    const previousSize = Object.keys(this.#record).length;
    if (previousSize === 0) return;
    for (const key in this.#record) {
      delete this.#record[key];
    }
    this.#emitter.signal({ kind: 'clear', previousSize });
  }
}
