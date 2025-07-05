import { createChildAbortController } from '../../../general/abort-signals';
import type { ArraySource } from './array-source';

export class ForEachArraySourceElement<T> implements ArraySource.EventReceiver<T> {
  constructor (
    private readonly _abortSignal: AbortSignal,
    private readonly _callback: (value: T, abortSignal: AbortSignal) => void,
  ) {}
  readonly #elements: Element<T>[] = [];
  #sub: ArraySource.Subscription<T>;

  init? (subscription: ArraySource.Subscription<T>): void {
    this.#sub = subscription;
    this.push(subscription.__array);
  }
  push (values: readonly T[]): void {
    for (const value of values) {
      const abortController = createChildAbortController(this._abortSignal);
      this.#elements.push({ abortController, value });
      this._callback(value, abortController.signal);
    }
  }
  pop (): void {
    const element = this.#elements.pop()!;
    element.abortController.abort();
  }
  unshift (values: readonly T[]): void {
    const insertions: Element<T>[] = [];
    for (const value of values) {
      insertions.push({ abortController: createChildAbortController(this._abortSignal), value });
    }
    this.#elements.unshift(...insertions);
    for (const { value, abortController } of insertions) {
      this._callback(value, abortController.signal);
    }
  }
  shift (): void {
    const element = this.#elements.shift()!;
    element.abortController.abort();
  }
  splice (index: number, deletions: number, insertions: T[]): void {
    for (let i = 0; i < deletions; i++) {
      const element = this.#elements[index + i];
      element.abortController.abort();
    }
    const newElements: Element<T>[] = [];
    for (const value of insertions) {
      newElements.push({ abortController: createChildAbortController(this._abortSignal), value });
    }
    this.#elements.splice(index, deletions, ...newElements);
    for (const { value, abortController } of newElements) {
      this._callback(value, abortController.signal);
    }
  }
  set (index: number, value: T): void {
    const element = this.#elements[index];
    element.abortController.abort();
    element.abortController = createChildAbortController(this._abortSignal);
    element.value = value;
    this._callback(value, element.abortController.signal);
  }
  batch (events: ArraySource.Event<T>[], receiver: ArraySource.Receiver<T, []>): void {
    for (const event of events) {
      receiver.event(event);
    }
  }

  unsubscribed? (): void {
    for (const element of this.#elements) {
      element.abortController.abort();
    }
    this.#elements.length = 0;
  }
}

interface Element<T> {
  abortController: AbortController;
  value: T;
}
