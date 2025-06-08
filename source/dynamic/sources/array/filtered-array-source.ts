import { dispose } from '../../../general/disposables';
import { bindMethod } from '../../../general/functional';
import { Subscribable } from '../../core/subscribable';
import { ArraySource } from './array-source';
import { ArraySourceSubscription, ArraySourceTag } from './common';

interface Element<T> {
  value: T;
  passedFilter: boolean;
}

export class FilteredArraySource<T> implements ArraySource<T>, Subscribable.Receiver<[event: ArraySource.Event<T>]> {
  constructor (f: (value: T) => boolean, source: ArraySource<T>) {
    this.#f = f;
    this.#source = source;
  }
  readonly #f: (value: T) => boolean;
  readonly #source: ArraySource<T>;
  readonly #emitter = new Subscribable.Controller<[event: ArraySource.Event<T>]>(bindMethod(this.onDemandChange, this));
  #upstreamSubscription: ArraySource.Subscription<T> | undefined;
  #allElementReferences: Element<T>[] | undefined;
  #filteredElementReferences: Element<T>[] | undefined;
  #filteredValues: T[] | undefined;

  get [ArraySourceTag] () { return true as const; }

  get __array () { return this.#filteredValues; }

  subscribe<A extends any[]> (subscriber: Subscribable.Subscriber<[event: ArraySource.Event<T>], A>, ...args: A): ArraySource.Subscription<T> {
    const subscription = this.#emitter.subscribe(subscriber, ...args);
    return new ArraySourceSubscription(this, subscription);
  }

  onDemandChange (event: Subscribable.DemandObserver.Event): void {
    switch (event) {
      case 'online': this.online(); break;
      case 'offline': this.offline(); break;
    }
  }
  online () {
    this.#upstreamSubscription = this.#source.subscribe(this);
    this.#allElementReferences = [];
    this.#filteredElementReferences = [];
    this.#filteredValues = [];
    const upstreamArray = this.#upstreamSubscription.__array;
    for (let i = 0; i < upstreamArray.length; i++) {
      const value = upstreamArray[i];
      const passedFilter = this.testValue(value);
      const element: Element<T> = { value, passedFilter };
      this.#allElementReferences.push(element);
      if (passedFilter) {
        this.#filteredElementReferences.push(element);
        this.#filteredValues.push(value);
      }
    }
  }
  offline () {
    dispose(this.#upstreamSubscription!);
    this.#upstreamSubscription = undefined;
    this.#allElementReferences = undefined;
    this.#filteredElementReferences = undefined;
    this.#filteredValues = undefined;
  }

  signal (event: ArraySource.Event<T>): void {
    const filteredEvent = this.applyEvent(event);
    if (filteredEvent) {
      this.#emitter.signal(filteredEvent);
    }
  }

  private applyEvent (event: ArraySource.Event<T>): ArraySource.Event<T> | null {
    const filteredValues = this.#filteredValues!;
    const allElementReferences = this.#allElementReferences!;
    const filteredElementReferences = this.#filteredElementReferences!;
    switch (event.kind) {
      case 'pop': {
        const element = allElementReferences.pop()!;
        if (element.passedFilter) {
          filteredElementReferences.pop();
          filteredValues.pop();
        }
        return event;
      }
      case 'shift': {
        const element = allElementReferences.shift()!;
        if (element.passedFilter) {
          filteredElementReferences.shift();
          filteredValues.shift();
        }
        return event;
      }
      case 'push': {
        const values = event.values;
        const elements: Element<T>[] = [];
        const filteredElements: Element<T>[] = [];
        const filteredValueInsertions: T[] = [];

        for (const value of values) {
          const passedFilter = this.testValue(value);
          const element: Element<T> = { value, passedFilter };
          elements.push(element);
          if (passedFilter) {
            filteredElements.push(element);
            filteredValueInsertions.push(value);
          }
        }

        allElementReferences.push(...elements);
        if (filteredValueInsertions.length > 0) {
          filteredElementReferences.push(...filteredElements);
          filteredValues.push(...filteredValueInsertions);
          return { kind: 'push', values: filteredValueInsertions };
        }
        return null;
      }
      case 'unshift': {
        const values = event.values;
        const elements: Element<T>[] = [];
        const filteredElements: Element<T>[] = [];
        const filteredValueInsertions: T[] = [];

        for (const value of values) {
          const passedFilter = this.testValue(value);
          const element: Element<T> = { value, passedFilter };
          elements.push(element);
          if (passedFilter) {
            filteredElements.push(element);
            filteredValueInsertions.push(value);
          }
        }

        allElementReferences.unshift(...elements);
        if (filteredValueInsertions.length > 0) {
          filteredElementReferences.unshift(...filteredElements);
          filteredValues.unshift(...filteredValueInsertions);
          return { kind: 'unshift', values: filteredValueInsertions };
        }
        return null;
      }
      case 'splice': {
        const { index, deletions, insertions } = event;
        const allElementInsertions: Element<T>[] = [];
        const filteredElementInsertions: Element<T>[] = [];
        const filteredValueInsertions: T[] = [];
        let filteredDeletions = 0;
        for (let i = 0; i < deletions; i++) {
          const element = allElementReferences[index + i];
          if (element.passedFilter) ++filteredDeletions;
        }
        for (let i = 0; i < insertions.length; i++) {
          const value = insertions[i];
          const passedFilter = this.testValue(value);
          const element: Element<T> = { value, passedFilter };
          allElementInsertions.push(element);
          if (passedFilter) {
            filteredElementInsertions.push(element);
            filteredValueInsertions.push(value);
          }
        }
        allElementReferences.splice(index, deletions, ...allElementInsertions);
        if (filteredDeletions > 0 || filteredElementInsertions.length > 0) {
          const filteredIndex = this.findFilteredIndex(index);
          filteredElementReferences.splice(filteredIndex, filteredDeletions, ...filteredElementInsertions);
          filteredValues.splice(filteredIndex, filteredDeletions, ...filteredValueInsertions);
          return { kind: 'splice', index: filteredIndex, deletions: filteredDeletions, insertions: filteredValueInsertions };
        }
        return null;
      }
      case 'set': {
        const { index, value } = event;
        const element = allElementReferences[index];
        const passedFilter = this.testValue(value);
        element.value = value;
        if (element.passedFilter && !passedFilter) {
          const filteredIndex = this.findFilteredIndex(index);
          filteredElementReferences.splice(filteredIndex, 1);
          filteredValues.splice(filteredIndex, 1);
        }
        else if (!element.passedFilter && passedFilter) {
          const filteredIndex = this.findFilteredIndex(index);
          filteredElementReferences.splice(filteredIndex, 0, element);
          filteredValues.splice(filteredIndex, 0, value);
        }
        element.passedFilter = passedFilter;
        return event;
      }
      case 'batch': {
        const filteredEvents = event.events.map(bindMethod(this.applyEvent, this)).filter(e => e !== null) as ArraySource.Event<T>[];
        if (filteredEvents.length === 0) return null;
        if (filteredEvents.length === 1) return filteredEvents[0];
        return { kind: 'batch', events: filteredEvents };
      }
    }
  }

  findFilteredIndex (unfilteredIndex: number): number {
    // First get a reference to the last filter-passing element at or before the unfiltered index. This is the element
    // we want to find the index of in the filtered array.
    const keystoneIndex = this.#allElementReferences!.findLastIndex((element) => element.passedFilter, unfilteredIndex);
    // If there were no filter-passing elements at or before the unfiltered index, then the start of the filtered array
    // is the position we're looking for.
    if (keystoneIndex === -1) return 0;
    const keystoneElement = this.#allElementReferences![keystoneIndex];
    // Now iterate backwards from the keystone index (no point in checking indexes beyond that position) until we find
    // the element in the filtered array.
    return this.#filteredElementReferences!.findLastIndex((element) => element === keystoneElement, keystoneIndex);
  }

  testValue (value: T): boolean {
    const f = this.#f;
    return f(value);
  }
}
