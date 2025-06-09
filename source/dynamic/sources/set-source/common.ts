import { dispose } from '../../../general/disposables';
import type { SetSource } from './set-source';

export const SetSourceTag: unique symbol = Symbol('SetSource');
export class SetSourceSubscription<T> implements SetSource.Subscription<T> {
  constructor (
    private readonly source: { readonly __set: ReadonlySet<T> | undefined },
    private readonly subscription: Disposable
  ) {}

  get __set () {
    if (this.#disposed) {
      throw new Error(`Cannot access set after the view has been disposed`);
    }
    return this.source.__set!;
  }

  #disposed = false;
  [Symbol.dispose] () {
    if (this.#disposed) return;
    this.#disposed = true;
    dispose(this.subscription);
  }
}
