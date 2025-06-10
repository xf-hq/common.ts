import { FailSafe } from './failsafe';
import { isArray, isDefined, isFunction, isNothing, isObject, isUndefined } from './type-checking';

// Polyfill
if (isUndefined(Symbol.dispose)) Object.defineProperties(Symbol, {
  dispose: { value: Symbol('Symbol.dispose') },
  asyncDispose: { value: Symbol('Symbol.asyncDispose') },
});

/**
 * Ensures that the target disposable will never be recognised by this disposal library as having been previously
 * disposed, which may lead to disposal calls for the target being ignored.
 * @remarks
 * There are certain special cases where a disposable needs to be able to be redisposed multiple times. The use case
 * that drove the introduction of this function was the `DEFAULT_GROUP_END` object returned by
 * `DEFAULT_CONSOLE_LOGGER.group.endOnDispose(...)`, whose usage is intended to be paired with a `using` statement.
 * Rather than constructing a new `Disposable` object every time `endOnDispose` is called, it is more efficient to keep
 * reusing the same object, seeing as the only effect of calling `[Symbol.dispose]()` in this case is that a call to
 * `console.groupEnd()` is made - exactly what we want when the variable declared by `using` goes out of scope.
 */
export function neverRegisterAsDisposed<T extends Disposable> (target: T): T {
  Internal.neverRegisterAsDisposed(target);
  return target;
}

export const isDisposable = (value: any): value is Disposable => isObject(value) && isFunction(value[Symbol.dispose]);
export const isLegacyDisposable = (value: any): value is LegacyDisposable => isFunction(value?.dispose);

export function dispose (disposable: Disposable): undefined {
  if (isVerifiableNoopOnDispose(disposable)) return;
  Internal.registerAsDisposed(disposable);
  disposable[Symbol.dispose]();
}
export function disposeArray (disposables: Disposable[]) {
  for (let i = 0; i < disposables.length; i++) {
    dispose(disposables[i]);
  }
}
export function disposeProperties (props: SRecord.Of<Disposable>) {
  for (const key in props) {
    dispose(props[key]);
  }
}
export function tryDispose (...disposables: LooseDisposable[]) {
  tryDisposeArray(disposables);
}
export function tryDisposeArray (disposables: readonly LooseDisposable[]) {
  for (let i = 0; i < disposables.length; i++) {
    Internal.tryDispose(disposables[i]);
  }
}
export function tryDisposeProperties (props: SRecord.Of<LooseDisposable> | Nothing) {
  for (const key in props) {
    Internal.tryDispose(props[key]);
  }
}
export function disposeOnAbort<T extends LooseDisposable> (abortSignal: AbortSignal, disposable: T): T {
  abortSignal.addEventListener('abort', () => {
    tryDispose(disposable);
  });
  return disposable;
}

const finalizer = new FinalizationRegistry(dispose);
export function registerForAutomaticDisposal (disposable: Disposable): void;
export function registerForAutomaticDisposal (monitoredTarget: WeakKey, disposable: Disposable): void;
export function registerForAutomaticDisposal (monitoredTarget: WeakKey | Disposable, disposable?: Disposable): void {
  if (isUndefined(disposable)) finalizer.register(monitoredTarget as Disposable, monitoredTarget as Disposable);
  else finalizer.register(monitoredTarget as Disposable, disposable);
}

export const noopDispose: DisposableFunction = Object.defineProperties((() => {}) as DisposableFunction, {
  [Symbol.dispose]: { get () { return noopDispose; } },
  isNoopOnDispose: { value: true },
});
export const NoopDisposable: ExtendedDisposable = noopDispose;

export const registerDisposableAsNoop = <T extends Disposable>(a: T): T => { Internal.registerAsDisposed(a); return a; };

