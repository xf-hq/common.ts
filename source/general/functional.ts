/** A type-safe alternative to calling `bind` natively. */
export function bindMethod<F extends AnyFunction> (f: F, thisArg: object): F;
export function bindMethod<F extends AnyFunction> (f: F, thisArg: object, ...args: Parameters<F>): () => ReturnType<F>;
export function bindMethod<F extends AnyFunction, A extends PartialParameters<F>> (f: F, thisArg: object, ...args: A): (...args: RemainingParameters<F, A>) => ReturnType<F>;
export function bindMethod (f: AnyFunction, thisArg: object, ...args: any[]) {
  return f.bind(thisArg, ...args);
}

export function bindFunction<F extends AnyFunction> (f: F): F;
export function bindFunction<F extends AnyFunction> (f: F, ...args: Parameters<F>): () => ReturnType<F>;
export function bindFunction<F extends AnyFunction, A extends PartialParameters<F>> (f: F, ...args: A): (...args: RemainingParameters<F, A>) => ReturnType<F>;
export function bindFunction (f: AnyFunction, ...args: any[]) {
  return args.length === 0 ? f : f.bind(null, ...args);
}

export function applyFunction<F extends AnyFunction> (f: F, args: Parameters<F> | IArguments): ReturnType<F> {
  return f.apply(null, args);
}
