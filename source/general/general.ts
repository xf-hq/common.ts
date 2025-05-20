import { isNotNull, isUndefined } from './type-checking';

export function identity<T> (x: T): T { return x; }

const rxStackLine = /^\s*at\s(\S+)/;
const MESSAGE_PLACEHOLDER = `<STACK TRACE CAPTURE>`;
export function captureStackTrace (linesToRemove = 0, stack?: string) {
  let modifyMessage = false;
  if (isUndefined(stack)) {
    stack = new Error(MESSAGE_PLACEHOLDER).stack!;
    modifyMessage = true;
    ++linesToRemove;
  }
  const lines = stack.split('\n');
  lines.splice(1, linesToRemove);
  if (modifyMessage) {
    const functionName = lines[1].match(rxStackLine)?.[1] ?? null;
    if (isNotNull(functionName)) {
      lines[0] = lines[0].replace(MESSAGE_PLACEHOLDER, `Stack captured in call to ${functionName}()`);
    }
  }
  return lines.join('\n');
}

export const newPlaceholderProxy = <T = any>(): T => new Proxy((() => {}) as any, { get (t, p, r) { return r; }, apply: (f, t) => t });

export function dualObjectFunctionProxy<O extends object, F extends AnyFunction> (o: O, f: F): O & F {
  return new Proxy(f as O & F, new DualObjectFunctionProxyHandler<O, F>(o));
}
class DualObjectFunctionProxyHandler<O extends object, F extends AnyFunction> implements ProxyHandler<O & F> {
  constructor (object: O) { this.#object = object; }
  readonly #object: O;
  get (target: F & O, property: PropertyKey, receiver: any): any {
    return Reflect.get(target, property, receiver) ?? target[property];
  }
  apply (target: O & F, thisArg: any, argArray: any[]) {
    return Reflect.apply(target, thisArg, argArray);
  }
}
