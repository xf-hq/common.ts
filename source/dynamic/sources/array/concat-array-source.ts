import { dispose } from '../../../general/disposables';
import { bindMethod } from '../../../general/functional';
import { Subscribable } from '../../core/subscribable';
import { ArraySource } from './array-source';
import { ArraySourceTag, createArraySourceSubscription } from './common';

export class ConcatArraySource<T> implements ArraySource<T> {
  constructor (sourceA: ArraySource<T>, sourceB: ArraySource<T>) {
    this.#sourceA = sourceA;
    this.#sourceB = sourceB;
  }

  readonly #sourceA: ArraySource<T>;
  readonly #sourceB: ArraySource<T>;
  readonly #emitter = new Subscribable.Controller<[event: ArraySource.Event<T>]>(bindMethod(this.onDemandChange, this));

  #upstreamSubscriptionA: ArraySource.Subscription<T> | undefined;
  #upstreamSubscriptionB: ArraySource.Subscription<T> | undefined;
  #concatenatedArray: T[] | undefined;
  #lengthA = 0;

  readonly #receiverA = {
    event: (event: ArraySource.Event<T>): void => {
      const transformedEvent = this.transformAndApplyEventA(event);
      this.#emitter.event(transformedEvent);
    },
  };

  readonly #receiverB = {
    event: (event: ArraySource.Event<T>): void => {
      const transformedEvent = this.transformAndApplyEventB(event);
      this.#emitter.event(transformedEvent);
    },
  };

  get [ArraySourceTag] () { return true as const; }

  get __array () { return this.#concatenatedArray; }

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
    this.#upstreamSubscriptionA = this.#sourceA.subscribe(this.#receiverA);
    this.#upstreamSubscriptionB = this.#sourceB.subscribe(this.#receiverB);
    const arrayA = this.#upstreamSubscriptionA.__array;
    const arrayB = this.#upstreamSubscriptionB.__array;
    this.#lengthA = arrayA.length;
    this.#concatenatedArray = [...arrayA, ...arrayB];
  }

  offline () {
    dispose(this.#upstreamSubscriptionA!);
    dispose(this.#upstreamSubscriptionB!);
    this.#upstreamSubscriptionA = undefined;
    this.#upstreamSubscriptionB = undefined;
    this.#concatenatedArray = undefined;
    this.#lengthA = 0;
  }

  private transformAndApplyEventA (event: ArraySource.Event<T>): ArraySource.Event<T> {
    const array = this.#concatenatedArray!;
    switch (event.kind) {
      case 'pop': {
        const oldLengthA = this.#lengthA;
        array.splice(oldLengthA - 1, 1);
        this.#lengthA--;
        return { kind: 'splice', index: oldLengthA - 1, deletions: 1, insertions: [] };
      }
      case 'shift': {
        array.shift();
        this.#lengthA--;
        return event;
      }
      case 'push': {
        const oldLengthA = this.#lengthA;
        array.splice(oldLengthA, 0, ...event.values);
        this.#lengthA += event.values.length;
        return { kind: 'splice', index: oldLengthA, deletions: 0, insertions: event.values };
      }
      case 'unshift': {
        array.unshift(...event.values);
        this.#lengthA += event.values.length;
        return event;
      }
      case 'splice': {
        array.splice(event.index, event.deletions, ...event.insertions);
        this.#lengthA += event.insertions.length - event.deletions;
        return event;
      }
      case 'set': {
        array[event.index] = event.value;
        return event;
      }
      case 'batch': {
        const mappedEvents: ArraySource.Event<T>[] = [];
        for (const subEvent of event.events) {
          mappedEvents.push(this.transformAndApplyEventA(subEvent));
        }
        return { kind: 'batch', events: mappedEvents };
      }
    }
  }

  private transformAndApplyEventB (event: ArraySource.Event<T>): ArraySource.Event<T> {
    const array = this.#concatenatedArray!;
    switch (event.kind) {
      case 'pop': {
        array.pop();
        return event;
      }
      case 'shift': {
        array.splice(this.#lengthA, 1);
        return { kind: 'splice', index: this.#lengthA, deletions: 1, insertions: [] };
      }
      case 'push': {
        array.push(...event.values);
        return event;
      }
      case 'unshift': {
        array.splice(this.#lengthA, 0, ...event.values);
        return { kind: 'splice', index: this.#lengthA, deletions: 0, insertions: event.values };
      }
      case 'splice': {
        const index = event.index + this.#lengthA;
        array.splice(index, event.deletions, ...event.insertions);
        return { kind: 'splice', index, deletions: event.deletions, insertions: event.insertions };
      }
      case 'set': {
        const index = event.index + this.#lengthA;
        array[index] = event.value;
        return { kind: 'set', index, value: event.value };
      }
      case 'batch': {
        const mappedEvents: ArraySource.Event<T>[] = [];
        for (const subEvent of event.events) {
          mappedEvents.push(this.transformAndApplyEventB(subEvent));
        }
        return { kind: 'batch', events: mappedEvents };
      }
    }
  }
}
