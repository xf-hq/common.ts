import { isString } from '../../../general/type-checking';
import { Subscribable } from '../../core/subscribable';
import type { AssociativeRecordSource } from './associative-record-source';
import { AssociativeRecordSourceTag, createAssociativeRecordSourceSubscription } from './common';

export class ManualAssociativeRecordSource<V> implements AssociativeRecordSource.Immediate<V>, AssociativeRecordSource.Manual<V> {
  constructor (initialRecord: Record<string, V> = {}) {
    this.#record = initialRecord;
  }
  readonly #emitter = new Subscribable.Controller<[event: AssociativeRecordSource.Event<V>]>();
  readonly #record: Record<string, V>;

  get [AssociativeRecordSourceTag] () { return true as const; }

  get __record () { return this.#record; }

  subscribe<A extends any[]> (subscriber: AssociativeRecordSource.Subscriber<V, A>, ...args: A): AssociativeRecordSource.Subscription<V> {
    return createAssociativeRecordSourceSubscription(this, this.#emitter, subscriber, args);
  }

  set (key: string, value: V): void;
  set (assignments: Record<string, V> | null, deletions?: string[] | null): void;
  set (keyOrAssignments: string | Record<string, V> | null, valueOrDeletions?: V | string[] | null): void {
    if (typeof keyOrAssignments === 'string') {
      const key = keyOrAssignments;
      const value = valueOrDeletions as V;
      const wasExisting = key in this.#record;
      this.#record[key] = value;

      if (wasExisting) {
        this.#emitter.event({ add: null, change: { [key]: value }, delete: null });
      }
      else {
        this.#emitter.event({ add: { [key]: value }, change: null, delete: null });
      }
    }
    else {
      const assignments = keyOrAssignments;
      const deletions = valueOrDeletions as string[] | undefined;
      let additions: Record<string, V> | null = null;
      let modifications: Record<string, V> | null = null;

      // Categorize changes into additions vs modifications
      for (const key in assignments) {
        const value = assignments[key];
        if (!(key in this.#record)) {
          (additions ??= {})[key] = value;
        }
        else if (this.#record[key] !== value) {
          (modifications ??= {})[key] = value;
        }
      }

      Object.assign(this.#record, assignments);

      // Handle deletions if provided
      let deletionKeys: string[] | null = null;
      if (deletions) {
        for (const key of deletions) {
          if (key in this.#record) {
            delete this.#record[key];
            (deletionKeys ??= []).push(key);
          }
        }
      }

      if (additions || modifications || deletionKeys) {
        this.#emitter.event({
          add: additions,
          change: modifications,
          delete: deletionKeys,
        });
      }
    }
  }
  delete (key: string): boolean;
  delete (keys: string[]): boolean;
  delete (arg: string | string[]): boolean {
    if (isString(arg)) {
      if (arg in this.#record) {
        delete this.#record[arg];
        this.#emitter.event({ add: null, change: null, delete: [arg] });
        return true;
      }
      return false;
    }
    else {
      let deletions: string[] | null = null;
      for (const key of arg) {
        if (key in this.#record) {
          delete this.#record[key];
          (deletions ??= []).push(key);
        }
      }
      if (deletions) {
        this.#emitter.event({ add: null, change: null, delete: deletions });
      }
      return deletions ? deletions.length > 0 : false;
    }
  }
  clear (): void {
    const keysToDelete: string[] = [];
    for (const key in this.#record) {
      keysToDelete.push(key);
      delete this.#record[key];
    }
    if (keysToDelete.length > 0) {
      this.#emitter.event({ add: null, change: null, delete: keysToDelete });
    }
  }
}
