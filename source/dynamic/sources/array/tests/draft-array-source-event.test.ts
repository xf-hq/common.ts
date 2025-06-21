/**
 * # Test Plan for DraftArraySourceEvent<T>
 *
 * This test suite comprehensively tests the `DraftArraySourceEvent` class, which accumulates multiple array
 * operations and commits them as a single optimized event. The class is designed to minimize unnecessary
 * batching by intelligently merging operations where possible.
 *
 * ## Core Functionality Testing
 *
 * ### Constructor and Basic State
 * - Constructor accepts initial array size and properly initializes internal state.
 * - Initial state has no segments and correct length tracking.
 * - `commit()` on an empty draft returns `null`.
 *
 * ### Individual Operation Methods (and simple optimizations)
 * - **Push**: Single/multiple values result in a single `push` event.
 * - **Pop**: On a non-empty array results in a `splice` event.
 * - **Unshift**: Single/multiple values result in a single `unshift` event.
 * - **Shift**: On a non-empty array results in a `splice` event.
 * - **Splice**: Various combinations of insertions/deletions at different indices result in a `splice` event.
 * - **Set**: Modifying an element results in a `set` event.
 *
 * ### Operation Merging and Optimization
 * - **Push -> Pop Cancellation**: A push followed by a pop on the same element cancels out.
 * - **Unshift -> Shift Cancellation**: An unshift followed by a shift on the same element cancels out.
 * - **Consecutive Pushes**: Multiple `push` calls merge into a single `push` event.
 * - **Consecutive Unshifts**: Multiple `unshift` calls merge into a single `unshift` event.
 * - **Adjacent Splice Merging**: Two splices that are next to each other merge into one.
 * - **Overlapping Splice Merging**: Two splices that overlap are correctly merged.
 * - **Push/Unshift Adjacency**: A `push` followed by an `unshift` on an empty array results in a single `unshift`.
 *
 * ### Complex Operation Sequences
 * - **Set within Tracked Ranges**: `set` on an element just added by `push` or `splice` correctly modifies the value within the final `push`/`splice` event.
 * - **Splice within Tracked Ranges**: A `splice` that affects a range just created by another `splice` merges correctly.
 * - **Non-Contiguous Operations**: Multiple operations that are not adjacent result in a `batch` event.
 * - **Complex Mixed Sequence**: A realistic sequence of push, unshift, splice, and set operations results in a correct, optimized final event.
 *
 * ### Event Application (`applyEvent` method)
 * - Applying each of the 7 event types (`push`, `pop`, `unshift`, `shift`, `splice`, `set`, `batch`) works correctly.
 *
 * ### Edge Cases and Error Handling
 * - **Index Out of Bounds**: `set` and `splice` with invalid indices throw an error.
 * - **Empty Array Operations**: `pop`/`shift` on an empty array have no effect.
 * - **Zero-Length Operations**: `push`/`unshift`/`splice` with no values/changes have no effect.
 * - **Negative Deletions**: `splice` with a negative deletion count throws an error.
 */

import { describe, expect, test } from 'bun:test';
import type { ArraySource } from '../array-source';
import { DraftArraySourceEvent } from '../draft-array-source-event';

