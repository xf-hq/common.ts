import { dispose } from '../../../general/disposables';
import { bindMethod } from '../../../general/functional';
import { Subscribable } from '../../core/subscribable';
import { ArraySource } from './array-source';
import { ArraySourceSubscription, ArraySourceTag, createArraySourceSubscription } from './common';

interface Element<T> {
  value: T;
  sortedIndex: number;
}

export class SortedArraySource<T> implements ArraySource<T>, Subscribable.Receiver<[event: ArraySource.Event<T>]> {
  constructor (compareFn: (a: T, b: T) => number, source: ArraySource<T>) {
    this.#compareFn = compareFn;
    this.#source = source;
  }
  readonly #compareFn: (a: T, b: T) => number;
  readonly #source: ArraySource<T>;
  readonly #emitter = new Subscribable.Controller<[event: ArraySource.Event<T>]>(bindMethod(this.onDemandChange, this));
  #upstreamSubscription: ArraySource.Subscription<T> | undefined;
  #elementReferences: Element<T>[] | undefined;
  #sortedValues: T[] | undefined;

  get [ArraySourceTag] () { return true as const; }

  get __array () { return this.#sortedValues; }

  subscribe<A extends any[]> (subscriber: Subscribable.Subscriber<[event: ArraySource.Event<T>], A>, ...args: A): ArraySource.Subscription<T> {
    return createArraySourceSubscription(this, this.#emitter, subscriber, args);
  }

  onDemandChange (event: Subscribable.DemandObserver.Event): void {
    switch (event) {
      case 'online': this.online(); break;
      case 'offline': this.offline(); break;
    }
  }

  online () {
    this.#upstreamSubscription = this.#source.subscribe(this);
    this.#elementReferences = [];
    this.#sortedValues = [];
    const upstreamArray = this.#upstreamSubscription.__array;
    for (let i = 0; i < upstreamArray.length; i++) {
      const value = upstreamArray[i];
      this.insertValue(value, i);
    }
  }

  offline () {
    dispose(this.#upstreamSubscription!);
    this.#upstreamSubscription = undefined;
    this.#elementReferences = undefined;
    this.#sortedValues = undefined;
  }

  event (event: ArraySource.Event<T>): void {
    const sortedEvent = this.applyEvent(event);
    if (sortedEvent) {
      this.#emitter.event(sortedEvent);
    }
  }

  private applyEvent (event: ArraySource.Event<T>): ArraySource.Event<T> | null {
    const elements = this.#elementReferences!;
    const sortedValues = this.#sortedValues!;

    switch (event.kind) {
      case 'pop': {
        const lastIndex = elements.length - 1;
        const element = elements[lastIndex];
        elements.pop();
        const sortedIndex = element.sortedIndex;
        sortedValues.splice(sortedIndex, 1);
        this.updateIndices(sortedIndex);
        return { kind: 'splice', index: sortedIndex, deletions: 1, insertions: [] };
      }
      case 'shift': {
        const element = elements[0];
        elements.shift();
        const sortedIndex = element.sortedIndex;
        sortedValues.splice(sortedIndex, 1);
        this.updateIndices(sortedIndex);
        return { kind: 'splice', index: sortedIndex, deletions: 1, insertions: [] };
      }
      case 'push':
      case 'unshift': {
        const events: ArraySource.Event<T>[] = [];
        for (const value of event.values) {
          const sortedIndex = this.findInsertionIndex(value);
          sortedValues.splice(sortedIndex, 0, value);
          this.updateIndices(sortedIndex);
          const sourceIndex = event.kind === 'push' ? elements.length : 0;
          elements.splice(sourceIndex, 0, { value, sortedIndex });
          events.push({ kind: 'splice', index: sortedIndex, deletions: 0, insertions: [value] });
        }
        return events.length === 0 ? null
          : events.length === 1 ? events[0]
          : { kind: 'batch', events };
      }
      case 'splice': {
        const events: ArraySource.Event<T>[] = [];

        // Handle deletions
        for (let i = 0; i < event.deletions; i++) {
          const element = elements[event.index];
          const sortedIndex = element.sortedIndex;
          sortedValues.splice(sortedIndex, 1);
          elements.splice(event.index, 1);
          this.updateIndices(sortedIndex);
          events.push({ kind: 'splice', index: sortedIndex, deletions: 1, insertions: [] });
        }

        // Handle insertions
        for (const value of event.insertions) {
          const sortedIndex = this.findInsertionIndex(value);
          sortedValues.splice(sortedIndex, 0, value);
          this.updateIndices(sortedIndex);
          elements.splice(event.index, 0, { value, sortedIndex });
          events.push({ kind: 'splice', index: sortedIndex, deletions: 0, insertions: [value] });
        }

        return events.length === 0 ? null
          : events.length === 1 ? events[0]
          : { kind: 'batch', events };
      }
      case 'set': {
        const { index, value } = event;
        const element = elements[index];
        const oldSortedIndex = element.sortedIndex;

        // Remove from current position
        sortedValues.splice(oldSortedIndex, 1);

        // Find new position and insert
        const newSortedIndex = this.findInsertionIndex(value);
        sortedValues.splice(newSortedIndex, 0, value);

        element.value = value;
        element.sortedIndex = newSortedIndex;
        this.updateIndices(Math.min(oldSortedIndex, newSortedIndex));

        // If the position hasn't changed, it's a simple set
        if (oldSortedIndex === newSortedIndex) {
          return { kind: 'set', index: newSortedIndex, value };
        }

        // Otherwise, it's effectively a move operation
        return {
          kind: 'batch',
          events: [
            { kind: 'splice', index: oldSortedIndex, deletions: 1, insertions: [] },
            { kind: 'splice', index: newSortedIndex, deletions: 0, insertions: [value] },
          ],
        };
      }
      case 'batch': {
        const events = event.events.map(bindMethod(this.applyEvent, this)).filter(e => e !== null) as ArraySource.Event<T>[];
        return events.length === 0 ? null
          : events.length === 1 ? events[0]
          : { kind: 'batch', events };
      }
    }
  }

  private insertValue (value: T, sourceIndex: number): ArraySource.Event<T> | null {
    const sortedIndex = this.findInsertionIndex(value);
    const element: Element<T> = {
      value,
      sortedIndex,
    };
    this.#elementReferences!.splice(sourceIndex, 0, element);
    this.#sortedValues!.splice(sortedIndex, 0, value);
    this.updateIndices(sortedIndex);
    return { kind: 'splice', index: sortedIndex, deletions: 0, insertions: [value] };
  }

  private findInsertionIndex (value: T): number {
    const sortedValues = this.#sortedValues!;
    const compareFn = this.#compareFn;
    let low = 0;
    let high = sortedValues.length;

    while (low < high) {
      const mid = (low + high) >>> 1;
      if (compareFn(sortedValues[mid], value) <= 0) {
        low = mid + 1;
      }
      else {
        high = mid;
      }
    }
    return low;
  }

  private updateIndices (fromIndex: number): void {
    const elements = this.#elementReferences!;
    for (const element of elements) {
      if (element.sortedIndex >= fromIndex) {
        element.sortedIndex = element.sortedIndex + 1;
      }
    }
  }
}
