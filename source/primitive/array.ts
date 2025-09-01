import { isNumber } from '../general/type-checking';

export const emptyArray = <T = unknown>(): T[] => [];

export const firstElement = <T>(a: readonly T[]): T | undefined => a.length > 0 ? a[0] : undefined;
export const secondElement = <T>(a: readonly T[]): T | undefined => a.length > 1 ? a[1] : undefined;
export const thirdElement = <T>(a: readonly T[]): T | undefined => a.length > 2 ? a[2] : undefined;
export const lastElement = <T>(array: readonly T[]): T | undefined => array.length === 0 ? undefined : array[array.length - 1];
export const secondLastElement = <T>(array: readonly T[]): T | undefined => array.length < 2 ? undefined : array[array.length - 2];
export const thirdLastElement = <T>(array: readonly T[]): T | undefined => array.length < 3 ? undefined : array[array.length - 3];
export const nthLastElement = <T>(i: number, array: readonly T[]): T | undefined => array.length < (i + 1) ? undefined : array[array.length - 1 - i];
/** @param i Negative indices count backwards from the end of the array */
export const elementAt = <T>(i: number, array: readonly T[]) => {
  if (i < 0) {
    i = array.length + i;
    if (i < 0) return undefined;
  }
  return array[i];
};
export const randomElement = <T>(array: readonly T[]): T => {
  if (array.length === 0) throw new Error('Cannot select a random element from an empty array');
  return array[(Math.random() * array.length) << 0];
};

export const arrayTake = <T>(n: number, array: readonly T[]) => array.slice(0, n);
export const arrayTakeLast = <T>(n: number, array: readonly T[]) => array.slice(array.length - n);
export const arraySkip = <T>(n: number, array: readonly T[]) => array.slice(n);
export const arraySkipLast = <T>(n: number, array: readonly T[]) => array.slice(0, array.length - n);

export const arrayLength = (a: readonly any[]) => a.length;

export const arrayOf = <T>(a: T): T[] => [a];

export const arraySet = <T>(index: number, value: T, array: T[]) => {
  if (index < 0) index = array.length + index;
  array = [...array];
  array[index] = value;
  return array;
};

export const arraySetIfChanged = (index, value, array) => array[index] === value ? array : arraySet(index, value, array);

export const arrayMap = (f: AnyFunction, array_in: unknown[]) => {
  const array_out: any[] = [];
  for (let i = 0; i < array_in.length; ++i) {
    array_out.push(f(array_in[i], i, array_in));
  }
  return array_out;
};

export const arrayMapKeysToObject = (f, keys) => Object.fromEntries(keys.map(key => [key, f(key)]));

export const arrayCreate = <T>(length: number, elementValue: T): T[] => {
  const array: T[] = [];
  for (let i = 0; i < length; ++i) {
    array.push(elementValue);
  }
  return array;
};

export function arrayCreateEach<T> (length: number, createElement: (elementIndex: number, arrayLength: number, array: T[]) => T): T[];
export function arrayCreateEach<T> (length: number, start: number, createElement: (elementIndex: number, arrayLength: number, array: T[]) => T): T[];
export function arrayCreateEach<T> (length: number, arg1: number | ((elementIndex: number, arrayLength: number, array: T[]) => T), arg2?: (elementIndex: number, arrayLength: number, array: T[]) => T): T[] {
  let start: number, createElement: (elementIndex: number, arrayLength: number, array: T[]) => T;
  if (isNumber(arg1)) {
    start = arg1;
    createElement = arg2!;
  }
  else {
    start = 0;
    createElement = arg1;
  }
  const array: T[] = [];
  for (let i = start; i < start + length; ++i) {
    array.push(createElement(i, length, array));
  }
  return array;
}

export const arrayCreateRange = (count: number, start = 0): number[] => {
  const array: number[] = [];
  for (let i = start; i < start + count; ++i) {
    array.push(i);
  }
  return array;
};

export function arrayRemoveDistinctUnordered (value, array) {
  const lastIndex = array.length - 1;
  for (let i = 0; i <= lastIndex; ++i) {
    if (array[i] === value) {
      if (i < lastIndex) array[i] = array[lastIndex];
      array.length = lastIndex;
      return true;
    }
  }
  return false;
}

export function arrayRemoveOne<T> (value: T, array: T[]) {
  const index = array.indexOf(value);
  if (index !== -1) {
    array.splice(index, 1);
    return true;
  }
  return false;
}

