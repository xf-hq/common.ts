export interface Latch {
  readonly waiting: boolean;
}

export interface LatchHandle {
  release (): void;
}
export type LatchHandle_ = LatchHandle | LatchHandle['release'];
export function LatchHandle (release: LatchHandle_): LatchHandle { return typeof release === 'function' ? { release } : release; }

export interface Resettable {
  reset (): void;
}
export type Resettable_ = Resettable | Resettable['reset'];

export interface Monitor {
  attach (handle: LatchHandle, detach?: Monitor): void;
}
export type Monitor_ = Monitor | Monitor['attach'];
export function Monitor (attach: Monitor_): Monitor { return typeof attach === 'function' ? { attach } : attach; }
export namespace Monitor {
  export function attach (monitor: Monitor_, handle: LatchHandle_, detach?: Monitor_): void {
    if (typeof handle === 'function') handle = LatchHandle(handle);
    if (typeof detach === 'function') detach = Monitor(monitor);
    if (typeof monitor === 'function') monitor(handle, detach);
    else monitor.attach(handle, detach);
  }
}

export interface ResettableMonitor {
  attach (handle: ResettableLatchHandle, detach?: Monitor): void;
}
export type ResettableMonitor_ = ResettableMonitor | ResettableMonitor['attach'];

export interface Sink<T extends readonly any[], R> {
  write (...value: T): R;
}
export type Sink_<T extends readonly any[], R> = Sink<T, R> | Sink<T, R>['write'];

export interface Hold<T extends readonly any[]> {
  read<R> (sink: Sink<T, R>): R;
}
export type Hold_<T extends readonly any[]> = Hold<T> | Hold<T>['read'];

export interface ResettableLatchHandle extends LatchHandle, Resettable {}
export interface MasterLatch extends Latch, LatchHandle {}
export interface ResettableMasterLatch extends MasterLatch, Resettable {}
export interface ObservableLatch extends Latch, Monitor {}
export interface ObservableMasterLatch extends ObservableLatch, MasterLatch {}
export interface ResettableObservableLatch extends Latch, ResettableMonitor {}
export interface ResettableObservableMasterLatch extends ResettableObservableLatch, ResettableMasterLatch {}

export interface Future<T extends readonly any[]> extends ObservableLatch, Hold<T> {}
export interface VoidableFuture<T extends readonly any[]> extends ResettableObservableLatch, Hold<T> {}
export interface FutureController<T extends readonly any[]> extends Sink<T, void>, Future<T> {}

export const FunctionCallingLatch = class _<A extends any[]> implements ResettableMasterLatch {
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
};

export const ObservableLatch = class implements ObservableMasterLatch {
  private readonly _attachedLatches = new Set<LatchHandle>();
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
  attach (handle: LatchHandle, detach?: Monitor): void {
    if (!this._waiting) {
      // If the latch has already been released, release the new one too.
      return handle.release();
    }
    if (detach) Monitor.attach(detach, () => this._attachedLatches.delete(handle));
    this._attachedLatches.add(handle);
  }
};

export const ResettableObservableLatch = class implements ResettableObservableMasterLatch {
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
  attach (handle: ResettableLatchHandle, detach?: Monitor): void {
    this._attachedLatches.add(handle);
    if (detach) Monitor.attach(detach, () => this._attachedLatches.delete(handle));
    if (!this._waiting) {
      // If the multicasting latch has already been released, release the new one too.
      handle.release();
    }
  }
};

export const ObservableFuture = class _<T extends readonly any[]> extends ObservableLatch implements FutureController<T> {
  private readonly _latch = new ObservableLatch();
  private _value: T;

  read<R> (sink: Sink<T, R>): R {
    if (this._latch.waiting) {
      throw new Error(`Cannot read from a Future that is still waiting for a value.`);
    }
    return sink.write(...this._value);
  }

  write (...value: T): void {
    if (!this._latch.waiting) {
      throw new Error(`This future has already been written.`);
    }
    this._value = value;
    this._latch.release();
  }
};

export namespace Latch {
  /**
   * Combines two `Monitor` instances such that the provided `LatchHandle` is released only when both latches
   * have been released.
   * @returns A `LatchHandle` used to detach the downstream handle from the left and right latches.
   */
  export function and (left: Monitor_, right: Monitor_, handle: LatchHandle_, detach?: Monitor_): void {
    handle = LatchHandle(handle);
    const state: [boolean, boolean] = [false, false];
    Monitor.attach(left, new And(handle, state, 0), detach);
    Monitor.attach(right, new And(handle, state, 1), detach);
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

export function Sink<T extends readonly any[], R> (write: (...value: T) => R): Sink<T, R> {
  return { write };
}
export namespace Sink {
  export function write<T extends readonly any[], R> (sink: Sink_<T, R>, ...value: T): R {
    return typeof sink === 'function' ? sink(...value) : sink.write(...value);
  }
}

export namespace Future {
  export function concat<A extends readonly any[], B extends readonly any[]> (
    a: Future<A>,
    b: Future<B>,
    sink: Sink_<[...A, ...B], void>,
    detach?: Monitor,
  ): void {
    Latch.and(a, b, LatchHandle(() => a.read(Sink((...a: A) => b.read(Sink((...b: B) => Sink.write(sink, ...a, ...b)))))), detach);
  }
}

interface QueuedEvent<T> {
  readonly event: T;
  next: QueuedEvent<T> | undefined;
}
export class QueueableEventLatch<T> {
  private readonly _latch = new ResettableObservableLatch();
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
