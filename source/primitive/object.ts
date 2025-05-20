import { isArray, isFunction, isNotNothing, isObject, isPlainObject, isPrimitive, isUndefined, shapeOf } from '../general/type-checking';

export const emptyObject = () => ({});

export function objectHasOneOrMoreUndefinedValues (object: AnyRecord) {
  for (const key in object) {
    if (isUndefined(object[key])) return true;
  }
  return false;
}

export function objectPropsAreDefined<TObject extends AnyRecord> (object: TObject): object is Required<TObject>;
export function objectPropsAreDefined<TObject extends AnyRecord, TKeys extends (keyof TObject)[]> (object: TObject, keys: TKeys): object is SomeRequired<TObject, TKeys[number]>;
export function objectPropsAreDefined<TObject extends AnyRecord, TKeys extends (keyof TObject)[]> (object: TObject, keys?: TKeys): object is SomeRequired<TObject, TKeys[number]> {
  if (isUndefined(keys)) return !objectHasOneOrMoreUndefinedValues(object);
  for (let i = 0; i < keys.length; ++i) {
    if (isUndefined(object[keys[i]])) return false;
  }
  return true;
}
export function objectPropsAreDefinedExclusively<TObject extends AnyRecord, TKeys extends (keyof TObject)[]> (object: TObject, keys: TKeys): object is SomeRequired<TObject, TKeys[number]> {
  const actualKeys = new Set(Object.keys(object) as (keyof TObject)[]);
  for (let i = 0; i < keys.length; ++i) {
    const key = keys[i];
    if (!actualKeys.has(key) || isUndefined(object[key])) return false;
    actualKeys.delete(key);
  }
  return actualKeys.size === 0;
}

export function hasKey<K extends PropertyKey> (key: K): <O>(object: O) => object is O & { [P in K]: Exclude<P extends keyof O ? O[P] : unknown, undefined> };
export function hasKey<K extends PropertyKey, O> (key: K, object: O): object is O & { [P in K]: Exclude<P extends keyof O ? O[P] : unknown, undefined> };
export function hasKey<K extends PropertyKey> (key: K, object?: any) {
  if (arguments.length === 1) return (object: unknown) => hasKey(key, object);
  return isNotNothing(object) && key in (isPrimitive(object) ? Object(object) : object);
}
export function objectGet<K extends keyof any> (key: K): <O>(object: O) => O extends NotNothing ? O extends { [P in K]: infer T } ? T : undefined : unknown;
export function objectGet<K extends keyof any, O> (key: K, object: O): O extends NotNothing ? O extends { [P in K]: infer T } ? T : undefined : unknown;
export function objectGet (key: PropertyKey, object?: object) {
  if (arguments.length === 1) return (object: unknown) => hasKey(key, object);
  return object?.[key];
}
export const objectSet = (key, value, object) => ({ ...object, [key]: value });
export const objectSetIfChanged = (key, value, object) => isObject(object) && object[key] === value ? object : objectSet(key, value, object);

export const cloneObjectScrubbed = <A, O extends SRecord>(value: A, object: O): Record<keyof O, A> => {
  const output: Record<keyof O, A> = <any>{};
  for (const key in object) {
    output[key] = value;
  }
  return output;
};
export const cloneObjectUninitialized = <O extends SRecord>(object: O) => cloneObjectScrubbed(undefined, object);

export const objectMap = <O, P>(f: <K extends Extract<keyof O, string>>(value: O[K], key: K) => P, object: O) => {
  const output: { [K in Extract<keyof O, string>]: P } = <any>{};
  for (const key in object) {
    output[key] = f(object[key], key);
  }
  return output;
};

export const objectMapByKey = <O, P>(f: <K extends keyof O>(key: K, value: O[K]) => P, object: O) => {
  const output: { [K in keyof O]: ReturnType<typeof f> } = <any>{};
  for (const key in object) {
    output[key] = f(key, object[key]);
  }
  return output;
};

export const objectMapSymbols = (f, object) => {
  const output = {};
  const symbols = Object.getOwnPropertySymbols(object);
  for (let i = 0; i < symbols.length; ++i) {
    const symbol = symbols[i];
    output[symbol] = f(object[symbol], symbol);
  }
  return output;
};

export const objectFilterMap = (filter, map, object) => {
  const output = {};
  for (const key in object) {
    if (filter(object[key], key)) {
      output[key] = map(object[key], key);
    }
  }
  return output;
};

