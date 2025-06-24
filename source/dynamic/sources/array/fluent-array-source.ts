import { dispose } from '../../../general/disposables';
import { returnVoid } from '../../../general/presets';
import { isFunction } from '../../../general/type-checking';
import type { Subscribable } from '../../core';
import { ArraySource } from './array-source';
import { ArraySourceTag } from './common';
import { FilteredArraySource } from './filtered-array-source';
import { MappedArraySource } from './mapped-array-source';
import { SortedArraySource } from './sorted-array-source';
import { StatefulMappedArraySource } from './stateful-mapped-array-source';

export class FluentArraySource<T> implements ArraySource<T> {
  constructor (private readonly _source: ArraySource<T>) {}

  get [ArraySourceTag] (): true { return true; }

  subscribe<A extends any[]> (subscriber: Subscribable.Subscriber<[event: ArraySource.Event<T>], A>, ...args: A): ArraySource.Subscription<T>;
  subscribe<V, A extends any[]> (abort: AbortSignal, source: ArraySource<V>, receiver: ArraySource.Subscriber<V, A>, ...args: A): ArraySource.Subscription<V>;
  subscribe (): ArraySource.Subscription<T> {
    if (arguments[0] instanceof AbortSignal) {
      return ArraySource.subscribe.apply(null, arguments);
    }
    return this._source.subscribe.apply(this._source, arguments);
  }

  map<U> (f: (a: T) => U): FluentArraySource<U>;
  map<U, TItemState, TCommonState = void> (mapper: ArraySource.StatefulMapper<T, U, TItemState, TCommonState>): FluentArraySource<U>;
  map<U, TItemState, TCommonState = void> (arg: ((a: T) => U) | ArraySource.StatefulMapper<T, U, TItemState, TCommonState>): FluentArraySource<U> {
    const source = isFunction(arg)
      ? new MappedArraySource(arg, this._source)
      : new StatefulMappedArraySource(arg, this._source);
    return new FluentArraySource<U>(source);
  }

  mapToDisposable<U extends Disposable> (f: (a: T) => U): FluentArraySource<U> {
    const source = this.map({
      item: {
        init: (a) => f(a),
        map: (b) => b,
        dispose: (b) => dispose(b),
      },
    });
    return new FluentArraySource<U>(source);
  }

  filter (f: (value: T) => boolean): FluentArraySource<T> {
    const source = new FilteredArraySource(f, this._source);
    return new FluentArraySource<T>(source);
  }

  sort (compareFn: (a: T, b: T) => number): FluentArraySource<T> {
    const source = new SortedArraySource(compareFn, this._source);
    return new FluentArraySource<T>(source);
  }

  tap<A> (source: ArraySource<A>): Disposable {
    return source.subscribe(returnVoid, source);
  }
}