export function arrayRemoveDistinctOrdered (value, array) {
  const lastIndex = array.length - 1;
  for (let i = 0; i <= lastIndex; ++i) {
    if (array[i] === value) {
      if (i < lastIndex) {
        for (let j = i + 1; j < array.length; ++j) {
          array[j - 1] = array[j];
        }
      }
      array.length = lastIndex;
      return true;
    }
  }
  return false;
}

export function mutableMoveArrayItem (newIndex, oldIndex, array) {
  const movedElement = array[oldIndex];
  if (newIndex > oldIndex) for (let i = oldIndex; i < newIndex; ++i) {
    array[i] = array[i + 1];
  }
  else for (let i = oldIndex; i > newIndex; --i) {
    array[i] = array[i - 1];
  }
  array[newIndex] = movedElement;
}

export function arrayConcat<T, U> (left: readonly T[], right: readonly U[]): readonly (T | U)[];
export function arrayConcat<T, U> (left: T[], right: U[]): (T | U)[];
export function arrayConcat<T, U> (left: T[], right: U[]): (T | U)[] {
  if (left.length === 0) return right;
  if (right.length === 0) return left;
  return (left as (T | U)[]).concat(right);
}

/**
 * @param test Takes an array element, a comparator reference, and returns an integer. A negative number indicates that
 * the comparator has a lower ordinal position than the current array item. A positive number indicates the opposite.
 * Zero indicates an identity match. If found for a value that exists alongside several duplicates of itself, the index
 * returned is always the left-most index among each of the duplicates.
 * @param comparator A value to pass to the `test` function for each array element being tested.
 * @param sortedArray The array to search
 * @returns The index of a matched element, or -1 if no match is found.
 */
export function binarySearch<TItem, TComparator> (
  test: binarySearch.Test<TItem, TComparator>,
  comparator: TComparator,
  sortedArray: readonly TItem[]
): number {
  let left = 0, right = sortedArray.length, i = right >>> 1, found = false, done = right === 0;
  while (!done) {
    const c = test(sortedArray[i], comparator, i, sortedArray);
    if (c === 0) {
      if (i > left) while (test(sortedArray[i - 1], comparator, i - 1, sortedArray) === 0) {
        --i;
      }
      found = true;
      done = true;
    }
    else {
      if (c > 0) left = i;
      else right = i;
      const step = (right - left) >>> 1;
      if (left + step === i) {
        done = true;
      }
      else {
        i = left + step;
      }
    }
  }
  return found ? i : -1;
}
export namespace binarySearch {
  export type Test<TItem, TComparator> = (
    /** An array element whose position is to be tested relative to the comparator */
    element: TItem,
    /** A value that the current array element is to be compared with */
    comparator: TComparator,
    /** The array index of the current element being tested */
    index: number,
    /** The full array being searched */
    array: readonly TItem[]
  ) => number;
}

/**
 * Returns the lowest index at which an item with the given comparator value can be inserted while preserving ordering.
 *
 * Semantics of the supplied test function must match those used by binarySearch:
 *  - Negative result: comparator is lower (should be to the left of the element).
 *  - Positive result: comparator is higher (should be to the right of the element).
 *  - Zero: identity/equality (no ordinal difference).
 *
 * For duplicates, the returned index is the left-most position (lower bound). To insert after existing duplicates,
 * advance the returned index while subsequent elements compare with result 0.
 */
export function findInsertionIndex<TItem, TComparator> (
  test: binarySearch.Test<TItem, TComparator>,
  comparator: TComparator,
  sortedArray: readonly TItem[]
): number {
  let left = 0;
  let right = sortedArray.length;
  while (left < right) {
    const mid = (left + right) >>> 1;
    const c = test(sortedArray[mid], comparator, mid, sortedArray);
    if (c > 0) {
      left = mid + 1;
    }
    else {
      right = mid;
    }
  }
  return left;
}

export function insertIntoSortedArray<TItem> (
  test: binarySearch.Test<TItem, TItem>,
  item: TItem,
  sortedArray: TItem[]
): number {
  const index = findInsertionIndex(test, item, sortedArray);
  if (index === sortedArray.length) sortedArray.push(item);
  else if (index === 0) sortedArray.unshift(item);
  else sortedArray.splice(index, 0, item);
  return index;
}
