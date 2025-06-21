import type { ArraySource } from './array-source';

/**
 * A draft builder for accumulating multiple `ArraySource.Event` operations and committing them as a single optimized event.
 *
 * This class allows you to build up a sequence of array operations (push, pop, unshift, shift, splice, set) and then
 * commit them as a single normalized event that represents the net effect of all operations. The class internally
 * tracks the operations and applies simple optimizations.
 *
 * Key features:
 * - **Operation merging**: Simple consecutive operations are merged (e.g. multiple pushes, adjacent splices).
 * - **Operation cancellation**: Cancelling operations (like a push followed by a pop) are eliminated.
 * - **Correctness over optimality**: Prefers generating a correct `Batch` event over a complex but potentially brittle single event.
 *
 * @example
 * ```typescript
 * const draft = new DraftArraySourceEvent<string>(5); // Array starts with length 5
 * draft.push('a', 'b');
 * draft.push('c'); // These will be merged into a single push
 * draft.set(0, 'modified');
 *
 * const event = draft.commit(); // Returns an optimized batch event in this case
 * // { kind: 'batch', events: [{ kind: 'set', ... }, { kind: 'push', ... }] }
 * ```
 */
export class DraftArraySourceEvent<T> {
  /** The projected length of the array after all operations are applied. */
  #currentLength: number;

  /** The initial size of the array before any operations. */
  readonly #initialLength: number;

  /** The ordered list of events that have been applied to this draft. */
  #events: ArraySource.Event<T>[] = [];

  /**
   * Creates a new draft for building array source events.
   * @param currentArraySize The initial size of the target array before any operations are applied.
   */
  constructor (currentArraySize: number) {
    this.#initialLength = this.#currentLength = currentArraySize;
  }

