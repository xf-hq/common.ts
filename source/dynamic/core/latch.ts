import { FnC, FnCC, FnCT } from '../../general/factories-and-latebinding';

export interface Latch {
  readonly waiting: boolean;
}
export interface LatchHandle {
  release (): void;
}
export interface Resettable {
  reset (): void;
}
export interface ResettableLatchHandle extends LatchHandle, Resettable {}
export interface MasterLatch extends Latch, LatchHandle {}
export interface ResettableMasterLatch extends MasterLatch, Resettable {
  reset (): void;
}
export interface LatchMulticaster {
  attach (handle: LatchHandle): void;
  detach (handle: LatchHandle): void;
}
export interface MulticastLatch extends Latch, LatchMulticaster {
  attach (handle: LatchHandle): void;
  detach (handle: LatchHandle): void;
}
export interface MulticastMasterLatch extends MulticastLatch, MasterLatch {}
export interface ResettableLatchMulticaster extends LatchMulticaster {
  attach (handle: ResettableLatchHandle): void;
  detach (handle: ResettableLatchHandle): void;
}
export interface ResettableMulticastLatch extends MulticastLatch, ResettableLatchMulticaster {
  attach (handle: ResettableLatchHandle): void;
  detach (handle: ResettableLatchHandle): void;
}
export interface ResettableMulticastMasterLatch extends ResettableMulticastLatch, ResettableMasterLatch {}
export interface Future<T> {
  readonly state: MulticastLatch;
  readonly value: T | undefined;
}
export interface VoidableFuture<T> extends Future<T> {
  readonly state: ResettableMulticastLatch;
  readonly value: T | undefined;
}
export interface Sink<T> {
  dispatch (value: T): void;
}
export interface FutureController<T> extends Sink<T>, Future<T> {}

export const FunctionCallingLatch = FnCT<ResettableMasterLatch>()(
  class FunctionCallingLatch<A extends any[]> implements ResettableMasterLatch {
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

export const MulticastingLatch = FnCT<MulticastMasterLatch>()(
  class MulticastingLatch implements MulticastMasterLatch {
    private readonly _attachedLatches = new Set<ResettableLatchHandle>();
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
    attach (handle: ResettableLatchHandle): void {
      this._attachedLatches.add(handle);
      if (!this._waiting) {
        // If the multicasting latch has already been released, release the new one too.
        handle.release();
      }
    }
    detach (handle: ResettableLatchHandle): void {
      this._attachedLatches.delete(handle);
    }
  }
);

export const ResettableMulticastingLatch = FnCT<ResettableMulticastMasterLatch>()(
  class MulticastingLatch implements ResettableMulticastMasterLatch {
    private readonly _attachedLatches = new Set<ResettableLatchHandle>();
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
    attach (handle: ResettableLatchHandle): void {
      this._attachedLatches.add(handle);
      if (!this._waiting) {
        // If the multicasting latch has already been released, release the new one too.
        handle.release();
      }
    }
    detach (handle: ResettableLatchHandle): void {
      this._attachedLatches.delete(handle);
    }
  }
);

export namespace Latch {
  /**
   * Combines two `LatchMulticaster` instances such that the provided `LatchHandle` is released only when both latches
   * have been released.
   * @returns A `LatchHandle` used to detach the downstream handle from the left and right latches.
   */
  export function and (left: LatchMulticaster, right: LatchMulticaster, handle: LatchHandle): LatchHandle {
    const state: [boolean, boolean] = [false, false];
    left.attach(new And(handle, state, 0));
    right.attach(new And(handle, state, 1));
    return {
      release (): void {
        left.detach(handle);
        right.detach(handle);
      },
    };
  }
  class And implements LatchHandle {
    constructor (
      private readonly handle: LatchHandle,
      private readonly state: [boolean, boolean],
      private readonly index: 0 | 1
    ) {}
    release (): void {
      if (this.state[this.index]) return;
      this.state[this.index] = true;
      if (this.state[0] && this.state[1]) this.handle.release();
    }
  }
}

type _FutureController<T> = FutureController<T>;
export const Future = FnCC(
  class FutureController<T> implements _FutureController<T> {
    static create<T> (): _FutureController<T> {
      return new FutureController<T>(MulticastingLatch());
    }
    constructor (
      private readonly _latch: MulticastMasterLatch,
    ) {}
    private _value: T | undefined;

    get state (): MulticastLatch { return this._latch; }
    get value (): T | undefined { return this._value; }

    dispatch (value: T): void {
      if (!this._latch.waiting) {
        throw new Error(`Cannot dispatch a value to a Future that is not in a waiting state.`);
      }
      this._value = value;
      this._latch.release();
    }
  }
);

interface QueuedEvent<T> {
  readonly event: T;
  next: QueuedEvent<T> | undefined;
}
export class QueueableEventLatch<T> {
  private readonly _latch = ResettableMulticastingLatch();
  private _current: T | undefined;
  private _next: QueuedEvent<T> | undefined;
  private _last: QueuedEvent<T> | undefined;

  get current (): T {
    if (!this._latch.waiting) return this._current as T;
    throw new Error(`This property is only available while a 'dispatch' operation is in progress.`);
  }

  dispatch (event: T): void {
    if (this._latch.waiting) {
      this._current = event;
      this._latch.release();
      this._latch.reset();
      let next = this._next;
      while (next) {
        if (next === this._last) {
          this._next = this._last = undefined;
        }
        else {
          this._next = next.next;
        }
        this._current = next.event;
        this._latch.release();
        this._latch.reset();
        next = this._next;
      }
    }
    else if (this._next) {
      const newLast: QueuedEvent<T> = {
        event,
        next: undefined,
      };
      this._last!.next = newLast;
      this._last = newLast;
    }
    else {
      this._last = this._next = {
        event,
        next: undefined,
      };
    }
  }
}
