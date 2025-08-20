import { dispose } from '../../general/disposables';
import { OnDemandResource } from '../../facilities/on-demand-resources';
import { Async } from './async';
import { StatefulAsync } from './stateful-async';

export const isOnDemandAsync = (value: unknown): value is OnDemandAsync<unknown> => value instanceof OnDemandAsync;

/**
 * Mediates access to a lazily-produced `Async` reference. No initial work is done to produce a result until the first
 * call to {@link OnDemandAsync.require} is made, signifying establishment of demand.
 *
 * @remarks
 * Internal state may be maintained while demand exists for the result, even after the result is fully resolved, as it
 * may be necessary to maintain the state of the result while demand for it persists.
 *
 * When the result is no longer required, the `Async` instance returned by the `require` method should be disposed.
 * Alternatively, an `AbortSignal` can be passed to the `require` method, in which case disposal will happen
 * automatically when the abort signal is triggered.
 *
 * Internal state is cleaned up when demand for the resource drops to zero, but as `Async` is effectively a more capable
 * superset of a `Promise`, in most cases work done to produce the result will be idempotent. If work only needs to be
 * done once to produce the result, and demand lapses before the result is initially produced, the work might be
 * cancelled internally and then restarted when demand is re-established, or it might be suspended and then resumed on
 * demand, or the work might even continue despite the lack of demand, such as might be the case if the work is not
 * directly cancellable, as might be the case if awaiting the result of an HTTP request.
 */
export class OnDemandAsync<T> implements Async.OnDemand<T> {
  static create<T> (driver: Async.StatefulDriver<T>): OnDemandAsync<T> {
    const source = OnDemandResource.create(ResourceDriver, { driver: driver });
    return new OnDemandAsync(source);
  }
  constructor (source: OnDemandResource<Async<T>>) { this.#source = source; }
  readonly #source: OnDemandResource<Async<T>>;

  /**
   * Returns an `Async` that should be disposed once it is no longer required. The returned `Async` wraps a
   * reference-counted inner `Async` that is disposed only when the reference count drops to zero.
   * @param abortSignal An optional `AbortSignal` that can be used to control disposal of the returned `Async`,
   * alleviating the need to dispose the returned `Async` manually once it is no longer required.
   */
  require (abortSignal?: AbortSignal): Async<T> {
    return StatefulAsync.load(new OnDemandAsyncDriver(this.#source), abortSignal);
  }

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
