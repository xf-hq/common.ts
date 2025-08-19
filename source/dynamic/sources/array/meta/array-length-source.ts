import { dispose } from '../../../../general/disposables';
import type { NumberSource } from '../../value-source/number-source';
import type { ArraySource } from '../array-source';

export class ArrayLengthDemandObserver implements NumberSource.DemandObserver, ArraySource.Receiver<any> {
  constructor (
    private readonly source: ArraySource<any>,
  ) {}
  #out: NumberSource.Manual;
  #subscription: ArraySource.Subscription<any> | undefined;

  online (out: NumberSource.Manual) {
    this.#out = out;
    this.#subscription = this.source.subscribe(this);
  }
  offline () {
    const subscription = this.#subscription!;
    this.#subscription = undefined;
    dispose(subscription);
  }

  hold () {
    this.#out.hold();
  }
  release () {
    this.#out.release();
  }
  event () {
    this.#out.set(this.#subscription!.__array.length);
  }
  end () {
    this.#out.freeze();
  }
}
