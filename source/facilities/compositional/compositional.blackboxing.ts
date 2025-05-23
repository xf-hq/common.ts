import type { Compositional } from './compositional';

/**
 * Implementation details from the `Compositional` module that I'd prefer were not included in stack traces and
 * debugging sessions taking place via the browser's developer console.
 */
export namespace CompositionalBlackboxing {
  export const InterfaceProxyHandler = ({ _interfaceType_, _env_, _dummy_ }: {
    _interfaceType_: symbol;
    _env_: symbol;
    _dummy_: symbol;
  }) => (
    class InterfaceProxyHandler<TInterface extends object, TEnv extends object> implements ProxyHandler<TInterface> {
      // constructor (env: TEnv) { this.#env = env; }
      constructor (interfaceType: Compositional.InterfaceType<TInterface, TEnv>, env: TEnv) {
        this.#interfaceType = interfaceType;
        this.#env = env;
      }
      readonly #interfaceType: Compositional.InterfaceType<TInterface, TEnv>;
      readonly #env: TEnv;

      get (target: TInterface, key: string | symbol, receiver: any) {
        const env = this.#env;
        switch (key) {
          case _interfaceType_: return this.#interfaceType;
          case _env_: return env;
          case _dummy_: return target;
        }
        if (key in target) return Reflect.get(target, key, receiver);
        if (key in env) return Reflect.get(env, key, env);
      }
      set (target: TInterface, key: string | symbol, value: any, receiver: any) {
        this.#env[key as string] = value;
        return true;
      }
    }
  );
}
