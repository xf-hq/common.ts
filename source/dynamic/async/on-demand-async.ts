import { dispose } from '../../general/disposables';
import { OnDemandResource } from '../../facilities/on-demand-resources';
import { Async } from './async';
import { StatefulAsync } from './stateful-async';

export class OnDemandAsync<T> implements Async.OnDemand<T> {
  static create<T> (driver: Async.StatefulDriver<T>): OnDemandAsync<T> {
    const source = OnDemandResource.create(ResourceDriver, { driver: driver });
    return new OnDemandAsync(source);
  }
  constructor (source: OnDemandResource<Async<T>>) { this.#source = source; }
  readonly #source: OnDemandResource<Async<T>>;

  require (): Async<T> { return StatefulAsync.load(new OnDemandAsyncDriver(this.#source)); }
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