import { dispose } from '../../../general/disposables';
import { throwError } from '../../../general/errors';
import { bindMethod } from '../../../general/functional';
import { Subscribable } from '../../core/subscribable';
import type { AssociativeRecordSource } from './associative-record-source';
import { AssociativeRecordSourceSubscription, AssociativeRecordSourceTag } from './common';

export class FilteredAssociativeRecordSource<V> implements AssociativeRecordSource.Immediate<V>, Subscribable.Receiver<[event: AssociativeRecordSource.Event<V>]> {
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

  event (event: AssociativeRecordSource.Event<V>): void {
    const filteredRecord = this.#filteredRecord!;
    let filteredAdditions: Record<string, V> | null = null;
    let filteredChanges: Record<string, V> | null = null;
    let filteredDeletions: Set<string> | null = null;

    if (event.add) {
      for (const key in event.add) {
        const value = event.add[key];
        if (this.testValue(value, key)) {
          filteredRecord[key] = value;
          (filteredAdditions ??= {})[key] = value;
        }
      }
    }

    if (event.change) {
      for (const key in event.change) {
        const value = event.change[key];
        if (this.testValue(value, key)) {
          filteredRecord[key] = value;
          (filteredChanges ??= {})[key] = value;
        }
        else if (key in filteredRecord) {
          delete filteredRecord[key];
          (filteredDeletions ??= new Set()).add(key);
        }
      }
    }

    if (event.delete) {
      for (const key of event.delete) {
        if (key in filteredRecord) {
          delete filteredRecord[key];
          (filteredDeletions ??= new Set()).add(key);
        }
      }
    }

    if (filteredAdditions || filteredChanges || filteredDeletions) {
      this.#emitter.event({
        add: filteredAdditions,
        change: filteredChanges,
        delete: filteredDeletions ? [...filteredDeletions] : null,
      });
    }
  }

  testValue (value: V, key: string): boolean {
    return this.#f(value, key);
  }
}
