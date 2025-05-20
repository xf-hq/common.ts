import { tryDispose } from '../general/disposables';
import { isUndefined } from '../general/type-checking';

export class OnDemandResource<TResource = unknown, TData = unknown> {
  static create<TResource> (driver: OnDemandResource.Driver<TResource, void>): OnDemandResource<TResource, void>;
  static create<TResource, TData> (driver: OnDemandResource.Driver<TResource, TData>, data: TData): OnDemandResource<TResource, TData>;
  static create<TResource, TData> (driver: OnDemandResource.Driver<TResource, TData>, data?: TData) {
    return new OnDemandResource(driver, data!);
  }
  constructor (driver: OnDemandResource.Driver<TResource, TData>, data: TData) {
    this.#driver = driver;
    this.#data = data;
  }
  readonly #driver: OnDemandResource.Driver<TResource, TData>;
  readonly #data: TData;
  #refCount = 0;
  #dispose: LooseDisposable | undefined;

  get refCount () { return this.#refCount; }

  /**
   * Initializes the resource if it has not been initialized, and increments the internal reference count. Every
   * call to `require` MUST be followed in the future by a call to `release` (unless the resource is required
   * indefinitely).
   */
  require (): TResource {
    if (this.#refCount++ === 0) this.#dispose = this.#driver.initialize(this.#data);
    return this.#driver.dereference(this.#data);
  }

  /**
   * Decrements the internal reference count. If the reference count reaches zero, the resource is disposed.
   */
  release (): void {
    if (--this.#refCount === 0) {
      tryDispose(this.#dispose);
      this.#dispose = undefined;
    }
  }
}
export namespace OnDemandResource {
  export interface Driver<TResource = unknown, TData = unknown> {
    initialize (data: TData): LooseDisposable;
    dereference (data: TData): TResource;
  }
}

export interface DisposableReference<TValue> extends Disposable {
  readonly value: TValue;
}

export class OnDemandResourceMediator<TKey, TResource> {
  static create<TKey, TResource> (driver: OnDemandResourceMediator.Driver<TKey, TResource, void>): OnDemandResourceMediator<TKey, TResource>;
  static create<TKey, TResource, TData> (driver: OnDemandResourceMediator.Driver<TKey, TResource, TData>, data: TData): OnDemandResourceMediator<TKey, TResource>;
  static create <TKey, TResource, TData> (driver: OnDemandResourceMediator.Driver<TKey, TResource, TData>, data?: TData) {
    return new OnDemandResourceMediator(driver, data);
  }
  private constructor (driver: OnDemandResourceMediator.Driver<TKey, TResource, unknown>, data: unknown) {
    this.#driver = driver;
    this.#data = data;
  }
  readonly #driver: OnDemandResourceMediator.Driver<TKey, TResource, unknown>;
  readonly #data: unknown;
  readonly #resources = new Map<TKey, OnDemandResourceMediator.Entry<TKey, TResource>>();

  require (key: TKey): DisposableReference<TResource> {
    let entry = this.#resources.get(key);
    if (isUndefined(entry)) {
      this.#resources.set(key, entry = {
        key,
        value: this.#driver.initialize(this.#data, key),
        refCount: 1,
      });
    }
    else {
      ++entry.refCount;
    }
    return new OnDemandResourceMediator.Ref(this, entry);
  }

  private release (entry: OnDemandResourceMediator.Entry<TKey, TResource>): void {
    if (--entry.refCount === 0) {
      this.#resources.delete(entry.key);
      this.#driver.release?.(this.#data, entry.key, entry.value);
    }
  }

  static readonly Ref = class OnDemandResourceMediatorRef<TResource> implements DisposableReference<TResource> {
    constructor (mediator: OnDemandResourceMediator<any, TResource>, entry: OnDemandResourceMediator.Entry<any, TResource>) {
      this.#mediator = mediator;
      this.#entry = entry;
    }
    readonly #mediator: OnDemandResourceMediator<any, TResource>;
    readonly #entry: OnDemandResourceMediator.Entry<any, TResource>;
    #disposed = false;

    get value () {
      assertNotDisposedWhenAccessingValue(this.#disposed);
      return this.#entry.value;
    }

    [Symbol.dispose] () {
      if (this.#disposed) return;
      this.#disposed = true;
      this.#mediator.release(this.#entry);
    }
  };
}
export namespace OnDemandResourceMediator {
  export interface Driver<TKey, TResource, TData> {
    initialize (data: TData, key: TKey): TResource;
    release? (data: TData, key: TKey, resource: TResource): void;
  }
  export interface Entry<TKey, TResource> {
    readonly key: TKey;
    readonly value: TResource;
    refCount: number;
  }
}

function assertNotDisposedWhenAccessingValue (disposed: boolean) {
  if (disposed) {
    throw new Error(`Cannot access resource after the reference has been released.`);
  }
}
