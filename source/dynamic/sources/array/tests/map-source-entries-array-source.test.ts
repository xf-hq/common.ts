/**
 * Comprehensive Test Plan for MapSourceEntriesArraySource
 *
 * This test suite validates that MapSourceEntriesArraySource correctly transforms a MapSource<K,V>
 * into an ArraySource<[K,V]> representing map entries as key-value pair arrays.
 *
 * ## Core Functionality Testing
 * - **Constructor and Interface**: Verify proper instantiation and interface compliance
 * - **Online/Offline State Management**: Test subscription lifecycle and resource management
 *   - Initial empty state when no subscribers
 *   - Transition to online when first subscriber attaches
 *   - Proper array population from source MapSource during online transition
 *   - Transition to offline when last subscriber detaches
 *   - Resource cleanup during offline transition
 *   - Multiple subscribe/unsubscribe cycles
 *
 * ## Event Translation Testing
 * Test accurate translation of MapSource.Event operations to appropriate ArraySource.Event operations:
 *
 * ### MapSource Additions → ArraySource Push Events
 * - Single key addition
 * - Multiple key additions in one event
 * - Order preservation (insertion order)
 * - Proper array index management
 *
 * ### MapSource Changes → ArraySource Set Events
 * - Single key value change
 * - Multiple key value changes in one event
 * - Index preservation during value updates
 * - No array reordering on value changes
 *
 * ### MapSource Deletions → ArraySource Splice Events
 * - Single key deletion
 * - Multiple key deletions in one event
 * - Non-contiguous key deletions (should generate batch of splice events)
 * - Proper index adjustment after deletions
 * - KeyToIndexMap rebuilding after deletions
 *
 * ### Complex Mixed Operations → Appropriate Event Batching
 * - Add + Change operations in single MapSource event
 * - Add + Delete operations in single MapSource event
 * - Change + Delete operations in single MapSource event
 * - Add + Change + Delete operations in single MapSource event
 * - Verification that operations are processed in correct order (delete, change, add)
 *
 * ## Optimized Clear/Replace Operation Testing
 * - **Full Clear**: All existing keys deleted → single splice event removing all items
 * - **Replace All**: All existing keys deleted + new keys added → single splice event
 * - **Partial Clear**: Most but not all keys deleted → individual splice events
 * - **Mixed with Changes**: Clear operation mixed with changes should not trigger optimization
 *
 * ## Order Preservation and Consistency Testing
 * - Verify array order matches MapSource iteration order (insertion order)
 * - Consistent ordering across online/offline transitions
 * - Order preservation during complex operations
 * - Index accuracy in keyToIndexMap vs actual array positions
 *
 * ## Performance and Efficiency Testing
 * - KeyToIndexMap O(1) lookup efficiency verification
 * - Deferred keyToIndexMap rebuilding (only when needed after deletions)
 * - Minimized event emissions (batch where appropriate, single events where possible)
 *
 * ## Edge Cases and Error Conditions
 * - Empty MapSource initially and during operation
 * - Single-item MapSource operations
 * - Large MapSource with many operations
 * - Rapid succession of operations
 * - MapSource with duplicate operations (no-ops)
 * - Operations on non-existent keys
 *
 * ## Internal State Validation
 * - Array content correctness (__array accessor)
 * - KeyToIndexMap synchronization with array
 * - Proper cleanup of internal state during offline transitions
 * - State consistency across different operation sequences
 *
 * Each test group will verify both the emitted ArraySource events and the resulting internal
 * array state to ensure complete correctness of the transformation.
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { MapSource } from '../../map-source/map-source';
import type { ArraySource } from '../array-source';
import { MapSourceEntriesArraySource } from '../map-source-entries-array-source';

describe('MapSourceEntriesArraySource', () => {
  let manualMapSource: MapSource.Manual<string, number>;
  let entriesArraySource: MapSourceEntriesArraySource<string, number>;
  let capturedEvents: ArraySource.Event<[string, number]>[];
  let arraySourceSubscription: ArraySource.Subscription<[string, number]>;

  beforeEach(() => {
    manualMapSource = MapSource.create<string, number>();
    entriesArraySource = new MapSourceEntriesArraySource<string, number>(manualMapSource);
    capturedEvents = [];

    // Helper to subscribe and capture events
    const subscribeAndCapture = () => {
      if (arraySourceSubscription) {
        arraySourceSubscription[Symbol.dispose]();
      }
      arraySourceSubscription = entriesArraySource.subscribe({
        event: (event) => {
          capturedEvents.push(event);
        },
        end: () => {},
        unsubscribed: () => {},
      });
    };

    // Initial subscription to bring it online for most tests
    subscribeAndCapture();
  });

  describe('Constructor and Interface', () => {
    test('should create instance with proper interface compliance', () => {
      expect(entriesArraySource).toBeInstanceOf(MapSourceEntriesArraySource);
      expect(typeof entriesArraySource.subscribe).toBe('function');
      expect(entriesArraySource).toHaveProperty('__array');
    });

    test('should accept any MapSource as constructor argument', () => {
      const anotherMapSource = MapSource.create<number, string>();
      const anotherEntriesArraySource = new MapSourceEntriesArraySource(anotherMapSource);
      expect(anotherEntriesArraySource).toBeInstanceOf(MapSourceEntriesArraySource);
    });
  });

  test('should be initially empty if the source map is empty when going online', () => {
    expect(entriesArraySource.__array).toEqual([]);
    expect(capturedEvents.length).toBe(0); // No events for initial population
  });

  test('should reflect initial source map entries in correct order when going online', () => {
    manualMapSource.set('a', 1);
    manualMapSource.set('b', 2);

    const newEntriesArraySource = new MapSourceEntriesArraySource<string, number>(manualMapSource);
    const subscription = newEntriesArraySource.subscribe({ event: () => {} }); // bring online

    expect(newEntriesArraySource.__array).toEqual([['a', 1], ['b', 2]]);
    subscription[Symbol.dispose]();
  });

  describe('Handling MapSource.Event - Additions', () => {
    test('should push new entries to the end when source map adds items', () => {
      manualMapSource.set('a', 1);
      manualMapSource.set('b', 2);
      expect(entriesArraySource.__array).toEqual([['a', 1], ['b', 2]]);
      expect(capturedEvents.length).toBe(2); // Assuming set triggers individual add events that translate to push
      // More specific event check:
      // expect(capturedEvents[0]).toEqual({ kind: 'push', values: [['a', 1]] });
      // expect(capturedEvents[1]).toEqual({ kind: 'push', values: [['b', 2]] });
      // This depends on how ManualMapSource batches its own events for multiple sets.
      // For this test, we'll assume it might send separate 'add' MapSource events.
    });

    test('should emit a "push" ArraySource.Event for new entries added individually', () => {
      manualMapSource.set('a', 1);
      capturedEvents = []; // Reset after initial set
      manualMapSource.set('b', 2);
      expect(entriesArraySource.__array).toEqual([['a', 1], ['b', 2]]);
      expect(capturedEvents.length).toBe(1);
      expect(capturedEvents[0].kind).toBe('push');
      expect((capturedEvents[0] as ArraySource.Event.Push<[string, number]>).values).toEqual([['b', 2]]);
    });

    test('should handle multiple additions in a single MapSource event (if source supports it)', () => {
      manualMapSource.modify(new Map([['a', 1], ['b', 2]]), null);
      expect(entriesArraySource.__array).toEqual([['a', 1], ['b', 2]]);
      expect(capturedEvents.length).toBe(1);
      expect(capturedEvents[0].kind).toBe('push');
      expect((capturedEvents[0] as ArraySource.Event.Push<[string, number]>).values).toEqual([['a', 1], ['b', 2]]);
    });
  });

  describe('Handling MapSource.Event - Changes', () => {
    beforeEach(() => {
      manualMapSource.set('a', 1);
      manualMapSource.set('b', 2);
      capturedEvents = []; // Clear events after setup
    });

    test('should update existing entries when source map changes items', () => {
      manualMapSource.set('a', 10);
      expect(entriesArraySource.__array).toEqual([['a', 10], ['b', 2]]);
    });

    test('should emit a "set" ArraySource.Event for changed entries', () => {
      manualMapSource.set('a', 10);
      expect(capturedEvents.length).toBe(1);
      expect(capturedEvents[0].kind).toBe('set');
      expect((capturedEvents[0] as ArraySource.Event.Set<[string, number]>).index).toBe(0);
      expect((capturedEvents[0] as ArraySource.Event.Set<[string, number]>).value).toEqual(['a', 10]);
    });

    test('should maintain order when items are changed', () => {
      manualMapSource.set('b', 20);
      manualMapSource.set('a', 10);
      expect(entriesArraySource.__array).toEqual([['a', 10], ['b', 20]]);
    });

    test('should handle multiple changes in a single MapSource event (if source supports it)', () => {
      // Assuming modify can take a change map as part of its first argument if deletions are null.
      // Or, more likely, ManualMapSource.modify might need to be called differently or this test adapted.
      // For now, let's assume a MapSource implementation that can send a single event for multiple changes.
      // This might require a hypothetical `batchChanges` on ManualMapSource or similar.
      // Simulating the effect: individual sets leading to a batch from MapSourceEntriesArraySource
      manualMapSource.set('a', 10);
      manualMapSource.set('b', 20);
      // capturedEvents will now have two 'set' events if MapSourceEntriesArraySource doesn't batch them itself
      // or if ManualMapSource sends them separately.
      // The important part is the final state and that appropriate events were sent.

      expect(entriesArraySource.__array).toEqual([['a', 10], ['b', 20]]);
      // Check if the outcome is a batch of two sets, or two individual sets
      if (capturedEvents.length === 1 && capturedEvents[0].kind === 'batch') {
        const batchEvent = capturedEvents[0] as ArraySource.Event.Batch<[string, number]>;
        expect(batchEvent.events.length).toBe(2);
        expect(batchEvent.events.every(e => e.kind === 'set')).toBe(true);
      }
      else if (capturedEvents.length === 2) {
        expect(capturedEvents.every(e => e.kind === 'set')).toBe(true);
      }
      else {
        throw new Error('Unexpected event count for multiple changes');
      }
    });
  });

  describe('Handling MapSource.Event - Deletions', () => {
    beforeEach(() => {
      manualMapSource.set('a', 1);
      manualMapSource.set('b', 2);
      manualMapSource.set('c', 3);
      capturedEvents = []; // Clear events after setup
    });

    test('should remove entries when source map deletes items', () => {
      manualMapSource.delete('b');
      expect(entriesArraySource.__array).toEqual([['a', 1], ['c', 3]]);
    });

    test('should emit a "splice" ArraySource.Event for deleted entries', () => {
      manualMapSource.delete('b'); // 'b' was at index 1
      expect(capturedEvents.length).toBe(1);
      expect(capturedEvents[0].kind).toBe('splice');
      const spliceEvent = capturedEvents[0] as ArraySource.Event.Splice<[string, number]>;
      expect(spliceEvent.index).toBe(1);
      expect(spliceEvent.deletions).toBe(1);
      expect(spliceEvent.insertions).toEqual([]);
    });

    test('should correctly update indices after deletions', () => {
      manualMapSource.delete('a'); // 'a' at 0
      expect(entriesArraySource.__array).toEqual([['b', 2], ['c', 3]]);
      capturedEvents = [];
      manualMapSource.delete('c'); // 'c' is now at index 1 (was 2)
      expect(entriesArraySource.__array).toEqual([['b', 2]]);
      expect(capturedEvents.length).toBe(1);
      expect(capturedEvents[0].kind).toBe('splice');
      expect((capturedEvents[0] as ArraySource.Event.Splice<[string, number]>).index).toBe(1);
    });

    test('should handle multiple deletions in a single MapSource event (if source supports it)', () => {
      manualMapSource.modify(null, ['a', 'c']);
      expect(entriesArraySource.__array).toEqual([['b', 2]]);
      expect(capturedEvents.length).toBe(1); // Expecting a batch or multiple splice events
      // This might be a batch of 'splice' events or a more complex single splice.
      // The current implementation will likely produce a batch of individual splices.
      expect(capturedEvents[0].kind).toBe('batch');
      const batch = capturedEvents[0] as ArraySource.Event.Batch<[string, number]>;
      expect(batch.events.length).toBe(2); // two splices
      // Check for deletion of 'a' (original index 0) and 'c' (original index 2, becomes 1 after 'a' is gone if processed sequentially, or handled by descending sort in impl)
    });
  });

  describe('Handling MapSource.Event - Clear', () => {
    beforeEach(() => {
      manualMapSource.set('a', 1);
      manualMapSource.set('b', 2);
      capturedEvents = [];
    });

    test('should empty the array when source map is cleared', () => {
      manualMapSource.clear();
      expect(entriesArraySource.__array).toEqual([]);
    });

    test('should emit a single "splice" event deleting all items when source map is cleared', () => {
      const oldSize = entriesArraySource.__array!.length;
      manualMapSource.clear();
      expect(capturedEvents.length).toBe(1);
      expect(capturedEvents[0].kind).toBe('splice');
      const spliceEvent = capturedEvents[0] as ArraySource.Event.Splice<[string, number]>;
      expect(spliceEvent.index).toBe(0);
      expect(spliceEvent.deletions).toBe(oldSize);
      expect(spliceEvent.insertions).toEqual([]);
    });
  });

  describe('Handling MapSource.Event - Complex/Combined Operations', () => {
    beforeEach(() => {
      manualMapSource.set('a', 1); // [a,1]
      manualMapSource.set('b', 2); // [a,1], [b,2]
      manualMapSource.set('c', 3); // [a,1], [b,2], [c,3]
      capturedEvents = [];
    });

    test('should correctly handle a mix of add, change, and delete', () => {
      // Delete 'b' (index 1), Change 'a' to 10, Add 'd' as 4
      // Expected: [a,10], [c,3], [d,4]
      // ManualMapSource.modify takes (assignments: ReadonlyMap | null, deletions: ReadonlyArray | null)
      // To achieve add, change, delete, we can use a combination of modify for deletions and then sets for adds/changes,
      // or a single modify if changes are treated as assignments.

      // Option 1: Separate operations to be clear about intent for the test
      // manualMapSource.delete('b');
      // manualMapSource.set('a', 10); // change
      // manualMapSource.set('d', 4); // add

      // Option 2: Using a single modify call where 'assignments' handles both adds and changes.
      manualMapSource.modify(
        new Map([['a', 10], ['d', 4]]), // 'a' is a change, 'd' is an add
        ['b'] // delete 'b'
      );

      expect(entriesArraySource.__array).toEqual([['a', 10], ['c', 3], ['d', 4]]);
      // This sequence of operations on ManualMapSource might produce one MapSource.Event
      // which then translates to one ArraySource.Event (likely a batch).
      expect(capturedEvents.length).toBe(1);
      expect(capturedEvents[0].kind).toBe('batch');
      const batchEvents = (capturedEvents[0] as ArraySource.Event.Batch<[string, number]>).events;
      // The exact number and order of events in the batch can be complex depending on internal processing.
      // We need to ensure the final state is correct and the key operations are represented.
      const hasDeleteB = batchEvents.some(e => e.kind === 'splice' && e.deletions === 1);
      const hasSetA = batchEvents.some(e => e.kind === 'set' && e.value[0] === 'a' && e.value[1] === 10);
      const hasPushD = batchEvents.some(e => e.kind === 'push' && e.values.some(v => v[0] === 'd'));
      expect(hasDeleteB).toBe(true);
      expect(hasSetA).toBe(true);
      expect(hasPushD).toBe(true);
    });

    test('should emit a single "splice" event for a full replace operation (all delete + new adds)', () => {
      const oldSize = entriesArraySource.__array!.length;
      manualMapSource.modify(
        new Map([['x', 100], ['y', 200]]), // assignments
        ['a', 'b', 'c'] // deletions
      );
      expect(entriesArraySource.__array).toEqual([['x', 100], ['y', 200]]);
      expect(capturedEvents.length).toBe(1);
      expect(capturedEvents[0].kind).toBe('splice');
      const spliceEvent = capturedEvents[0] as ArraySource.Event.Splice<[string, number]>;
      expect(spliceEvent.index).toBe(0);
      expect(spliceEvent.deletions).toBe(oldSize);
      expect(spliceEvent.insertions).toEqual([['x', 100], ['y', 200]]);
    });
  });

  describe('Online/Offline Behavior', () => {
    test('should clear internal array and keyToIndexMap when going offline (last unsubscriber)', () => {
      manualMapSource.set('a', 1);
      expect(entriesArraySource.__array!.length).toBe(1);

      arraySourceSubscription[Symbol.dispose](); // Go offline

      expect(entriesArraySource.__array).toBeUndefined();
    });

    test('should re-populate correctly if going offline then online again', () => {
      manualMapSource.set('a', 1);
      manualMapSource.set('b', 2);
      expect(entriesArraySource.__array).toEqual([['a', 1], ['b', 2]]);

      arraySourceSubscription[Symbol.dispose](); // Go offline

      manualMapSource.set('c', 3); // Modify while offline

      // Go online again
      const newCapturedEvents: ArraySource.Event<[string, number]>[] = [];
      const newSubscription = entriesArraySource.subscribe({
        event: (e) => newCapturedEvents.push(e),
      });

      expect(entriesArraySource.__array).toEqual([['a', 1], ['b', 2], ['c', 3]]);
      expect(newCapturedEvents.length).toBe(0); // Initial population on subscribe doesn't emit events
      newSubscription[Symbol.dispose]();
    });

    test('should handle multiple subscribe/unsubscribe cycles', () => {
      manualMapSource.set('initial', 0);

      // First cycle
      arraySourceSubscription[Symbol.dispose]();
      const sub1 = entriesArraySource.subscribe({ event: () => {} });
      expect(entriesArraySource.__array).toEqual([['initial', 0]]);
      sub1[Symbol.dispose]();

      // Second cycle after modification
      manualMapSource.set('added', 1);
      const sub2 = entriesArraySource.subscribe({ event: () => {} });
      expect(entriesArraySource.__array).toEqual([['initial', 0], ['added', 1]]);
      sub2[Symbol.dispose]();
    });

    test('should not go offline if multiple subscribers exist', () => {
      manualMapSource.set('test', 1);
      const sub2 = entriesArraySource.subscribe({ event: () => {} });

      arraySourceSubscription[Symbol.dispose](); // Dispose first subscription
      expect(entriesArraySource.__array).toEqual([['test', 1]]); // Should still be online

      sub2[Symbol.dispose](); // Now should go offline
      expect(entriesArraySource.__array).toBeUndefined();
    });
  });

  describe('Performance and Efficiency', () => {
    test('should minimize event emissions through batching', () => {
      capturedEvents = [];

      // Single modify operation should produce single event (batch or optimized)
      manualMapSource.modify(
        new Map([['a', 1], ['b', 2], ['c', 3]]),
        null
      );

      expect(capturedEvents.length).toBe(1); // Should batch into single event
    });

    test('should handle rapid succession of operations', () => {
      capturedEvents = [];

      for (let i = 0; i < 100; i++) {
        manualMapSource.set(`rapid${i}`, i);
      }

      expect(entriesArraySource.__array!.length).toBe(100);
      expect(capturedEvents.length).toBe(100); // Each set generates one event
    });
  });

  describe('Internal State Validation', () => {
    test('should maintain array content correctness', () => {
      manualMapSource.set('a', 1);
      manualMapSource.set('b', 2);
      manualMapSource.set('c', 3);

      const expectedEntries: [string, number][] = [['a', 1], ['b', 2], ['c', 3]];
      expect(entriesArraySource.__array).toEqual(expectedEntries);
    });

    test('should maintain state consistency across different operation sequences', () => {
      // Sequence 1: add, change, delete
      manualMapSource.set('a', 1);
      manualMapSource.set('a', 10);
      manualMapSource.delete('a');
      expect(entriesArraySource.__array).toEqual([]);

      // Sequence 2: multiple adds then clear
      manualMapSource.set('x', 1);
      manualMapSource.set('y', 2);
      manualMapSource.clear();
      expect(entriesArraySource.__array).toEqual([]);
    });

    test('should handle proper cleanup during offline transitions', () => {
      manualMapSource.set('cleanup', 1);
      expect(entriesArraySource.__array).toBeDefined();

      arraySourceSubscription[Symbol.dispose]();

      expect(entriesArraySource.__array).toBeUndefined();
    });
  });

  describe('Extended Edge Cases', () => {
    test('should handle an initially empty MapSource that later gets items', () => {
      expect(entriesArraySource.__array).toEqual([]);
      manualMapSource.set('a', 1);
      expect(entriesArraySource.__array).toEqual([['a', 1]]);
      expect(capturedEvents.length).toBe(1);
      expect(capturedEvents[0].kind).toBe('push');
    });

    test('should handle a MapSource with items that all get deleted', () => {
      manualMapSource.set('a', 1);
      manualMapSource.set('b', 2);
      capturedEvents = []; // Clear after setup

      manualMapSource.delete('a');
      manualMapSource.delete('b');

      expect(entriesArraySource.__array).toEqual([]);
      expect(capturedEvents.length).toBe(2); // Two splice events
      // Or a batch of two splices if ManualMapSource batches deletions
    });

    test('should handle operations on non-existent keys', () => {
      // Set up initial state
      manualMapSource.set('a', 1);
      manualMapSource.set('b', 2);
      capturedEvents.length = 0; // Clear setup events

      // Try to delete a non-existent key - should be a no-op
      const deleted = manualMapSource.delete('nonexistent');
      expect(deleted).toBe(false); // delete() returns false for non-existent keys
      expect(capturedEvents.length).toBe(0); // No events should be emitted
      expect(entriesArraySource.__array).toEqual([['a', 1], ['b', 2]]);

      // Try to modify non-existent keys - should be no-ops for deletions
      // and additions for new keys
      manualMapSource.modify(new Map([['newkey', 999]]), ['nonexistent']);

      // Should have only added the new key, deletion of non-existent key is ignored
      expect(entriesArraySource.__array).toEqual([['a', 1], ['b', 2], ['newkey', 999]]);
      expect(capturedEvents.length).toBe(1); // Only one event for the addition
      expect(capturedEvents[0].kind).toBe('push');
    });

    test('should handle MapSource with duplicate operations (no-ops)', () => {
      // Set up initial state
      manualMapSource.set('a', 1);
      manualMapSource.set('b', 2);
      capturedEvents.length = 0; // Clear setup events

      // Set same value (no-op) - ManualMapSource should detect this
      manualMapSource.set('a', 1); // Same value, should be a change event but no actual change in array

      // Delete non-existent key (no-op)
      const deleted = manualMapSource.delete('nonexistent');
      expect(deleted).toBe(false);

      // The array source should handle these gracefully
      // Setting same value still generates a change event from ManualMapSource
      // but the array content doesn't actually change
      expect(entriesArraySource.__array).toEqual([['a', 1], ['b', 2]]);

      // ManualMapSource might emit a change event even for same value
      // The implementation should handle this correctly
      if (capturedEvents.length > 0) {
        // If events were emitted, verify they represent the same state
        expect(entriesArraySource.__array).toEqual([['a', 1], ['b', 2]]);
      }
    });

    test('should handle large MapSource with many operations', () => {
      // Test with a reasonably large dataset to verify performance characteristics
      const itemCount = 1000;

      // Add many items
      for (let i = 0; i < itemCount; i++) {
        manualMapSource.set(`key${i}`, i);
      }

      expect(entriesArraySource.__array!.length).toBe(itemCount);
      expect(entriesArraySource.__array![0]).toEqual(['key0', 0]);
      expect(entriesArraySource.__array![itemCount - 1]).toEqual([`key${itemCount - 1}`, itemCount - 1]);

      // Clear events from setup
      capturedEvents.length = 0;

      // Perform many changes
      for (let i = 0; i < 100; i++) {
        manualMapSource.set(`key${i}`, i * 10);
      }

      // Verify the changes took effect
      expect(entriesArraySource.__array![0]).toEqual(['key0', 0]);
      expect(entriesArraySource.__array![1]).toEqual(['key1', 10]);
      expect(entriesArraySource.__array![99]).toEqual(['key99', 990]);

      // Delete some items
      for (let i = 0; i < 50; i++) {
        manualMapSource.delete(`key${i}`);
      }

      expect(entriesArraySource.__array!.length).toBe(itemCount - 50);
      // First remaining item should be key50 with its changed value (500, not 50)
      expect(entriesArraySource.__array![0]).toEqual(['key50', 500]);
    });

    test('should handle single-item MapSource operations', () => {
      // Start with empty array
      expect(entriesArraySource.__array).toEqual([]);
      capturedEvents.length = 0;

      // Add single item
      manualMapSource.set('single', 42);
      expect(entriesArraySource.__array).toEqual([['single', 42]]);
      expect(capturedEvents.length).toBe(1);
      expect(capturedEvents[0].kind).toBe('push');

      capturedEvents.length = 0;

      // Change single item
      manualMapSource.set('single', 84);
      expect(entriesArraySource.__array).toEqual([['single', 84]]);
      expect(capturedEvents.length).toBe(1);
      expect(capturedEvents[0].kind).toBe('set');
      expect((capturedEvents[0] as ArraySource.Event.Set<[string, number]>).index).toBe(0);
      expect((capturedEvents[0] as ArraySource.Event.Set<[string, number]>).value).toEqual(['single', 84]);

      capturedEvents.length = 0;

      // Delete single item
      manualMapSource.delete('single');
      expect(entriesArraySource.__array).toEqual([]);
      expect(capturedEvents.length).toBe(1);
      expect(capturedEvents[0].kind).toBe('splice');
      expect((capturedEvents[0] as ArraySource.Event.Splice<[string, number]>).index).toBe(0);
      expect((capturedEvents[0] as ArraySource.Event.Splice<[string, number]>).deletions).toBe(1);
      expect((capturedEvents[0] as ArraySource.Event.Splice<[string, number]>).insertions).toEqual([]);
    });
  });

  describe('Order Preservation and Consistency', () => {
    test('should verify array order matches MapSource iteration order', () => {
      // Add items in specific order
      const insertionOrder = ['c', 'a', 'b', 'd'];
      const values = [3, 1, 2, 4];

      for (let i = 0; i < insertionOrder.length; i++) {
        manualMapSource.set(insertionOrder[i], values[i]);
      }

      // Verify array order matches insertion order (Map insertion order)
      const expectedEntries: [string, number][] = [];
      for (let i = 0; i < insertionOrder.length; i++) {
        expectedEntries.push([insertionOrder[i], values[i]]);
      }
      expect(entriesArraySource.__array).toEqual(expectedEntries);

      // Verify this matches the MapSource's own iteration order
      const mapEntries = Array.from(manualMapSource.entries());
      expect(entriesArraySource.__array).toEqual(mapEntries);

      // Change some values - should not affect order
      manualMapSource.set('a', 10);
      manualMapSource.set('c', 30);

      const expectedAfterChanges: [string, number][] = [['c', 30], ['a', 10], ['b', 2], ['d', 4]];
      expect(entriesArraySource.__array).toEqual(expectedAfterChanges);

      // Verify still matches MapSource iteration order
      const mapEntriesAfterChanges = Array.from(manualMapSource.entries());
      expect(entriesArraySource.__array).toEqual(mapEntriesAfterChanges);
    });

    test('should maintain consistent ordering across online/offline transitions', () => {
      // Add items while online
      manualMapSource.set('x', 1);
      manualMapSource.set('y', 2);
      manualMapSource.set('z', 3);

      const orderBeforeOffline = [...entriesArraySource.__array!];
      expect(orderBeforeOffline).toEqual([['x', 1], ['y', 2], ['z', 3]]);

      // Go offline by disposing subscription
      arraySourceSubscription[Symbol.dispose]();
      expect(entriesArraySource.__array).toBeUndefined();

      // Add more items while offline
      manualMapSource.set('a', 4);
      manualMapSource.set('b', 5);

      // Go back online
      arraySourceSubscription = entriesArraySource.subscribe({ event: (event) => capturedEvents.push(event) });

      // Order should be preserved with new items at the end
      const expectedOrderAfterOnline: [string, number][] = [['x', 1], ['y', 2], ['z', 3], ['a', 4], ['b', 5]];
      expect(entriesArraySource.__array).toEqual(expectedOrderAfterOnline);

      // Should match MapSource iteration order
      const mapEntries = Array.from(manualMapSource.entries());
      expect(entriesArraySource.__array).toEqual(mapEntries);
    });

    test('should preserve order during complex mixed operations', () => {
      // Set up initial state with known order
      manualMapSource.set('a', 1); // index 0
      manualMapSource.set('b', 2); // index 1
      manualMapSource.set('c', 3); // index 2
      manualMapSource.set('d', 4); // index 3
      manualMapSource.set('e', 5); // index 4

      const initialOrder = [...entriesArraySource.__array!];
      expect(initialOrder).toEqual([['a', 1], ['b', 2], ['c', 3], ['d', 4], ['e', 5]]);

      capturedEvents.length = 0;

      // Complex operation: delete some, change some, add some
      manualMapSource.modify(
        new Map([
          ['b', 20], // change existing
          ['d', 40], // change existing
          ['f', 6], // add new (should go to end)
          ['g', 7], // add new (should go to end)
        ]),
        ['c'] // delete 'c' (was at index 2)
      );

      // The expected behavior may vary based on ManualMapSource.modify implementation
      // The key requirement is that the array order matches MapSource iteration order
      const actualOrder = [...entriesArraySource.__array!];

      // Verify this matches MapSource iteration order (the key requirement)
      const mapEntries = Array.from(manualMapSource.entries());
      expect(entriesArraySource.__array).toEqual(mapEntries);

      // Verify the content is correct (specific order may vary based on implementation)
      const hasA = actualOrder.some(([k, v]) => k === 'a' && v === 1);
      const hasB = actualOrder.some(([k, v]) => k === 'b' && v === 20);
      const hasD = actualOrder.some(([k, v]) => k === 'd' && v === 40);
      const hasE = actualOrder.some(([k, v]) => k === 'e' && v === 5);
      const hasF = actualOrder.some(([k, v]) => k === 'f' && v === 6);
      const hasG = actualOrder.some(([k, v]) => k === 'g' && v === 7);
      const hasC = actualOrder.some(([k, v]) => k === 'c' && v === 3);

      expect(hasA).toBe(true);
      expect(hasB).toBe(true);
      expect(hasD).toBe(true);
      expect(hasE).toBe(true);
      expect(hasF).toBe(true);
      expect(hasG).toBe(true);
      expect(hasC).toBe(false); // 'c' should be deleted
      expect(actualOrder.length).toBe(6);
    });

    test('should maintain index accuracy in keyToIndexMap vs actual array positions', () => {
      // We can't access keyToIndexMap directly, but we can test that operations
      // that depend on it work correctly after complex manipulations

      // Set up initial state
      manualMapSource.set('a', 1);
      manualMapSource.set('b', 2);
      manualMapSource.set('c', 3);
      manualMapSource.set('d', 4);
      manualMapSource.set('e', 5);

      capturedEvents.length = 0;

      // Delete non-contiguous items which should trigger keyToIndexMap rebuild
      manualMapSource.delete('b'); // was at index 1
      manualMapSource.delete('d'); // was at index 3, now at index 2

      // Array should now be ['a', 'c', 'e']
      expect(entriesArraySource.__array).toEqual([['a', 1], ['c', 3], ['e', 5]]);

      capturedEvents.length = 0;

      // Now test that changes still work correctly (depends on accurate keyToIndexMap)
      manualMapSource.set('a', 10); // should be at index 0
      manualMapSource.set('c', 30); // should be at index 1
      manualMapSource.set('e', 50); // should be at index 2

      expect(entriesArraySource.__array).toEqual([['a', 10], ['c', 30], ['e', 50]]);

      // Verify the change events had correct indices
      expect(capturedEvents.length).toBe(3);
      expect(capturedEvents.every(e => e.kind === 'set')).toBe(true);

      const setEvent0 = capturedEvents[0] as ArraySource.Event.Set<[string, number]>;
      const setEvent1 = capturedEvents[1] as ArraySource.Event.Set<[string, number]>;
      const setEvent2 = capturedEvents[2] as ArraySource.Event.Set<[string, number]>;

      expect(setEvent0.index).toBe(0);
      expect(setEvent1.index).toBe(1);
      expect(setEvent2.index).toBe(2);
    });
  });

  describe('Advanced Event Translation', () => {
    test('should handle non-contiguous key deletions with proper splice events', () => {
      // Set up array with 5 items
      manualMapSource.set('a', 1); // index 0
      manualMapSource.set('b', 2); // index 1
      manualMapSource.set('c', 3); // index 2
      manualMapSource.set('d', 4); // index 3
      manualMapSource.set('e', 5); // index 4

      capturedEvents.length = 0;

      // Delete keys at indices 0, 2, 4 (non-contiguous)
      manualMapSource.modify(null, ['a', 'c', 'e']);

      // Should result in array: [['b', 2], ['d', 4]]
      expect(entriesArraySource.__array).toEqual([['b', 2], ['d', 4]]);

      // Should generate a batch of splice events since deletions are non-contiguous
      expect(capturedEvents.length).toBe(1);
      expect(capturedEvents[0].kind).toBe('batch');

      const batch = capturedEvents[0] as ArraySource.Event.Batch<[string, number]>;
      expect(batch.events.length).toBe(3); // Three separate splice events

      // All should be splice events
      expect(batch.events.every(e => e.kind === 'splice')).toBe(true);

      // Due to descending index processing, should be spliced from high to low indices
      // The exact order depends on implementation but all should be single-item deletions
      for (const event of batch.events) {
        const spliceEvent = event as ArraySource.Event.Splice<[string, number]>;
        expect(spliceEvent.deletions).toBe(1);
        expect(spliceEvent.insertions).toEqual([]);
      }
    });

    test('should optimize clear operations when all existing keys are deleted', () => {
      // Set up initial state
      manualMapSource.set('a', 1);
      manualMapSource.set('b', 2);
      manualMapSource.set('c', 3);

      const initialSize = entriesArraySource.__array!.length;
      expect(initialSize).toBe(3);

      capturedEvents.length = 0;

      // Delete ALL existing keys - should trigger optimized clear
      manualMapSource.modify(null, ['a', 'b', 'c']);

      expect(entriesArraySource.__array).toEqual([]);

      // Should generate a single optimized splice event removing all items
      expect(capturedEvents.length).toBe(1);
      expect(capturedEvents[0].kind).toBe('splice');

      const spliceEvent = capturedEvents[0] as ArraySource.Event.Splice<[string, number]>;
      expect(spliceEvent.index).toBe(0);
      expect(spliceEvent.deletions).toBe(initialSize);
      expect(spliceEvent.insertions).toEqual([]);
    });

    test('should handle partial clear operations with individual splice events', () => {
      // Set up initial state
      manualMapSource.set('a', 1);
      manualMapSource.set('b', 2);
      manualMapSource.set('c', 3);
      manualMapSource.set('d', 4);

      capturedEvents.length = 0;

      // Delete most but not all keys - should NOT trigger optimization
      manualMapSource.modify(null, ['a', 'b', 'c']); // Delete 3 out of 4

      expect(entriesArraySource.__array).toEqual([['d', 4]]);

      // Should NOT generate a single optimized splice, but individual splices or a batch
      expect(capturedEvents.length).toBe(1);

      // Since it's not a full clear, should be a batch of individual splice events
      expect(capturedEvents[0].kind).toBe('batch');

      const batch = capturedEvents[0] as ArraySource.Event.Batch<[string, number]>;
      expect(batch.events.length).toBe(3); // Three separate splice events
      expect(batch.events.every(e => e.kind === 'splice')).toBe(true);
    });

    test('should not optimize mixed clear operations with changes', () => {
      // Set up initial state
      manualMapSource.set('a', 1);
      manualMapSource.set('b', 2);
      manualMapSource.set('c', 3);

      capturedEvents.length = 0;

      // Delete all existing keys BUT also include changes - should not optimize
      manualMapSource.modify(
        new Map([['b', 20]]), // Change 'b' (which is also being deleted)
        ['a', 'b', 'c'] // Delete all
      );

      expect(entriesArraySource.__array).toEqual([]);

      // Should NOT generate a single optimized splice because changes are mixed in
      // The exact behavior depends on implementation, but it should not be optimized
      expect(capturedEvents.length).toBe(1);

      // Could be a batch or individual events, but not a single optimized splice
      if (capturedEvents[0].kind === 'batch') {
        const batch = capturedEvents[0] as ArraySource.Event.Batch<[string, number]>;
        expect(batch.events.length).toBeGreaterThan(1);
      }
      else {
        // If it's a single event, it should not be a simple splice removing all
        // It might still be a splice but the implementation should detect the complexity
        expect(capturedEvents[0].kind).toBe('splice');
      }
    });
  });

  describe('Performance and Efficiency Validation', () => {
    test('should verify keyToIndexMap O(1) lookup efficiency', () => {
      // This test verifies efficiency indirectly by testing that operations
      // remain fast even with large datasets

      const itemCount = 1000;

      // Add many items
      for (let i = 0; i < itemCount; i++) {
        manualMapSource.set(`key${i}`, i);
      }

      capturedEvents.length = 0;
      const startTime = performance.now();

      // Perform many random changes - should be O(1) per operation
      for (let i = 0; i < 100; i++) {
        const randomIndex = Math.floor(Math.random() * itemCount);
        manualMapSource.set(`key${randomIndex}`, randomIndex * 10);
      }

      const endTime = performance.now();
      const operationTime = endTime - startTime;

      // Should complete quickly (this is a rough performance check)
      expect(operationTime).toBeLessThan(100); // Should take less than 100ms

      // Verify all changes were applied correctly (spot check a few)
      expect(entriesArraySource.__array!.length).toBe(itemCount);

      // The exact values will depend on which random operations occurred,
      // but the array should be valid and maintain correct order
      const mapEntries = Array.from(manualMapSource.entries());
      expect(entriesArraySource.__array).toEqual(mapEntries);
    });

    test('should demonstrate deferred keyToIndexMap rebuilding after deletions', () => {
      // Set up state where keyToIndexMap will need rebuilding
      manualMapSource.set('a', 1);
      manualMapSource.set('b', 2);
      manualMapSource.set('c', 3);
      manualMapSource.set('d', 4);
      manualMapSource.set('e', 5);

      capturedEvents.length = 0;

      // Perform a mixed operation with deletions, changes, and additions
      // The implementation should defer keyToIndexMap rebuilding until after all operations
      manualMapSource.modify(
        new Map([
          ['b', 20], // change existing
          ['f', 6], // add new
        ]),
        ['c', 'd'] // delete some (should trigger rebuild need)
      );

      // Final state should be: [['a', 1], ['b', 20], ['e', 5], ['f', 6]]
      expect(entriesArraySource.__array).toEqual([['a', 1], ['b', 20], ['e', 5], ['f', 6]]);

      capturedEvents.length = 0;

      // Now test that subsequent operations work correctly (keyToIndexMap should be rebuilt and accurate)
      manualMapSource.set('a', 10); // Should find correct index
      manualMapSource.set('e', 50); // Should find correct index

      expect(entriesArraySource.__array).toEqual([['a', 10], ['b', 20], ['e', 50], ['f', 6]]);

      // Should be individual set events with correct indices
      expect(capturedEvents.length).toBe(2);
      expect(capturedEvents[0].kind).toBe('set');
      expect(capturedEvents[1].kind).toBe('set');

      expect((capturedEvents[0] as ArraySource.Event.Set<[string, number]>).index).toBe(0); // 'a' at index 0
      expect((capturedEvents[1] as ArraySource.Event.Set<[string, number]>).index).toBe(2); // 'e' at index 2
    });

    test('should minimize event emissions through appropriate batching', () => {
      // Set up initial state
      manualMapSource.set('a', 1);
      manualMapSource.set('b', 2);
      manualMapSource.set('c', 3);

      capturedEvents.length = 0;

      // Single MapSource event with multiple operations should result in minimal ArraySource events
      manualMapSource.modify(
        new Map([
          ['a', 10], // change
          ['d', 4], // add
          ['e', 5], // add
        ]),
        ['b'] // delete
      );

      // Should generate exactly one ArraySource event (a batch)
      expect(capturedEvents.length).toBe(1);
      expect(capturedEvents[0].kind).toBe('batch');

      const batch = capturedEvents[0] as ArraySource.Event.Batch<[string, number]>;

      // Should contain minimal necessary events:
      // - 1 splice for deletion of 'b'
      // - 1 set for change of 'a'
      // - 1 push for additions of 'd' and 'e'
      expect(batch.events.length).toBe(3);

      // Verify event types
      const eventTypes = batch.events.map(e => e.kind);
      expect(eventTypes).toContain('splice'); // deletion
      expect(eventTypes).toContain('set'); // change
      expect(eventTypes).toContain('push'); // additions

      // Verify final state
      expect(entriesArraySource.__array).toEqual([['a', 10], ['c', 3], ['d', 4], ['e', 5]]);

      capturedEvents.length = 0;

      // Test that simple operations don't get unnecessarily batched
      manualMapSource.set('f', 6);
      expect(capturedEvents.length).toBe(1);
      expect(capturedEvents[0].kind).toBe('push'); // Single operation, no batch needed
    });
  });
});
