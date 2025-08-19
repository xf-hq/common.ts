import { dispose } from '../../general/disposables';
import { OnDemandResource } from '../../facilities/on-demand-resources';
import { Async } from './async';
import { StatefulAsync } from './stateful-async';

export const isOnDemandAsync = (value: unknown): value is OnDemandAsync<unknown> => value instanceof OnDemandAsync;

export class OnDemandAsync<T> implements Async.OnDemand<T> {
  static create<T> (driver: Async.StatefulDriver<T>): OnDemandAsync<T> {
    const source = OnDemandResource.create(ResourceDriver, { driver: driver });
    return new OnDemandAsync(source);
  }
  constructor (source: OnDemandResource<Async<T>>) { this.#source = source; }
  readonly #source: OnDemandResource<Async<T>>;

  /**
   * Returns an `Async` that should be disposed once it is no longer required. The returned `Async` wraps an inner one
   * that is not disposed unless this was the last active reference to it.
   */
  require (): Async<T> { return StatefulAsync.load(new OnDemandAsyncDriver(this.#source)); }

  map<B> (f: (a: T) => B): OnDemandAsync<B> {
    const source = OnDemandResource.create(MappedResourceDriver, { source: this, fn: f });
    return new OnDemandAsync(source);
  }
}

class OnDemandAsyncDriver<T> implements Async.StatefulDriver<T> {
  constructor (source: OnDemandResource<Async<T>>) { this.#source = source; }
  readonly #source: OnDemandResource<Async<T>>;
  #inner: Async<T> | undefined;

  initialize (resolve: (result: T) => void, reject: (reason?: any) => void) {
    this.#inner = this.#source.require();
    this.#inner.then(resolve, reject);
  }
  release () {
    this.#inner = undefined;
    this.#source.release();
  }
}

interface Env<T> {
  readonly driver: Async.StatefulDriver<T>;
  source?: Async<any> | undefined;
}

const ResourceDriver: OnDemandResource.Driver<Async<any>, Env<any>> = {
  initialize: (env) => {
    env.source = StatefulAsync.load(env.driver);
    return () => {
      dispose(env.source!);
      env.source = undefined;
    };
  },
  dereference: (env) => env.source!,
};

interface MappedEnv<A, B> {
  readonly source: OnDemandAsync<A>;
  readonly fn: (a: A) => B;
  async?: Async<B> | undefined;
}
const MappedResourceDriver: OnDemandResource.Driver<Async<any>, MappedEnv<any, any>> = {
  initialize: (env) => {
    env.async = Async.map(env.fn, env.source.require());
    return () => {
      dispose(env.async!);
      env.async = undefined;
    };
  },
  dereference: (env) => env.async!,
};
