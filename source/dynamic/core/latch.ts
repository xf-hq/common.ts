import { FnCT } from '../../general/factories-and-latebinding';

export interface Latch {
  readonly waiting: boolean;
}
export interface LatchController extends Latch {
  release (): void;
}
export interface ResettableLatchController extends LatchController {
  reset (): void;
}
export interface MulticastLatch extends Latch {
  attach (latch: LatchController): void;
  detach (latch: LatchController): void;
}
export interface MulticastLatchController extends MulticastLatch, LatchController {}
export interface ResettableMulticastLatch extends MulticastLatch {
  attach (latch: ResettableLatchController): void;
  detach (latch: ResettableLatchController): void;
}
export interface ResettableMulticastLatchController extends ResettableMulticastLatch, ResettableLatchController {}
export interface Future<T> {
  readonly state: MulticastLatch;
  readonly value: T | undefined;
}
export interface VoidableFuture<T> extends Future<T> {
  readonly state: ResettableMulticastLatch;
  readonly value: T | undefined;
}

export const FunctionCallingLatch = FnCT<ResettableLatchController>()(
  class FunctionCallingLatch<A extends any[]> implements ResettableLatchController {
  constructor (
    private readonly _target: (...args: A) => void,
    private readonly _thisArg: any,
    ...args: A
  ) {
    this._args = args;
  }
  private readonly _args: A;
  private _waiting = true;

  get waiting (): boolean { return this._waiting; }

  release (): void {
    if (this._waiting) {
      this._waiting = false;
      this._target.apply(this._thisArg, this._args);
    }
  }
  reset (): void {
    this._waiting = true;
  }
});

export const MulticastingLatch = FnCT<ResettableMulticastLatchController>()(
  class MulticastingLatch implements ResettableMulticastLatchController {
    private readonly _attachedLatches = new Set<ResettableLatchController>();
    private _waiting: boolean = true;

    get waiting (): boolean { return this._waiting; }

    release (): void {
      if (this._waiting) {
        this._waiting = false;
        for (const latch of this._attachedLatches) {
          latch.release();
        }
      }
    }
    reset (): void {
      this._waiting = true;
      for (const latch of this._attachedLatches) {
        latch.reset();
      }
    }
    attach (latch: ResettableLatchController): void {
      this._attachedLatches.add(latch);
      if (!this._waiting) {
        // If the multicasting latch has already been released, release the new one too.
        latch.release();
      }
    }
    detach (latch: ResettableLatchController): void {
      this._attachedLatches.delete(latch);
    }
  }
);
