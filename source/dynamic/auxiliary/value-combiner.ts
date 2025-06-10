import { isDefined } from '../../general/type-checking';
import { Subscribable } from '../core/subscribable';
import { ValueSlot } from './value-slot';

const VOID = Symbol('VOID');

export class ValueCombiner<T extends unknown[] = unknown[]> {
  constructor (size: number) {
    const slots: ValueSlot[] = [];
    const voidIndices = new Set<number>();
    const values: unknown[] = [];
    for (let i = 0; i < size; i++) {
      slots.push(new ValueSlot(this.#onDirty.bind(this, i)));
      voidIndices.add(i);
      values.push(VOID);
    }
    this.#slots = slots;
    this.#voidIndices = voidIndices;
    this.#values = values as T;
  }
  readonly #slots: ValueSlot[];
  readonly #voidIndices: Set<number>;
  readonly #values: T;
  readonly #dirty = new Set<number>();
  #subscriptions?: {
    dirty?: Subscribable.Controller<[]>;
    changed?: Subscribable.Controller<[]>;
  };
  #dirtyNotification: null | 'scheduled' | 'sent' = null;

  #onDirty (index: number) {
    this.#dirty.add(index);
    if (this.#dirtyNotification !== null) return;
    this.#dirtyNotification = 'scheduled';
    queueMicrotask(() => {
      if (this.#dirtyNotification !== 'scheduled') return;
      this.#dirtyNotification = 'sent';
      this.#subscriptions?.dirty?.event();
    });
  }

  get size () { return this.#slots.length; }
  get anyVoid () { return this.#voidIndices.size > 0; }
  get allExist () { return !this.anyVoid; }

  slot (index: number) {
    return this.#slots[index];
  }
  current (index: number) {
    return this.#slots[index].current;
  }
  latest (index: number) {
    return this.#slots[index].latest;
  }

  commit () {
    this.#dirtyNotification = null;
    let changed = false;
    for (const index of this.#dirty) {
      const slot = this.#slots[index];
      if (slot.commit()) {
        changed = true;
        this.#values[index] = slot.current.exists ? slot.current.value : VOID;
      }
    }
    this.#dirty.clear();
    if (changed) {
      this.#subscriptions?.changed?.event();
      return true;
    }
  }

  read (): T;
  read<U> (f: (...args: T) => U): U;
  read (f?: AnyFunction) {
    const values = this.#values;
    return isDefined(f) ? f(...values) : [...values];
  }

  subscribe (eventType: 'dirty' | 'changed', signal: () => void) {
    const subscriptions = this.#subscriptions ??= {};
    const controller = subscriptions[eventType] ??= new Subscribable.Controller();
    return controller.subscribe(signal);
  }
}