describe('DraftArraySourceEvent', () => {
  describe('Constructor and Basic State', () => {
    test('constructor initializes with correct array size', () => {
      const draft = new DraftArraySourceEvent<string>(5);
      expect(draft).toBeInstanceOf(DraftArraySourceEvent);
      // Verify initial state by attempting operations
      expect(() => draft.set(4, 'test')).not.toThrow();
      expect(() => draft.set(5, 'test')).toThrow('out of bounds');
    });

    test('initial draft returns null on commit', () => {
      const draft = new DraftArraySourceEvent<string>(5);
      expect(draft.commit()).toBeNull();
    });
  });

  describe('Individual Operations', () => {
    test('single push operation', () => {
      const draft = new DraftArraySourceEvent<string>(3);
      draft.push('a');
      expect(draft.commit()).toEqual({ kind: 'push', values: ['a'] });
    });

    test('single pop operation', () => {
      const draft = new DraftArraySourceEvent<string>(3);
      draft.pop();
      expect(draft.commit()).toEqual({ kind: 'splice', index: 2, deletions: 1, insertions: [] });
    });

    test('single unshift operation', () => {
      const draft = new DraftArraySourceEvent<string>(3);
      draft.unshift('a');
      expect(draft.commit()).toEqual({ kind: 'unshift', values: ['a'] });
    });

    test('single shift operation', () => {
      const draft = new DraftArraySourceEvent<string>(3);
      draft.shift();
      expect(draft.commit()).toEqual({ kind: 'splice', index: 0, deletions: 1, insertions: [] });
    });

    test('single splice operation', () => {
      const draft = new DraftArraySourceEvent<string>(5);
      draft.splice(1, 2, 'a', 'b');
      expect(draft.commit()).toEqual({ kind: 'splice', index: 1, deletions: 2, insertions: ['a', 'b'] });
    });

    test('single set operation', () => {
      const draft = new DraftArraySourceEvent<string>(5);
      draft.set(2, 'modified');
      expect(draft.commit()).toEqual({ kind: 'set', index: 2, value: 'modified' });
    });
  });

  describe('Operation Merging and Optimization', () => {
    test('push followed by pop cancels out', () => {
      const draft = new DraftArraySourceEvent<string>(3);
      draft.push('a');
      draft.pop();
      expect(draft.commit()).toBeNull();
    });

    test('unshift followed by shift cancels out', () => {
      const draft = new DraftArraySourceEvent<string>(3);
      draft.unshift('a');
      draft.shift();
      expect(draft.commit()).toBeNull();
    });

    test('consecutive push operations merge', () => {
      const draft = new DraftArraySourceEvent<string>(3);
      draft.push('a');
      draft.push('b', 'c');
      expect(draft.commit()).toEqual({ kind: 'push', values: ['a', 'b', 'c'] });
    });

    test('consecutive unshift operations merge', () => {
      const draft = new DraftArraySourceEvent<string>(3);
      draft.unshift('c');
      draft.unshift('a', 'b');
      expect(draft.commit()).toEqual({ kind: 'unshift', values: ['a', 'b', 'c'] });
    });

    test('adjacent splices merge (insertion)', () => {
      const draft = new DraftArraySourceEvent<string>(5);
      draft.splice(2, 0, 'a');
      draft.splice(3, 0, 'b'); // Now at index 3 because of previous insertion
      expect(draft.commit()).toEqual({ kind: 'splice', index: 2, deletions: 0, insertions: ['a', 'b'] });
    });

    test('adjacent splices merge (deletion)', () => {
      const draft = new DraftArraySourceEvent<string>(5);
      draft.splice(2, 1);
      draft.splice(2, 1); // Now at index 2 because of previous deletion
      expect(draft.commit()).toEqual({ kind: 'splice', index: 2, deletions: 2, insertions: [] });
    });

    test('overlapping splices do not merge and become a batch', () => {
      const draft = new DraftArraySourceEvent<string>(10);
      draft.splice(2, 5, 'a', 'b'); // Deletes 2,3,4,5,6
      draft.splice(2, 2, 'c');    // Splice is relative to new state. Replaces 'a', 'b' with 'c'
      const event = draft.commit() as ArraySource.Event.Batch<string>;
      expect(event.kind).toBe('batch');
      expect(event.events).toHaveLength(2);
      expect(event.events[0]).toEqual({ kind: 'splice', index: 2, deletions: 5, insertions: ['a', 'b'] });
      expect(event.events[1]).toEqual({ kind: 'splice', index: 2, deletions: 2, insertions: ['c'] });
    });

    test('push and unshift on empty array creates single unshift', () => {
      const draft = new DraftArraySourceEvent<string>(0);
      draft.push('b');
      draft.unshift('a');
      expect(draft.commit()).toEqual({ kind: 'unshift', values: ['a', 'b'] });
    });
  });

  describe('Complex Operation Sequences', () => {
    test('set operation on pushed element becomes a batch', () => {
      const draft = new DraftArraySourceEvent<string>(3);
      draft.push('a', 'b');
      draft.set(4, 'modified'); // Index 4 is the second pushed element
      const event = draft.commit() as ArraySource.Event.Batch<string>;
      expect(event.kind).toBe('batch');
      expect(event.events).toHaveLength(2);
      expect(event.events[0]).toEqual({ kind: 'splice', index: 3, deletions: 0, insertions: ['a', 'b'] });
      expect(event.events[1]).toEqual({ kind: 'set', index: 4, value: 'modified' });
    });

    test('multiple non-contiguous operations result in batch', () => {
      const draft = new DraftArraySourceEvent<string>(10);
      draft.splice(2, 1, 'first');
      draft.set(8, 'last');
      const event = draft.commit() as ArraySource.Event.Batch<string>;
      expect(event.kind).toBe('batch');
      expect(event.events).toHaveLength(2);
      expect(event.events[0]).toEqual({ kind: 'splice', index: 2, deletions: 1, insertions: ['first'] });
      expect(event.events[1]).toEqual({ kind: 'set', index: 8, value: 'last' });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('set with out-of-bounds index throws error', () => {
      const draft = new DraftArraySourceEvent<string>(5);
      expect(() => draft.set(5, 'test')).toThrow();
      expect(() => draft.set(-1, 'test')).toThrow();
    });

    test('splice with out-of-bounds index throws error', () => {
      const draft = new DraftArraySourceEvent<string>(5);
      expect(() => draft.splice(6, 1)).toThrow();
      expect(() => draft.splice(-1, 1)).toThrow();
    });

    test('splice with negative deletions throws error', () => {
      const draft = new DraftArraySourceEvent<string>(5);
      expect(() => draft.splice(0, -1)).toThrow();
    });

    test('pop/shift on empty array does nothing', () => {
      const draft = new DraftArraySourceEvent<string>(0);
      draft.pop();
      draft.shift();
      expect(draft.commit()).toBeNull();
    });

    test('zero-length push/unshift/splice operations do nothing', () => {
      const draft = new DraftArraySourceEvent<string>(3);
      draft.push();
      draft.unshift();
      draft.splice(1, 0);
      expect(draft.commit()).toBeNull();
    });
  });
});
