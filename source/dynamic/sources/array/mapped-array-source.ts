import { dispose } from '../../../general/disposables';
import { bindMethod } from '../../../general/functional';
import { Subscribable } from '../../core/subscribable';
import { ArraySource } from './array-source';
import { ArraySourceSubscription, ArraySourceTag } from './common';

export class MappedArraySource<A, B> implements ArraySource<B>, Subscribable.Receiver<[event: ArraySource.Event<A>]> {
  constructor (f: (a: A) => B, source: ArraySource<A>) {
    this.#f = f;
    this.#source = source;
  }
  readonly #f: (a: A) => B;
  readonly #source: ArraySource<A>;
  readonly #emitter = new Subscribable.Controller<[event: ArraySource.Event<B>]>(bindMethod(this.onDemandChange, this));
  #upstreamSubscription: ArraySource.Subscription<A> | undefined;
  #mappedArray: B[] | undefined;

  get [ArraySourceTag] () { return true as const; }

  /** @internal */
  get __array () { return this.#mappedArray; }

  subscribe<A extends any[]> (subscriber: Subscribable.Subscriber<[event: ArraySource.Event<B>], A>, ...args: A): ArraySource.Subscription<B> {
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
    this.#mappedArray = this.#upstreamSubscription.__array.map(this.#f);
  }
  offline () {
    dispose(this.#upstreamSubscription!);
    this.#upstreamSubscription = undefined;
    this.#mappedArray = undefined;
  }

  signal (event: ArraySource.Event<A>): void {
    const mappedEvent = this.applyEvent(event);
    this.#emitter.signal(mappedEvent);
  }

  private applyEvent (event: ArraySource.Event<A>): ArraySource.Event<B> {
    const array = this.#mappedArray!;
    switch (event.kind) {
      case 'pop': {
        array.pop();
        return event;
      }
      case 'shift': {
        array.shift();
        return event;
      }
      case 'push': {
        const mappedValues = event.values.map(this.#f);
        array.push(...mappedValues);
        return { kind: 'push', values: mappedValues };
      }
      case 'unshift': {
        const mappedValues = event.values.map(this.#f);
        array.unshift(...mappedValues);
        return { kind: 'unshift', values: mappedValues };
      }
      case 'splice': {
        const { index, deletions, insertions } = event;
        const values = insertions.map(this.#f);
        array.splice(index, deletions, ...values);
        return { kind: 'splice', index, deletions, insertions: values };
      }
      case 'set': {
        const { index, value } = event;
        const mappedValue = array[index] = this.mapValue(value);
        return { kind: 'set', index, value: mappedValue };
      }
      case 'batch': {
        const mappedEvents = event.events.map(bindMethod(this.applyEvent, this));
        return { kind: 'batch', events: mappedEvents };
      }
    }
  }

  mapValue (value: A): B {
    const f = this.#f;
    return f(value);
  }
}