export const objectMapKeys = <O>(f: <K extends keyof O, P extends PropertyKey>(key: K extends string ? K : never, value: O[K]) => P, object: O) => {
  const output: { [K in ReturnType<typeof f>]: O[keyof O] } = {};
  for (const key in object) {
    const value = object[key];
    output[f(key, value)] = value;
  }
  return output;
};

export const objectMapEntries = <O, K extends Extract<keyof O, string>, KNew extends string, VNew, F extends (key: K, value: O[K]) => [KNew, VNew]>(f: F, object: O) => {
  const output: { [K in ReturnType<F>[0]]: ReturnType<F> extends [K, infer V] ? V : never } = {} as any;
  for (const key in object) {
    const [k, v] = f(key as any as K, object[key as any as K]);
    output[k as any] = v;
  }
  return output;
};

export function objectForEach<T extends object> (f: objectForEach.Callback<T>, object: T): void {
  for (const key in object) {
    f(object[key], key);
  }
}
export namespace objectForEach {
  export type Callback<T extends object> = <K extends keyof T>(value: T[K], key: K) => void;
}

export function* objectIterateSRecord<O extends object> (object: O) {
  for (const key in object) {
    yield object[key];
  }
}

/**
 * @param {(key, value) => void} f
 * @param {object} object
 * @returns {void}
 */
export const objectForEachKey = (f, object) => {
  for (const key in object) {
    f(key, object[key]);
  }
};

export const objectForEachEntry = (f, object) => {
  for (const key in object) {
    f(key, object[key]);
  }
};

export function objectPick<O extends AnyRecord, K extends keyof O> (object: O, key: K[]): Pick<O, K>;
export function objectPick<K extends keyof O, O extends AnyRecord> (keys: K[], object: O): Pick<O, K>;
export function objectPick (arg0: any, arg1: any) {
  const [keys, object]: [PropertyKey[], AnyRecord] = isArray(arg0) ? [arg0, arg1] : [arg1, arg0];
  const record: AnyRecord = {};
  for (let i = 0; i < keys.length; ++i) {
    const key = keys[i];
    if (key in object) record[key] = object[key];
  }
  return record;
}

export const objectOmit = <K extends keyof O, O extends SRecord>(keys: K[], object: O): Omit<O, K> => {
  const record: Omit<O, K> = {} as any;
  const _keys = new Set(keys);
  for (const key in object as any) {
    if (!_keys.has(key as any)) record[key] = object[key];
  }
  return record;
};

export const objectMapToArray = <O, T>(f: <K extends Extract<keyof O, string>>(value: O[K extends Extract<keyof O, string> ? K : never], key: K) => T, object: O) => {
  const array: T[] = [];
  for (const key in object) {
    array.push(f(object[key], key));
  }
  return array;
};

export const switchMap = (map) => (key, value, object) => {
  if (key in map) {
    const f = map[key];
    return f(value, key, object);
  }
};

export const switchMapElse = (map, alt, key, value, object) => {
  const f = key in map ? map[key] : alt;
  return f(value, key, object);
};

export const objectSwitchMap = (map, object) => {
  const output = {};
  for (const key in object) {
    if (key in map) {
      const f = map[key];
      output[key] = f(object[key], key, object);
    }
  }
  return output;
};

export const objectSwitchMapValuesToArray = (map, object) => {
  const output: any[] = [];
  for (const key in object) {
    if (key in map) {
      const f = map[key];
      output.push(f(object[key], key, object));
    }
  }
  return output;
};

export const objectSwitchMapElse = (map, alt, object) => {
  const output = { ...object };
  for (const key in object) {
    output[key] = switchMapElse(map, alt, key, object[key], object);
  }
  return output;
};

export const objectSortKeysDefault = (object) => {
  const output = {};
  const keys = Object.keys(object);
  keys.sort();
  for (let i = 0; i < keys.length; ++i) {
    const key = keys[i];
    output[key] = object[key];
  }
  return output;
};