export const isVerifiableNoopOnDispose = (target: LooseDisposable): boolean => {
  if (isNothing(target)) return true;
  if (Internal.isRegisteredAsDisposed(target)) return true;
  if (isArray(target)) return target.every(isVerifiableNoopOnDispose);
  if (isDisposable(target)) {
    if (target['isNoopOnDispose'] === true) {
      Internal.registerAsDisposed(target);
      return true;
    }
    const _dispose = target[Symbol.dispose];
    if (_dispose === noopDispose || Internal.isRegisteredAsDisposed(_dispose)) {
      Internal.registerAsDisposed(target);
      return true;
    }
    return false;
  }
  if (isLegacyDisposable(target)) {
    if (Internal.isRegisteredAsDisposed(target)) return true;
    if (Internal.isRegisteredAsDisposed(target.dispose)) {
      Internal.registerAsDisposed(target);
      return true;
    }
  }
  return false;
};

export function disposableFunction (disposalTarget: LooseDisposable): DisposableFunction {
  if (isNothing(disposalTarget)) return noopDispose;
  const dispose = Internal.disposalFunctionFrom(disposalTarget);
  if (Symbol.dispose in disposalTarget) return disposalTarget as DisposableFunction;
  return new Proxy(dispose as DisposableFunction, PROXY_HANDLER);
}
export namespace disposableFunction {
  export function async (callback: () => Promise<LooseDisposable>): DisposableFunction {
    return disposableFunction(SettableDisposable.createAsync(callback));
  }
}

const PROXY_HANDLER: ProxyHandler<DisposableFunction> = {
  has (target: DisposableFunction, p: string | symbol) {
    switch (p) {
      case Symbol.dispose: return true;
      case 'isNoopOnDispose': return true;
      default: return Reflect.has(target, p);
    }
  },
  get (target: DisposableFunction, p: string | symbol, receiver: DisposableFunction) {
    switch (p) {
      case Symbol.dispose: return target;
      case 'isNoopOnDispose': return isVerifiableNoopOnDispose(receiver);
      default: return Reflect.get(target, p, receiver);
    }
  },
};

export const disposalFunctionFrom = (...disposalTargets: LooseDisposable[]): Dispose => Internal.disposalFunctionFrom(disposalTargets);

export function disposableFrom (...target: LooseDisposable[]): Disposable {
  switch (target.length) {
    case 0: return NoopDisposable;
    case 1: return Internal.disposableFrom(target[0]);
    default: return disposableFromArray(target);
  }
}

export function disposableFromMethod<A extends any[]> (method: (...args: A) => void, thisArg: any, ...args: A): Disposable {
  return (args.length === 0 && isVerifiableNoopOnDispose(method)) ? NoopDisposable : new DisposableFromFunction(method, thisArg, ...args);
}

export function disposableFromArray (disposalTargets: LooseDisposable[]): Disposable {
  const disposables: Disposable[] | undefined = Internal.appendToArrayOfDisposables(disposalTargets);
  if (isUndefined(disposables)) return NoopDisposable;
  switch (disposables.length) {
    case 0: return NoopDisposable;
    case 1: return disposables[0];
    default: return new DisposableFromArrayOfDisposables(disposables);
  }
}
export namespace disposableFromArray {
  export function map<TElement> (map: (element: TElement) => LooseDisposable, elements: readonly TElement[]): Disposable {
    return disposableFromArray(elements.map(map));
  }
}

export function maybeAppendLooseDisposable (array: LooseDisposable[], disposalTarget: LooseDisposable): boolean {
  if (isVerifiableNoopOnDispose(disposalTarget)) return false;
  array.push(disposalTarget);
  return true;
}

export function concatLooseDisposables (left: LooseDisposable, right: LooseDisposable) {
  if (isVerifiableNoopOnDispose(left)) return right;
  if (isVerifiableNoopOnDispose(right)) return left;
  return [left, right];
}

/** Note that we do not take ownership of {@link props} here. The caller can continue to manage the properties of the
 * props record after this function returns. The returned disposable only iterates through the properties of the record
 * at the time of disposal. */
export function disposableFromRecord (props: SRecord.Of<LooseDisposable>): Disposable { return new DisposableFromProps(props); }
export namespace disposableFromRecord {
  export const asFunction = (props: SRecord.Of<LooseDisposable>): Dispose => new DisposableFromProps(props).toFunction();
}

