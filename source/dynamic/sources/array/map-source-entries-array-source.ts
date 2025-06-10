import { dispose } from '../../../general/disposables';
import { bindMethod } from '../../../general/functional';
import { Subscribable } from '../../core/subscribable';
import type { MapSource } from '../map-source/map-source';
import { ArraySource } from './array-source';
import { ArraySourceSubscription, ArraySourceTag } from './common';

/**
 * `MapSourceEntriesArraySource` transforms a `MapSource<K, V>` into an `ArraySource<[K, V]>`,
 * representing the map's entries as an array of key-value pairs.
 *
 * Key Characteristics and Behaviors:
 * - **Order Preservation**: The order of entries in the output array mirrors the insertion order
 *   of keys in the source `MapSource`. This is consistent with `Map.prototype.entries()`.
 * - **Dynamic Updates**: The array dynamically reflects changes (additions, updates, deletions)
 *   from the source `MapSource`.
 * - **Event Translation**: `MapSource.Event` objects are translated into the most appropriate
 *   and minimal `ArraySource.Event` objects.
 *   - Additions to the map typically result in `ArraySource.Event.Push`.
 *   - Updates to existing map values typically result in `ArraySource.Event.Set`.
 *   - Deletions from the map typically result in `ArraySource.Event.Splice`.
 *   - Multiple distinct operations resulting from a single `MapSource.Event` are batched into
 *     a single `ArraySource.Event.Batch` if they cannot be simplified into a more specific single event.
 *     For example, deleting two non-contiguous items will result in a batch of two splice events.
 * - **Optimized Clear/Replace**: If the `MapSource.Event` indicates that all existing items are deleted
 *   and (optionally) new items are added, this class will attempt to emit a single, efficient
 *   `ArraySource.Event.Splice` to represent the entire clear or replace operation, rather than
 *   multiple individual events.
 * - **Online/Offline State**: The source becomes `online` when the first subscriber attaches and `offline`
 *   when the last subscriber detaches.
 *   - While `online`, it maintains an internal array (`#array`) and a map (`#keyToIndexMap`)
 *     to efficiently track key positions and process incoming events.
 *   - `#keyToIndexMap` provides a fast lookup (average O(1)) for the index of any given key in the `#array`.
 *   - When transitioning from `offline` to `online`, the internal array is repopulated from the
 *     current state of the source `MapSource`.
 *   - Internal state is cleared when going `offline` to release resources.
 * - **Event Processing Logic (when online)**:
 *   1. **Safety Check**: Ensures internal state (`#array`, `#keyToIndexMap`) is valid.
 *   2. **Optimized Clear/Replace**: Checks if the event represents a full clear or replace. If so,
 *      it processes this efficiently and emits a single `splice` event.
 *   3. **Incremental Update (if not a clear/replace)**:
 *      a. **Deletions**: Processed first. Indices are found using `#keyToIndexMap`, sorted in
 *         descending order, and items are spliced from `#array`. `ArraySource.Event.Splice` events
 *         are generated. If deletions occur, `#keyToIndexMap` is marked for a full rebuild *after
 *         all operations (deletions, changes, additions) for the current `MapSource.Event` are processed*.
 *      b. **Changes**: Processed next. Indices are found using the (potentially stale if deletions occurred)
 *         `#keyToIndexMap`, and values in `#array` are updated. `ArraySource.Event.Set` events are generated.
 *      c. **Additions**: Processed last. New entries are appended to `#array` (maintaining insertion
 *         order). `#keyToIndexMap` is updated for these new entries. (A full rebuild of `#keyToIndexMap`
 *         might still occur after this step if deletions also happened in the same event).
 *         `ArraySource.Event.Push` events are generated.
 *   4. **Event Emission**: If multiple `ArraySource.Event`s are generated during incremental updates,
 *      they are wrapped in a single `ArraySource.Event.Batch`.
 *
 * Future maintainers should be mindful of these points to ensure the class continues to behave
 * as expected, particularly regarding order preservation, efficient event translation, and
 * correct state management during online/offline transitions.
 */
export class MapSourceEntriesArraySource<K, V> implements ArraySource<[K, V]>, Subscribable.Receiver<[event: MapSource.Event<K, V>]> {
  constructor (source: MapSource<K, V>) {
    this.#source = source;
  }
  readonly #source: MapSource<K, V>;
  readonly #emitter = new Subscribable.Controller<[event: ArraySource.Event<[K, V]>]>(bindMethod(this.onDemandChange, this));
  #upstreamSubscription: MapSource.Subscription<K, V> | undefined;
  #array: [K, V][] | undefined;

  // A map to quickly find the index of a key in this.#array.
  // This is maintained only when online.
  #keyToIndexMap: Map<K, number> | undefined;

  get [ArraySourceTag] () { return true as const; }

