import type { SetSource } from './set-source';

export class DraftSetSourceEvent<T> {
  #add: Set<T> | null = null;
  #delete: Set<T> | null = null;

  createEvent (): SetSource.Event<T> | null {
    if (!this.#add && !this.#delete) {
      return null;
    }

    return {
      add: this.#add ? Array.from(this.#add) : null,
      delete: this.#delete ? Array.from(this.#delete) : null,
    };
  }

  add (value: T): void {
    // Remove from deletions if present (cancels out deletion)
    this.#delete?.delete(value);
    if (this.#delete?.size === 0) {
      this.#delete = null;
    }

    // Add to additions
    if (!this.#add) {
      this.#add = new Set();
    }
    this.#add.add(value);
  }

  delete (value: T): void {
    // If in additions, just remove the addition (cancels out)
    if (this.#add?.has(value)) {
      this.#add.delete(value);
      if (this.#add.size === 0) {
        this.#add = null;
      }
      return;
    }

    // Add to deletions
    if (!this.#delete) {
      this.#delete = new Set();
    }
    this.#delete.add(value);
  }

  applyEvent (event: SetSource.Event<T>): void {
    if (event.add) {
      for (const value of event.add) {
        this.add(value);
      }
    }
    if (event.delete) {
      for (const value of event.delete) {
        this.delete(value);
      }
    }
  }
}