namespace Internal {
  const _registeredAsDisposed = new WeakSet<LooseDisposable.NotNothing>([NoopDisposable, noopDispose]);
  const _idempotentDisposeFunctions = new WeakSet<Dispose>([noopDispose]);
  const _nonRegisterableDisposables = new WeakSet<Disposable>([NoopDisposable, noopDispose]);

  export const isRegisteredAsDisposed = (target: LooseDisposable.NotNothing): boolean => (_registeredAsDisposed).has(target);
  export function registerAsDisposed (target: LooseDisposable.NotNothing) {
    if (isDisposable(target) && _nonRegisterableDisposables.has(target)) return;
    _registeredAsDisposed.add(target);
  }
  export function neverRegisterAsDisposed (target: Disposable): void { _nonRegisterableDisposables.add(target); }

  export function tryDispose (disposable: LooseDisposable) {
    if (isNothing(disposable) || isVerifiableNoopOnDispose(disposable)) return;
    registerAsDisposed(disposable);
    if (isFunction(disposable)) disposable();
    else if (isArray(disposable)) disposable.forEach(tryDispose);
    else disposable[Symbol.dispose]?.();
  }

  export function disposalFunctionFrom (disposalTarget: LooseDisposable): Dispose {
    if (isNothing(disposalTarget)) return noopDispose;
    if (isFunction(disposalTarget)) {
      if (isRegisteredAsDisposed(disposalTarget)) return noopDispose;
      return createIdempotentDisposeFunction(disposalTarget);
    }
    if (isArray(disposalTarget)) {
      let targetsToDispose: (Dispose | Disposable | LegacyDisposable)[] | undefined;
      for (let i = 0; i < disposalTarget.length; ++i) {
        targetsToDispose = appendToArrayOfDisposalFunctions(disposalTarget[i], targetsToDispose);
      }
      if (isUndefined(targetsToDispose)) return noopDispose;
      if (targetsToDispose.length === 1) return createIdempotentDisposeFunction(targetsToDispose[0]);
      return createIdempotentDisposeFunction(new DisposableFromArrayOfFlexibleDisposables(targetsToDispose));
    }
    return isVerifiableNoopOnDispose(disposalTarget) ? noopDispose : createIdempotentDisposeFunction(disposalTarget);
  }

  export function createIdempotentDisposeFunction (disposable: Dispose | Disposable | LegacyDisposable): Dispose {
    if (isFunction(disposable) && _idempotentDisposeFunctions.has(disposable)) return disposable;
    let disposed = false;
    const dispose = () => {
      if (disposed) return;
      disposed = true;
      tryDispose(disposable);
    };
    _idempotentDisposeFunctions.add(dispose);
    return dispose;
  }

  export function disposableFrom (target: LooseDisposable): Disposable {
    if (isNothing(target)) return NoopDisposable;
    if (isVerifiableNoopOnDispose(target)) return NoopDisposable;
    if (isFunction(target)) return new DisposableFromFunction(target);
    if (isArray(target)) return disposableFromArray(target);
    if (isDisposable(target)) return target;
    if (isFunction(target.dispose)) return new DisposableFromLegacyDisposable(target);
    return NoopDisposable;
  }

  export function appendToArrayOfDisposables (target: LooseDisposable): Disposable[] | undefined;
  export function appendToArrayOfDisposables<T extends Disposable[] | undefined> (target: LooseDisposable, disposables: T): T;
  export function appendToArrayOfDisposables (target: LooseDisposable, disposables?: Disposable[] | undefined): Disposable[] | undefined {
    if (isNothing(target) || isVerifiableNoopOnDispose(target)) return disposables;
    if (isArray(target)) {
      for (let i = 0; i < target.length; ++i) {
        disposables = appendToArrayOfDisposables(target[i], disposables);
      }
      return disposables;
    }
    const disposable = disposableFrom(target);
    if (disposable === NoopDisposable) return disposables;
    if (isUndefined(disposables)) disposables = [disposable];
    else disposables.push(disposable);
    return disposables;
  }