  /** @internal */
  get __array () { return this.#array; }

  subscribe<A extends any[]> (subscriber: Subscribable.Subscriber<[event: ArraySource.Event<[K, V]>], A>, ...args: A): ArraySource.Subscription<[K, V]> {
    const subscription = this.#emitter.subscribe(subscriber, ...args);
    return new ArraySourceSubscription(this, subscription);
  }

  onDemandChange (event: Subscribable.DemandObserver.Event): void {
    switch (event) {
      case 'online': this.online(); break;
      case 'offline': this.offline(); break;
    }
  }

  online () {
    this.#upstreamSubscription = this.#source.subscribe(this);
    this.#array = Array.from(this.#upstreamSubscription.__map.entries());
    this.#keyToIndexMap = new Map();
    for (let i = 0; i < this.#array.length; i++) {
      this.#keyToIndexMap.set(this.#array[i][0], i);
    }
  }

  offline () {
    dispose(this.#upstreamSubscription!);
    this.#upstreamSubscription = undefined;
    this.#array = undefined;
    this.#keyToIndexMap = undefined;
  }

  /**
   * Rebuilds the #keyToIndexMap from #array.
   * Call this after any operation that changes indices or order of items in #array.
   */
  #rebuildKeyToIndexMap (): void {
    if (!this.#array || !this.#keyToIndexMap) return;
    this.#keyToIndexMap.clear();
    for (let i = 0; i < this.#array.length; i++) {
      this.#keyToIndexMap.set(this.#array[i][0], i);
    }
  }

  event (event: MapSource.Event<K, V>): void {
    if (!this.#array || !this.#keyToIndexMap) {
      // Should not happen if online, but good for safety.
      return;
    }

    const { add: addMap, change: changeMap, delete: deleteKeys } = event;

    if (!addMap && !changeMap && !deleteKeys) {
      return; // No operations in this event.
    }

    const initialArraySize = this.#array.length;
    const outgoingEvents: ArraySource.Event<[K, V]>[] = [];

    // Optimized Clear/Replace Path
    if (deleteKeys && deleteKeys.length === initialArraySize && initialArraySize > 0) {
      const allCurrentKeysInArray = new Set<K>();
      for (let i = 0; i < this.#array.length; i++) {
        allCurrentKeysInArray.add(this.#array[i][0]);
      }

      let allDeletedKeysMatchCurrentArray = true;
      if (deleteKeys.length !== allCurrentKeysInArray.size) {
        allDeletedKeysMatchCurrentArray = false;
      }
      else {
        for (let i = 0; i < deleteKeys.length; i++) {
          if (!allCurrentKeysInArray.has(deleteKeys[i])) {
            allDeletedKeysMatchCurrentArray = false;
            break;
          }
        }
      }

      if (allDeletedKeysMatchCurrentArray) {
        let safeToClear = true;
        if (changeMap) {
          for (const keyInChange of changeMap.keys()) {
            // If a key slated for deletion is also in changeMap, it's not a simple clear.
            if (allCurrentKeysInArray.has(keyInChange)) {
              safeToClear = false;
              break;
            }
          }
        }

        if (safeToClear) {
          const newItems: [K, V][] = [];
          if (addMap) {
            for (const entry of addMap.entries()) {
              newItems.push(entry);
            }
          }
          this.#array.length = 0;
          for (let i = 0; i < newItems.length; i++) {
            this.#array.push(newItems[i]);
          }
          this.#rebuildKeyToIndexMap();
          this.#emitter.event({ kind: 'splice', index: 0, deletions: initialArraySize, insertions: newItems });
          return;
        }
      }
    }

    // Incremental Update Path
    let rebuildMapNeeded = false;

    // 1. Process Deletions
    if (deleteKeys && deleteKeys.length > 0) {
      const indicesToDelete: number[] = [];
      for (let i = 0; i < deleteKeys.length; i++) {
        const keyToDelete = deleteKeys[i];
        const index = this.#keyToIndexMap.get(keyToDelete);
        if (index !== undefined) {
          indicesToDelete.push(index);
        }
      }
      // Sort indices in descending order to splice correctly
      indicesToDelete.sort((a, b) => b - a);

      for (let i = 0; i < indicesToDelete.length; i++) {
        const index = indicesToDelete[i];
        this.#array.splice(index, 1);
        outgoingEvents.push({ kind: 'splice', index, deletions: 1, insertions: [] });
      }
      if (indicesToDelete.length > 0) {
        rebuildMapNeeded = true;
      }
    }

    // 2. Process Changes
    if (changeMap && changeMap.size > 0) {
      for (const [keyToChange, newValue] of changeMap.entries()) {
        const index = this.#keyToIndexMap.get(keyToChange);
        if (index !== undefined) {
          this.#array[index] = [keyToChange, newValue]; // Value in #keyToIndexMap remains the same (key)
          outgoingEvents.push({ kind: 'set', index, value: [keyToChange, newValue] });
        }
        // If key is not in map, it might have been deleted by a previous op or is an error from upstream.
        // Per MapSource.Event, 'change' implies existence.
      }
    }

    // 3. Process Additions
    // New items in a Map are added to the end of its iteration order.
    if (addMap && addMap.size > 0) {
      const newEntries: [K, V][] = [];
      for (const entry of addMap.entries()) {
        // Assuming addMap contains only keys not currently in the map
        // (or MapSource guarantees `add` is for truly new items post-delete/change).
        newEntries.push(entry);
      }

      if (newEntries.length > 0) {
        const originalLength = this.#array.length;
        for (let i = 0; i < newEntries.length; i++) {
          const entry = newEntries[i];
          this.#array.push(entry);
          this.#keyToIndexMap.set(entry[0], originalLength + i);
        }
        outgoingEvents.push({ kind: 'push', values: newEntries });
        // No full rebuild needed here as we are only appending and updating map for new items.
      }
    }

    // Emit collected events
    if (outgoingEvents.length === 1) {
      this.#emitter.event(outgoingEvents[0]);
    }
    else {
      if (outgoingEvents.length > 1) {
        this.#emitter.event({ kind: 'batch', events: outgoingEvents });
      }
    }

    if (rebuildMapNeeded) {
      this.#rebuildKeyToIndexMap(); // Rebuild after all deletions, before changes and adds.
    }
  }
}