  /**
   * Adds elements to the end of the array.
   * @param values The elements to add.
   */
  push (...values: T[]): void {
    if (values.length === 0) {
      return;
    }
    this.splice(this.#currentLength, 0, ...values);
  }

  /**
   * Removes the last element of the array.
   */
  pop (): void {
    if (this.#currentLength === 0) {
      return;
    }
    this.splice(this.#currentLength - 1, 1);
  }

  /**
   * Adds elements to the beginning of the array.
   * @param values The elements to add.
   */
  unshift (...values: T[]): void {
    if (values.length === 0) {
      return;
    }
    this.splice(0, 0, ...values);
  }

  /**
   * Removes the first element of the array.
   */
  shift (): void {
    if (this.#currentLength === 0) {
      return;
    }
    this.splice(0, 1);
  }

  /**
   * Changes the contents of the array by removing or replacing existing elements and/or adding new elements.
   * This is the core method that all other mutation methods call. It adds a splice event, attempting to
   * merge it with the previous event if they are contiguous.
   * @param index The index at which to start changing the array.
   * @param deletions The number of elements to remove.
   * @param insertions The elements to add.
   */
  splice (index: number, deletions: number, ...insertions: T[]): void {
    if (index < 0 || index > this.#currentLength) {
      throw new Error(`Splice index ${index} is out of bounds for array of length ${this.#currentLength}`);
    }
    if (deletions < 0) {
      throw new Error(`Splice deletion count cannot be negative.`);
    }

    // Clamp deletions to what's available
    deletions = Math.min(deletions, this.#currentLength - index);
    if (deletions === 0 && insertions.length === 0) {
      return;
    }

    const netLengthChange = insertions.length - deletions;

    const lastEvent = this.#events.at(-1);
    if (lastEvent?.kind === 'splice') {
      // Attempt to merge with the last event if it was also a splice.

      // Merge consecutive unshifts: splice(0,0,['c']), splice(0,0,['a','b']) => splice(0,0,['a','b','c'])
      if (lastEvent.deletions === 0 && deletions === 0 && lastEvent.index === 0 && index === 0) {
        const newInsertions = [...insertions, ...lastEvent.insertions];
        this.#events[this.#events.length - 1] = { kind: 'splice', index: 0, deletions: 0, insertions: newInsertions };
        this.#currentLength += netLengthChange;
        return;
      }

      // Merge consecutive insertions: splice(2,0,'a'), splice(3,0,'b') => splice(2,0,'a','b')
      if (lastEvent.deletions === 0 && deletions === 0 && lastEvent.index + lastEvent.insertions.length === index) {
        const newInsertions = [...lastEvent.insertions, ...insertions];
        this.#events[this.#events.length - 1] = { kind: 'splice', index: lastEvent.index, deletions: 0, insertions: newInsertions };
        this.#currentLength += netLengthChange;
        return;
      }

      // Merge consecutive deletions: splice(2,1), splice(2,1) => splice(2,2)
      if (lastEvent.insertions.length === 0 && insertions.length === 0 && index === lastEvent.index) {
        const newDeletions = lastEvent.deletions + deletions;
        this.#events[this.#events.length - 1] = { kind: 'splice', index: lastEvent.index, deletions: newDeletions, insertions: [] };
        this.#currentLength += netLengthChange;
        return;
      }
    }

    this.#events.push({ kind: 'splice', index, deletions, insertions });
    this.#currentLength += netLengthChange;
  }

  /**
   * Sets the element at the specified index.
   * @param index The index of the element to set.
   * @param value The new value.
   */
  set (index: number, value: T): void {
    if (index < 0 || index >= this.#currentLength) {
      throw new Error(`Set index ${index} is out of bounds for array of length ${this.#currentLength}`);
    }

    this.#events.push({ kind: 'set', index, value });
  }

  /**
   * Applies an existing ArraySource event to this draft.
   * @param event The event to apply.
   */
  applyEvent (event: ArraySource.Event<T>): void {
    switch (event.kind) {
      case 'push': this.push(...event.values); break;
      case 'pop': this.pop(); break;
      case 'unshift': this.unshift(...event.values); break;
      case 'shift': this.shift(); break;
      case 'splice': this.splice(event.index, event.deletions, ...event.insertions); break;
      case 'set': this.set(event.index, event.value); break;
      case 'batch': {
        for (const subEvent of event.events) {
          this.applyEvent(subEvent);
        }
        break;
      }
    }
  }

  /**
   * Commits the accumulated operations and returns the optimized single event representing all changes.
   * @returns The committed event, or null if no changes were made.
   */
  commit (): ArraySource.Event<T> | null {
    // Perform a pass to apply simple optimizations.
    const optimized: ArraySource.Event<T>[] = [];
    for (const event of this.#events) {
      const last = optimized.at(-1);

      if (last?.kind === 'splice' && event.kind === 'splice' && last.deletions === 0 && last.insertions.length > 0 && event.deletions === 1 && event.insertions.length === 0) {
        // Potential cancellation of an insertion by a deletion.

        // unshift -> shift
        if (last.index === 0 && event.index === 0) {
          const newInsertions = last.insertions.slice(1); // remove first element
          if (newInsertions.length === 0) {
            optimized.pop();
          }
          else {
            optimized[optimized.length - 1] = { ...last, insertions: newInsertions };
          }
          continue;
        }

        // push -> pop
        if (event.index === last.index + last.insertions.length - 1) {
          const newInsertions = last.insertions.slice(0, -1); // remove last element
          if (newInsertions.length === 0) {
            optimized.pop();
          }
          else {
            optimized[optimized.length - 1] = { ...last, insertions: newInsertions };
          }
          continue;
        }
      }

      optimized.push(event);
    }

    this.#events = optimized;

    if (this.#events.length === 0) {
      return null;
    }

    // If there's only one event, try to convert it to the most specific event type
    if (this.#events.length === 1) {
      const event = this.#events[0];
      if (event.kind === 'splice') {
        // Is it an unshift? (insertion at the very beginning)
        if (event.deletions === 0 && event.insertions.length > 0 && event.index === 0) {
          return { kind: 'unshift', values: event.insertions };
        }
        // Is it a push? (insertion at the very end of the original array)
        if (event.deletions === 0 && event.insertions.length > 0 && event.index === this.#initialLength) {
          return { kind: 'push', values: event.insertions };
        }
      }
      return event;
    }

    // If we have multiple events, we must return a batch event
    return { kind: 'batch', events: this.#events };
  }
}
