import { isDefined } from '../../../general/type-checking';
import { dispose } from '../../../general/disposables';
import { bindMethod } from '../../../general/functional';
import { Subscribable } from '../../core/subscribable';
import { ArraySource } from './array-source';
import { ArraySourceSubscription, ArraySourceTag } from './common';

export class StatefulMappedArraySource<A, B, S, C> implements ArraySource<B>, Subscribable.Receiver<[event: ArraySource.Event<A>]> {
  constructor (mapper: ArraySource.StatefulMapper<A, B, S, C>, source: ArraySource<A>) {
    this.#mapper = mapper;
    this.#source = source;
  }
  readonly #mapper: ArraySource.StatefulMapper<A, B, S, C>;
  readonly #source: ArraySource<A>;
  readonly #emitter = new Subscribable.Controller<[event: ArraySource.Event<B>]>(bindMethod(this.onDemandChange, this));
  #upstreamSubscription: ArraySource.Subscription<A> | undefined;
  #states: S[] | undefined;
  #commonState: C | undefined;
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
    const mapper = this.#mapper;
    const itemStates: S[] = this.#states = [];
    const mappedArray: B[] = this.#mappedArray = [];
    if (mapper.shared) {
      this.#commonState = mapper.shared.init(this.#states);
    }
    this.#upstreamSubscription = this.#source.subscribe(this);
    const sourceArray = this.#upstreamSubscription.__array;
    for (const item of sourceArray) {
      const state = mapper.item.init(item, this.#commonState!);
      itemStates.push(state);
      mappedArray.push(mapper.item.map(state, this.#commonState!));
    }
  }

  offline () {
    for (const state of this.#states!) {
      this.#mapper.item.dispose(state, this.#commonState!);
    }
    if (this.#mapper.shared) {
      this.#mapper.shared.dispose(this.#commonState!);
    }
    dispose(this.#upstreamSubscription!);
    this.#upstreamSubscription = undefined;
    this.#states = undefined;
    this.#commonState = undefined;
    this.#mappedArray = undefined;
  }

  signal (event: ArraySource.Event<A>): void {
    const mappedEvent = this.applyEvent(event);
    this.#emitter.signal(mappedEvent);
    if (this.#disposalQueue.length === 0) return;
    const disposalQueue = [...this.#disposalQueue];
    this.#disposalQueue.length = 0;
    for (const state of disposalQueue) {
      this.#mapper.item.dispose(state, this.#commonState!);
    }
  }

  readonly #disposalQueue: S[] = [];
  private applyEvent (event: ArraySource.Event<A>): ArraySource.Event<B> {
    const states = this.#states!;
    const array = this.#mappedArray!;
    const mapper = this.#mapper;
    const commonState = this.#commonState!;
    const itemHandler = mapper.item;

    const applyStateChanges = mapper.event?.[event.kind] as ((event: ArraySource.Event<A>, itemStates: S[], commonState: C) => void) | undefined;
    if (isDefined(applyStateChanges)) applyStateChanges(event, states, commonState);

    switch (event.kind) {
      case 'pop': {
        const state = states.pop()!;
        array.pop();
        this.#disposalQueue.push(state);
        return event;
      }
      case 'shift': {
        const state = states.shift()!;
        array.shift();
        this.#disposalQueue.push(state);
        return event;
      }
      case 'push': {
        const values = event.values;
        const newStates = values.map(item => itemHandler.init(item, commonState));
        states.push(...newStates);
        const mappedValues = newStates.map(state => itemHandler.map(state, commonState));
        array.push(...mappedValues);
        return { kind: 'push', values: mappedValues };
      }
      case 'unshift': {
        const values = event.values;
        const newStates = values.map(item => itemHandler.init(item, commonState));
        states.unshift(...newStates);
        const mappedValues = newStates.map(state => itemHandler.map(state, commonState));
        array.unshift(...mappedValues);
        return { kind: 'unshift', values: mappedValues };
      }
      case 'splice': {
        const { index, deletions, insertions } = event;
        for (let i = 0; i < deletions; i++) {
          const state = states[index + i];
          this.#disposalQueue.push(state);
        }
        const newStates = insertions.map(item => itemHandler.init(item, commonState));
        const values = newStates.map(state => itemHandler.map(state, commonState));
        states.splice(index, deletions, ...newStates);
        array.splice(index, deletions, ...values);
        return { kind: 'splice', index, deletions, insertions: values };
      }
      case 'set': {
        const { index, value } = event;
        let state: S;
        if (itemHandler.update) {
          state = itemHandler.update(value, states[index], commonState);
        }
        else {
          const oldState = states[index];
          this.#disposalQueue.push(oldState);
          state = itemHandler.init(value, commonState);
        }
        states[index] = state;
        const mappedValue = array[index] = itemHandler.map(state, commonState);
        return { kind: 'set', index, value: mappedValue };
      }
      case 'batch': {
        const mappedEvents = event.events.map(bindMethod(this.applyEvent, this));
        return { kind: 'batch', events: mappedEvents };
      }
    }
  }
}
