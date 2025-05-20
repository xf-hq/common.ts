import { dispose } from '../../../general/disposables';
import type { ArraySource } from './array-source';

export const ArraySourceTag: unique symbol = Symbol('ArraySource');
export const isArraySource = (value: any): value is ArraySource<any> => value?.[ArraySourceTag] === true;

export class ArraySourceSubscription<T> implements ArraySource.Subscription<T> {
  constructor (
    private readonly source: { readonly __array: readonly T[] | undefined },
    private readonly subscription: Disposable
  ) {}

  get __array () {
    if (this.#disposed) {
      throw new Error(`Cannot access array after the view has been disposed`);
    }
    return this.source.__array!;
  }

  #disposed = false;
  [Symbol.dispose] () {
    if (this.#disposed) return;
    this.#disposed = true;
    dispose(this.subscription);
  }
}