  export function appendToArrayOfDisposalFunctions (target: LooseDisposable, targetsToDispose: (Dispose | Disposable | LegacyDisposable)[] | undefined): (Dispose | Disposable | LegacyDisposable)[] | undefined {
    if (isNothing(target) || Internal.isRegisteredAsDisposed(target)) return targetsToDispose;
    if (isArray(target)) {
      for (let i = 0; i < target.length; ++i) {
        targetsToDispose = appendToArrayOfDisposalFunctions(target[i], targetsToDispose);
      }
    }
    else if (isUndefined(targetsToDispose)) return [target];
    else targetsToDispose.push(target);
    return targetsToDispose;
  }
}

export abstract class SafeDisposable implements ExtendedDisposable {
  #disposed = false;

  [Symbol.dispose] (): void {
    if (this.isNoopOnDispose) return;
    this.#disposed = true;
    this.onDispose();
  }

  get isNoopOnDispose () { return this.#disposed; }
  get isDisposed () { return this.#disposed; }

  protected abstract onDispose (): void;

  toFunction (): DisposableFunction {
    return disposableFunction(this);
  }
}

export class DisposableFromFunction<A extends any[]> extends SafeDisposable {
  constructor (dispose: (...args: A) => void, thisArg?: any, ...args: A) {
    super();
    this.#dispose = dispose;
    this.#thisArg = thisArg;
    this.#args = args;
  }
  readonly #dispose: () => void;
  readonly #thisArg: any;
  readonly #args: A;

  override onDispose (): void {
    if (this.#args.length === 0) Internal.registerAsDisposed(this.#dispose);
    this.#dispose.apply(this.#thisArg, this.#args);
  }
}

export class DisposableFromLegacyDisposable extends SafeDisposable {
  constructor (disposable: LegacyDisposable) {
    super();
    this.#disposable = disposable;
  }
  readonly #disposable: LegacyDisposable;

  override onDispose (): void {
    this.#disposable.dispose();
  }
}

export class DisposableFromArrayOfDisposables extends SafeDisposable {
  constructor (disposables: Disposable[]) {
    super();
    this.#disposables = disposables;
  }
  readonly #disposables: Disposable[];

  protected override onDispose (): void {
    for (let i = 0; i < this.#disposables.length; ++i) {
      this.#disposables[i][Symbol.dispose]();
    }
  }
}

export class DisposableFromArrayOfFlexibleDisposables extends SafeDisposable {
  constructor (disposables: LooseDisposable[]) {
    super();
    this.#disposables = disposables;
  }
  readonly #disposables: LooseDisposable[];

  protected override onDispose (): void {
    for (let i = 0; i < this.#disposables.length; ++i) {
      tryDispose(this.#disposables[i]);
    }
  }
}

export class DisposableFromProps extends SafeDisposable {
  constructor (props: SRecord.Of<LooseDisposable>) {
    super();
    this.#props = props;
  }
  readonly #props: SRecord.Of<LooseDisposable>;

  protected override onDispose (): void {
    tryDisposeProperties(this.#props);
  }
}

export class CombinedDisposable extends SafeDisposable {
  static create (f: (disposables: CombinedDisposable) => Disposable | void): Disposable {
    const combined = new CombinedDisposable();
    return f(combined) ?? combined;
  }
  constructor (disposables?: LooseDisposable[]) {
    super();
    if (isDefined(disposables)) this.add(disposables);
  }
  readonly #disposables: Disposable[] = [];

  add (...disposalTargets: LooseDisposable[]): this {
    const disposable = disposableFromArray(disposalTargets);
    if (disposable !== NoopDisposable) this.#disposables.push(disposable);
    return this;
  }
  removeAndDispose (disposable: Disposable): this {
    return this.#remove(disposable, true);
  }
  removeOnly (disposable: Disposable): this {
    return this.#remove(disposable, false);
  }

  #remove (disposable: Disposable, dispose: boolean): this {
    const disposables = this.#disposables;
    const index = disposables.indexOf(disposable);
    if (index >= 0) disposables.splice(index, 1);
    if (dispose) disposable[Symbol.dispose]();
    return this;
  }

  child (): CombinedDisposable {
    const child = new CombinedDisposable.Child(this);
    this.#disposables.push(child);
    return child;
  }

  override onDispose (): void {
    for (let i = 0; i < this.#disposables.length; ++i) {
      this.#disposables[i][Symbol.dispose]();
    }
  }
}
export namespace CombinedDisposable {
  export class Child extends CombinedDisposable {
    constructor (parent: CombinedDisposable) {
      super();
      this.#parent = parent;
    }
    readonly #parent: CombinedDisposable;
    override onDispose (): void {
      this.#parent.removeOnly(this);
      super.onDispose();
    }
  }
}

export class IndexedDisposable extends SafeDisposable {
  constructor (disposables?: LooseDisposable[]) {
    super();
    this.#disposables = disposables?.map(Internal.disposableFrom) ?? [];
  }
  readonly #disposables: Disposable[];

  get length (): number { return this.#disposables.length; }

  push (...disposables: LooseDisposable[]): number {
    if (!this.isNoopOnDispose) return this.#disposables.push(...disposables.map(Internal.disposableFrom)) - 1;
    disposables.forEach(Internal.tryDispose);
    return -1;
  }
  set (index: number, disposable: LooseDisposable): this {
    if (this.isNoopOnDispose) {
      tryDispose(disposable);
      return this;
    }
    const disposables = this.#disposables;
    const oldDisposable = disposables[index];
    if (oldDisposable) oldDisposable[Symbol.dispose]();
    while (index > disposables.length) {
      disposables.push(NoopDisposable);
    }
    disposables[index] = Internal.disposableFrom(disposable);
    return this;
  }
  unset (index: number): this {
    if (this.isNoopOnDispose) return this;
    const disposables = this.#disposables;
    const disposable = disposables[index];
    if (disposable) {
      disposables[index] = NoopDisposable;
      disposable[Symbol.dispose]();
    }
    return this;
  }
  splice (start: number, deleteCount: number, ...insertions: LooseDisposable[]): this {
    if (this.isNoopOnDispose) {
      tryDispose(...insertions);
      return this;
    }
    const disposables = this.#disposables;
    const removed = disposables.splice(start, deleteCount, ...insertions.map(Internal.disposableFrom));
    for (let i = 0; i < removed.length; ++i) {
      removed[i][Symbol.dispose]();
    }
    return this;
  }
  clear () {
    if (this.isNoopOnDispose) return;
    const disposables = this.#disposables;
    for (let i = 0; i < disposables.length; ++i) {
      disposables[i][Symbol.dispose]();
    }
    disposables.length = 0;
  }

  override onDispose (): void {
    for (let i = 0; i < this.#disposables.length; ++i) {
      this.#disposables[i][Symbol.dispose]();
    }
  }
}

export class DisposableGroup<K = any> extends SafeDisposable {
  private _state?: {
    map?: Map<K, LooseDisposable>;
    set?: Set<Disposable>;
  };
  private get _map (): Map<K, LooseDisposable> {
    const state = this._state ??= {};
    return state.map ??= new Map();
  }
  private get _set (): Set<Disposable> {
    const state = this._state ??= {};
    return state.set ??= new Set();
  }

  get size (): number { return this._map.size; }

  add (disposable: LooseDisposable): void {
    if (this.isNoopOnDispose) {
      Internal.tryDispose(disposable);
      return;
    }
    disposable = Internal.disposableFrom(disposable);
    if (isVerifiableNoopOnDispose(disposable)) return;
    this._set.add(disposable);
  }

  has (key: K): boolean {
    return this._map.has(key);
  }
  set (key: K, disposable: LooseDisposable, disposeExisting = true): this {
    if (this.isNoopOnDispose) {
      Internal.tryDispose(disposable);
      return this;
    }
    const map = this._map;
    if (disposeExisting && map.has(key)) {
      const oldDisposable = map.get(key);
      tryDispose(oldDisposable);
    }
    map.set(key, disposable);
    return this;
  }
  /**
   * Deletes the entry with the specified key, optionally disposing it as well. Disposal is the default behaviour but
   * can be skipped via the `disposeDeletedEntry` parameter.
   * @param key The key of the entry to delete.
   * @param disposeDeletedEntry Defaults to true. If false, the entry is deleted but no attempt is made to dispose it.
   */
  delete (key: K, disposeDeletedEntry = true): boolean {
    if (this.isNoopOnDispose) return false;
    const map = this._map;
    if (!map.has(key)) return false;
    if (disposeDeletedEntry) {
      const disposable = this._map.get(key);
      tryDispose(disposable);
    }
    this._map.delete(key);
    return true;
  }

  *keys () { yield* this._map.keys(); }

  create (key?: K): DisposableGroup {
    const group = new DisposableGroup();
    if (isDefined(key)) this.set(key, group);
    else this.add(group);
    return group;
  }

  override onDispose (): void {
    if (isDefined(this._map)) {
      for (const disposable of this._map.values()) {
        tryDispose(disposable);
      }
    }
    if (isDefined(this._set)) {
      for (const disposable of this._set) {
        disposable[Symbol.dispose]();
      }
    }
    this._map.clear();
  }
}

export class SettableDisposable extends SafeDisposable {
  static create (f: (disposable: SettableDisposable) => LooseDisposable): SettableDisposable {
    const disposable = new SettableDisposable();
    disposable.set(f(disposable));
    return disposable;
  }
  static createAsync (f: () => Promise<LooseDisposable>): SettableDisposable {
    const disposable = new SettableDisposable();
    f().then(disposable.set.bind(disposable));
    return disposable;
  }

  static queueMicrotask<A extends any[]> (f: LooseDisposable.Factory<A>, ...args: A): SettableDisposable;
  static queueMicrotask<A extends any[]> (target: SettableDisposable, f: LooseDisposable.Factory<A>, ...args: A): SettableDisposable;
  static queueMicrotask<A extends any[]> (f_or_target: SettableDisposable | LooseDisposable.Factory<A>): SettableDisposable {
    let target: SettableDisposable;
    let f: (...args: A) => Disposable | void;
    let args: A;
    if (isFunction(f_or_target)) {
      target = new SettableDisposable();
      f = arguments[0];
      args = Array.prototype.slice.call(arguments, 1);
    }
    else {
      target = arguments[0];
      f = arguments[1];
      args = Array.prototype.slice.call(arguments, 2);
    }
    FailSafe.queueMicrotask(() => target.set(f(...args)));
    return target;
  }

  constructor (current?: LooseDisposable) {
    super();
    this.#disposable = current;
  }

  #disposable: LooseDisposable;

  set (disposable: LooseDisposable): boolean {
    // If this instance of SettableDisposable was disposed at any point prior to now, isNoopOnDispose will return true.
    if (this.isNoopOnDispose) {
      tryDispose(disposable);
      return false;
    }
    const oldDisposable = this.#disposable;
    if (disposable !== oldDisposable) {
      this.#disposable = disposable;
      tryDispose(oldDisposable);
    }
    return true;
  }

  setWith<A extends any[]> (f: (...args: A) => LooseDisposable, thisArg: object | null, ...args: A): boolean {
    if (this.isNoopOnDispose) return false;
    return this.set(f.apply(thisArg, args));
  }

  queueMicrotask<A extends any[]> (f: (...args: A) => LooseDisposable, thisArg: object | null, ...args: A): void {
    FailSafe.queueMicrotask(() => this.setWith(f, thisArg, ...args));
  }

  unset () {
    if (this.isNoopOnDispose) return;
    const disposable = this.#disposable;
    if (isDefined(disposable)) {
      this.#disposable = undefined;
      tryDispose(disposable);
    }
  }

  toFunction (): DisposableFunction {
    return disposableFunction(this);
  }

  override onDispose (): void {
    tryDispose(this.#disposable);
  }
}
