import { dispose } from '../../../general/disposables';
import { throwError } from '../../../general/errors';
import { bindMethod } from '../../../general/functional';
import { Subscribable } from '../../core/subscribable';
import type { AssociativeRecordSource } from './associative-record-source';
import { AssociativeRecordSourceTag, createAssociativeRecordSourceSubscription } from './common';

export class MappedAssociativeRecordSource<VA, VB> implements AssociativeRecordSource.Immediate<VB>, Subscribable.Receiver<[event: AssociativeRecordSource.Event<VA>]> {
  constructor (f: (a: VA) => VB, source: AssociativeRecordSource<VA>) {
    this.#f = f;
    this.#source = source;
  }
  readonly #f: (a: VA) => VB;
  readonly #source: AssociativeRecordSource<VA>;
  readonly #emitter = new Subscribable.Controller<[event: AssociativeRecordSource.Event<VB>]>(bindMethod(this.onDemandChange, this));
  #upstreamSubscription: AssociativeRecordSource.Subscription<VA> | undefined;
  #mappedRecord: Record<string, VB> | undefined;

  get [AssociativeRecordSourceTag] () { return true as const; }

  /** @internal */
  get __record () { return this.#mappedRecord ??= throwError('Internal record not initialized.'); }

  subscribe<A extends any[]> (subscriber: AssociativeRecordSource.Subscriber<VB, A>, ...args: A): AssociativeRecordSource.Subscription<VB> {
    return createAssociativeRecordSourceSubscription(this, this.#emitter, subscriber, args);
  }

  onDemandChange (event: Subscribable.DemandObserver.Event): void {
    switch (event) {
      case 'online': this.online(); break;
      case 'offline': this.offline(); break;
    }
  }

  online () {
    this.#upstreamSubscription = this.#source.subscribe(this);
    this.#mappedRecord = {};
    const source = this.#upstreamSubscription.__record;
    for (const key in source) {
      this.#mappedRecord[key] = this.mapValue(source[key]);
    }
  }

  offline () {
    dispose(this.#upstreamSubscription!);
    this.#upstreamSubscription = undefined;
    this.#mappedRecord = undefined;
  }
  event (event: AssociativeRecordSource.Event<VA>): void {
    const mappedRecord = this.#mappedRecord!;
    let mappedAdditions: Record<string, VB> | null = null;
    let mappedChanges: Record<string, VB> | null = null;
    let mappedDeletions: string[] | null = null;

    if (event.add) {
      for (const key in event.add) {
        const value = event.add[key];
        const mappedValue = this.mapValue(value);
        mappedRecord[key] = mappedValue;
        (mappedAdditions ??= {})[key] = mappedValue;
      }
    }

    if (event.change) {
      for (const key in event.change) {
        const value = event.change[key];
        const mappedValue = this.mapValue(value);
        mappedRecord[key] = mappedValue;
        (mappedChanges ??= {})[key] = mappedValue;
      }
    }

    if (event.delete) {
      for (const key of event.delete) {
        if (key in mappedRecord) {
          delete mappedRecord[key];
          (mappedDeletions ??= []).push(key);
        }
      }
    }

    if (mappedAdditions || mappedChanges || mappedDeletions) {
      this.#emitter.event({
        add: mappedAdditions,
        change: mappedChanges,
        delete: mappedDeletions,
      });
    }
  }

  mapValue (value: VA): VB {
    return this.#f(value);
  }
}