/** CAUTION: This may mutate sources as well. ENHANCEMENT: Make it possible to prevent the sources from being mutated. */
export function objectAssignDeep (target: SRecord, ...sources: SRecord[]) {
  if (sources.length === 0) return target;
  for (let i = 0; i < sources.length; ++i) {
    _mergeRecords(target, sources[i], true);
  }
  return target;
}
export function objectMergeDeep (target: SRecord, sources: SRecord[]): SRecord;
export function objectMergeDeep (...targetAndSources: SRecord[]): SRecord;
export function objectMergeDeep (target: SRecord, ...sources: any[]): SRecord {
  if (sources.length === 0) return target;
  if (sources.length === 1 && isArray(sources[0])) sources = sources[0] as any;
  target = { ...target };
  for (let i = 0; i < sources.length; ++i) {
    _mergeRecords(target, sources[i], false);
  }
  return target;
}
function _mergeValues (left: any, right: any, mutate: boolean) {
  switch (shapeOf(left)) {
    case 'record': {
      if (!isPlainObject(right)) break;
      if (!mutate) left = { ...left };
      return _mergeRecords(left, right, mutate);
    }
    case 'array': {
      if (!isArray(right)) break;
      if (!mutate) return [...left, ...right];
      left.push(...right);
      return left;
    }
  }
  return right;
}
function _mergeRecords (left: SRecord, right: SRecord, mutate: boolean) {
  for (const key in right) {
    left[key] = key in left ? _mergeValues(left[key], right[key], mutate) : right[key];
  }
  return left;
}

export function areObjectPropertiesIdentical (a: object, b: object): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (let i = 0; i < aKeys.length; ++i) {
    const key = aKeys[i];
    if (!(key in b)) return false;
    const aValue = a[key];
    const bValue = b[key];
    if (aValue !== bValue) return false;
  }
  return true;
}

/**
 * Intended as a getter-preserving alternative to `Object.assign`. Only the `source` object's own property descriptor
 * map is copied. Properties inherited via the prototype chain are not copied. The `source` argument must therefore be a
 * plain object -- i.e. its constructor must be `Object`. If it is not, an error will be thrown.
 * @param target The object to which the properties are to be assigned.
 * @param source The properties to assign to `target`. Note that `TSource` should be reflective of what is returned when
 *   calling `Object.getOwnPropertyDescriptors` on `source`.
 * @returns A reference to `object`, but with the type signature expanded to include that of `source`.
 */
export function copyOwnProps<TTarget extends object, TSource extends object> (target: TTarget, source: TSource): TTarget & TSource {
  if (source.constructor !== Object) {
    throw new Error(`The constructor of 'props' must always be 'Object'.`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(source);
  Object.defineProperties(target, descriptors);
  return target as TTarget & TSource;
}

export function defineGlobals (props: AnyRecord): void {
  if (typeof global === 'undefined') globalThis['global'] = globalThis;
  copyOwnProps(globalThis, props);
}

export function defineGetter<O extends object, K extends string, T> (object: O, name: K, get: () => T): O & { [P in K]: T } {
 Object.defineProperty(object, name, { configurable: false, enumerable: true, get });
 return object as any;
}

/**
 * Idempotent/memoized variant of `defineGetter` (the value is computed once and cached after the first call to the getter).
 * @example
 * // How to define a computed getter on a TypeScript namespace:
 * export namespace MyNamespace {
 *   export declare const propertyName: typeof MyValue;
 *   defineConstantGetter('propertyName', MyNamespace, () => MyValue);
 * }
 */
export function defineConstantGetter<O extends object, K extends string, T> (object: O, name: K, get: () => T): O & { [P in K]: T } {
 let value: unknown;
 Object.defineProperty(object, name, { configurable: false, enumerable: true, get: () => value ??= get() });
 return object as any;
}

export function defineGetters<O extends object> (object: O): O {
  const descriptors = Object.getOwnPropertyDescriptors(object);
  for (const key in descriptors) {
    const descriptor = descriptors[key];
    if (isFunction(descriptor.get) && descriptor.configurable !== false) {
      const get = descriptor.get;
      descriptor.get = function (this: object) { return get.call(this); };
    }
  }
  Object.defineProperties(object, descriptors);
  return object;
}
export function defineMemoizedGetters<O extends object> (object: O): O {
  const descriptors = Object.getOwnPropertyDescriptors(object);
  for (const key in descriptors) {
    const descriptor = descriptors[key];
    if (isFunction(descriptor.get) && descriptor.configurable !== false) {
      const get = descriptor.get;
      let cached = false;
      let value: unknown;
      descriptor.get = function (this: object) {
        if (!cached) {
          value = get.call(this);
          cached = true;
        }
        return value;
      };
    }
  }
  Object.defineProperties(object, descriptors);
  return object;
}
