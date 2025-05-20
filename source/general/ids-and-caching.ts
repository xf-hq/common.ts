import { isUndefined } from './type-checking';
import * as UUID from 'uuid';
import Cuid from '@paralleldrive/cuid2';

export const newUUID: () => string = () => UUID.v4();

export const cuid8 = Cuid.init({ counter: Math.random, length: 8, fingerprint: 'salix' });
export const cuid12 = Cuid.init({ counter: Math.random, length: 12, fingerprint: 'salix' });
export const cuid16 = Cuid.init({ counter: Math.random, length: 16, fingerprint: 'salix' });
export const cuid24 = Cuid.init({ counter: Math.random, length: 24, fingerprint: 'salix' });
export const cuid32 = Cuid.init({ counter: Math.random, length: 32, fingerprint: 'salix' });
export const isCuid8 = (value: string) => Cuid.isCuid(value) && value.length === 8;
export const isCuid12 = (value: string) => Cuid.isCuid(value) && value.length === 12;
export const isCuid16 = (value: string) => Cuid.isCuid(value) && value.length === 16;
export const isCuid24 = (value: string) => Cuid.isCuid(value) && value.length === 24;
export const isCuid32 = (value: string) => Cuid.isCuid(value) && value.length === 32;

export function makeCache<O extends object, I, F extends (object: O) => I> (compute: F): F {
  const cache = new WeakMap<object, I>();
  return ((objectRef: O) => fromCache(compute, cache, objectRef)) as F;
}
export function fromCache<O extends object, I> (compute: (object: O) => I, weakMapCache: WeakMap<O, I>, objectRef: O) {
  let value = weakMapCache.get(objectRef);
  if (isUndefined(value)) weakMapCache.set(objectRef, value = compute(objectRef));
  return value;
}

export interface IdGenerator {
  (): number;
  readonly last: number;
  tap (f: (id: number) => void): number;
  cachedPerObject (object: object): number;
  withCallback (callback: (id: number) => void): number;
}
export function IdGenerator (base = 0, step = 1): IdGenerator {
  let _id = base;
  const idgen = () => _id += step;
  const withCallback = (callback: (id: number) => void) => { const id = idgen(); callback(id); return id; };
  Object.defineProperties(idgen, {
    'last': { get () { return _id; } },
    'tap': { writable: false, value: (f) => { const id = idgen(); f(id); return id; } },
    'cachedPerObject': { configurable: true, enumerable: false, writable: false, value: makeCache(idgen) },
    'withCallback': { configurable: true, enumerable: false, writable: false, value: withCallback },
  });
  return idgen as IdGenerator;
}
export namespace IdGenerator {
  export interface Factory {
    (base?: number, step?: number): IdGenerator;
    readonly global: IdGenerator;
  }
  export const global = IdGenerator();
}
