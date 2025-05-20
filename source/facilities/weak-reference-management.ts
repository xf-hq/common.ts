import { isUndefined, isDefined } from '../general/type-checking';

export class AssociativeWeakSet<K, V extends object> {
  #map: Map<K, WeakRef<V>>;
  #registry: FinalizationRegistry<K>;
  #ensureInitialized () {
    if (isUndefined(this.#map)) {
      this.#map = new Map();
      const watch = this.#watch;
      this.#registry = new FinalizationRegistry(isDefined(watch)
        ? (key: K) => {
          this.#map.delete(key);
          if (isDefined(watch.onFinalize)) watch.onFinalize(key);
          if (isDefined(watch.onEmpty) && this.#map.size === 0) watch.onEmpty();
        }
        : (key: K) => this.#map.delete(key)
      );
    }
  }

  constructor (watch?: AssociativeWeakSet.Watch<K>) { this.#watch = watch; }
  readonly #watch: AssociativeWeakSet.Watch<K> | undefined;

  get size (): number {
    return this.#map?.size ?? 0;
  }

  has (key: K): boolean {
    return this.#map?.has(key) ?? false;
  }
  get (key: K): V | undefined {
    return this.#map?.get(key)?.deref();
  }
  set (key: K, value: V): void {
    this.#ensureInitialized();
    const ref = new WeakRef(value);
    this.#map.set(key, ref);
    this.#registry.register(value, key, ref);
  }
  delete (key: K): boolean {
    if (isUndefined(this.#map)) return false;
    const ref = this.#map.get(key);
    if (isUndefined(ref)) return false;
    const result = this.#map.delete(key);
    this.#registry.unregister(ref);
    return result;
  }
  clear (): void {
    if (isUndefined(this.#map)) return;
    for (const ref of this.#map.values()) {
      this.#registry.unregister(ref);
    }
    this.#map.clear();
  }
}
export namespace AssociativeWeakSet {
  export interface Watch<K> {
    onFinalize?: (key: K) => void;
    onEmpty?: () => void;
  }
}
