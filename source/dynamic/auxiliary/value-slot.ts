export class ValueSlot<T = unknown> {
  constructor (signal: () => void) {
    this.#signal = signal;
  }
  readonly #signal: () => void;
  readonly #current = new Value<T>();
  readonly #staging = new Value<T>();
  #isStaging = false;
  #dirtyNotificationScheduled = false;

  #notifyDirty () {
    if (this.#dirtyNotificationScheduled) return;
    this.#dirtyNotificationScheduled = true;
    queueMicrotask(() => {
      this.#dirtyNotificationScheduled = false;
      this.#signal();
    });
  }

  get current (): PublicValue<T> { return this.#current; }
  get staged (): PublicValue<T> { return this.#staging; }
  get latest (): PublicValue<T> { return this.#isStaging ? this.#staging : this.#current; }

  set (value: T): void {
    if (this.#isStaging) {
      if (this.#staging.value === value) return;
      if (this.#current.exists && this.#current.value === value) return this.revert();
    }
    else {
      if (this.#current.value === value) return;
      this.#isStaging = true;
    }
    this.#staging.set(value);
    this.#notifyDirty();
  }

  void (): void {
    if (this.#isStaging) {
      if (!this.#staging.exists) return;
      if (!this.#current.exists) return this.revert();
      this.#staging.void();
    }
    else {
      if (!this.#current.exists) return;
      this.#isStaging = true;
    }
    this.#notifyDirty();
  }

  revert (): void {
    this.#staging.void();
    this.#isStaging = false;
  }

  commit (): boolean {
    if (!this.#isStaging) return false;
    const staging = this.#staging;
    const current = this.#current;
    if (staging.exists) {
      current.set(staging.value);
      staging.void();
    }
    else current.void();
    this.#isStaging = false;
    return true;
  }
}

interface PublicValue<T> {
  readonly exists: boolean;
  readonly value: T;
}

class Value<T = unknown> implements PublicValue<T> {
  #exists: boolean = false;
  #value: T | undefined;

  get exists (): boolean { return this.#exists; }
  get value (): T {
    if (!this.#exists) {
      throw new Error(`Value is currently void.`);
    }
    return this.#value!;
  }

  set (value: T): this {
    this.#exists = true;
    this.#value = value;
    return this;
  }

  void (): this {
    this.#exists = false;
    this.#value = undefined;
    return this;
  }
}
