import { AssociativeWeakSet } from '../../../facilities/weak-reference-management';
import { BinaryOperationSource, UnaryOperationSource } from './base-operation-value-sources';
import { ValueSource } from './value-source';

export interface StringSource extends ValueSource<string> {}
export namespace StringSource {
  export interface Receiver<A extends any[] = []> extends ValueSource.Receiver<string, A> {}
  export interface Subscription extends ValueSource.Subscription<string> {}
  export type DemandObserver = ValueSource.DemandObserver<string>;
  export interface Immediate extends ValueSource.Immediate<string> {}

  const cache = new AssociativeWeakSet<string, ValueSource<string>>();
  export function constant (value: string): ValueSource<string> {
    switch (value) {
      case '': return Empty;
      default: {
        let source = cache.get(value);
        if (!source) cache.set(value, source = ValueSource.constant(value));
        return source;
      }
    }
  }
  export interface Manual extends ValueSource.Manual<string> {}
  export function create (initialValue: string, onDemandChanged?: ValueSource.DemandObserver<string>): Manual {
    return ValueSource.create(initialValue, onDemandChanged);
  }

  export const Empty = ValueSource.constant('');

  export const concat = BinaryOperationSource.defineCombinedLTR<string>((left, right) => left + right, Empty);
  export const trim = UnaryOperationSource.define<string>(str => str.trim());
  export const toLowerCase = UnaryOperationSource.define<string>(str => str.toLowerCase());
  export const toUpperCase = UnaryOperationSource.define<string>(str => str.toUpperCase());
  export const length = UnaryOperationSource.define<string, number>(str => str.length);
  export const slice = (start?: number, end?: number) => UnaryOperationSource.define<string>(str => str.slice(start, end));
  export const replace = (searchValue: string | RegExp, replaceValue: string) => UnaryOperationSource.define<string>(str => str.replace(searchValue, replaceValue));
  export const padStart = (maxLength: number, fillString?: string) => UnaryOperationSource.define<string>(str => str.padStart(maxLength, fillString));
  export const padEnd = (maxLength: number, fillString?: string) => UnaryOperationSource.define<string>(str => str.padEnd(maxLength, fillString));
  export const includes = (searchString: string, position?: number) => UnaryOperationSource.define<string, boolean>(str => str.includes(searchString, position));
  export const startsWith = (searchString: string, position?: number) => UnaryOperationSource.define<string, boolean>(str => str.startsWith(searchString, position));
  export const endsWith = (searchString: string, position?: number) => UnaryOperationSource.define<string, boolean>(str => str.endsWith(searchString, position));
  export const split = (separator: string | RegExp, limit?: number) => UnaryOperationSource.define<string, string[]>(str => str.split(separator, limit));
}
