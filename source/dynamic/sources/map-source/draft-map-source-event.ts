import type { MapSource } from './map-source';

export class DraftMapSourceEvent<K, V> {
  #add: Map<K, V> | null = null;
  #change: Map<K, V> | null = null;
  #delete: Set<K> | null = null;

  createEvent (): MapSource.Event<K, V> | null {
    if (!this.#add && !this.#change && !this.#delete) {
      return null;
    }

    return {
      add: this.#add,
      change: this.#change,
      delete: this.#delete ? Array.from(this.#delete) : null,
    };
  }

  add (key: K, value: V): void {
    if (this.#change?.has(key)) {
      throw new Error(`Cannot add key that is already marked for change: ${String(key)}`);
    }

    // Remove from deletions if present (cancels out deletion)
    this.#delete?.delete(key);
    if (this.#delete?.size === 0) {
      this.#delete = null;
    }

    // Add to additions
    if (!this.#add) {
      this.#add = new Map();
    }
    this.#add.set(key, value);
  }

  update (key: K, value: V): void {
    if (this.#delete?.has(key)) {
      throw new Error(`Cannot change key that is already marked for deletion: ${String(key)}`);
    }

    // If already in additions, update the addition value instead of treating as change
    if (this.#add?.has(key)) {
      this.#add.set(key, value);
      return;
    }

    // Add to changes
    if (!this.#change) {
      this.#change = new Map();
    }
    this.#change.set(key, value);
  }

  delete (key: K): void {
    // If in additions, just remove the addition (cancels out)
    if (this.#add?.has(key)) {
      this.#add.delete(key);
      if (this.#add.size === 0) {
        this.#add = null;
      }
      return;
    }

    // Remove from changes if present
    this.#change?.delete(key);
    if (this.#change?.size === 0) {
      this.#change = null;
    }

    // Add to deletions
    if (!this.#delete) {
      this.#delete = new Set();
    }
    this.#delete.add(key);
  }

  applyEvent (event: MapSource.Event<K, V>): void {
    if (event.add) {
      for (const [key, value] of event.add) {
        this.add(key, value);
      }
    }
    if (event.change) {
      for (const [key, value] of event.change) {
        this.update(key, value);
      }
    }
    if (event.delete) {
      for (const key of event.delete) {
        this.delete(key);
      }
    }
  }
}
