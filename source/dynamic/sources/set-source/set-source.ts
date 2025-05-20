import { isIterable } from '../../../general/type-checking';
import { Subscribable } from '../../core/subscribable';
import { SetSourceTag, type InternalSetSource } from './common';
import { ManualSetSource } from './manual-set-source';

export const isSetSource = <T, U> (source: SetSource<T> | U): source is SetSource<T> => source?.[SetSourceTag] === true;

export interface SetSource<T> {
  readonly [SetSourceTag]: true;
  subscribe<A extends any[]> (onChange: SetSource.Subscriber<T, A>, ...args: A): SetSource.Subscription<T>;
}
export namespace SetSource {
  export type Receiver<T, A extends any[] = []> = Subscribable.Receiver<[event: SetSource.Event<T>], A>;
  export type Subscriber<T, A extends any[] = []> = Subscribable.Subscriber<[event: SetSource.Event<T>], A>;

  export interface Subscription<T> extends Disposable {
    readonly __set: ReadonlySet<T>;
  }

  export type Event<T> = Event.Add<T> | Event.Delete<T> | Event.Clear;
  export namespace Event {
    interface BaseEvent<T extends string> {
      readonly kind: T;
    }
    export interface Add<T> extends BaseEvent<'add'> {
      readonly value: T;
    }
    export interface Delete<T> extends BaseEvent<'delete'> {
      readonly value: T;
    }
    export interface Clear extends BaseEvent<'clear'> {
      readonly previousSize: number;
    }
  }

  export interface Manual<T> extends InternalSetSource<T> {
    // readonly __set: ReadonlySet<T>;
    readonly size: number;

    add (value: T): void;
    delete (value: T): boolean;
    clear (): void;

    has (value: T): boolean;
    values (): Iterable<T>;
  }
  export namespace Manual {
    export interface DemandObserver<T> {
      online? (source: Manual<T>): void;
      offline? (source: Manual<T>): void;
      subscribe? (source: Manual<T>, receiver: Receiver<T, any[]>): void;
      unsubscribe? (source: Manual<T>, receiver: Receiver<T, any[]>): void;
    }
  }

  export function create<T> (set?: Set<T>): Manual<T>;
  export function create<T> (set: Set<T>, onDemandChanged: Manual.DemandObserver<T>): Manual<T>;
  export function create<T> (onDemandChanged: Manual.DemandObserver<T>): Manual<T>;
  export function create<T> (arg0?: Set<T> | Manual.DemandObserver<T>, arg1?: Manual.DemandObserver<T>): Manual<T> {
    const [set, onDemandChanged] = isIterable(arg0) ? [arg0, arg1] : [new Set<T>(), arg0];
    return new ManualSetSource(set, onDemandChanged);
  }

  export interface EventReceiver<T> {
    add? (event: Event.Add<T>): void;
    delete? (event: Event.Delete<T>): void;
    clear? (event: Event.Clear): void;
    end? (): void;
    unsubscribed? (): void;
  }
  export class EventReceiverAdapter<T> implements Receiver<T> {
    constructor (private readonly receiver: EventReceiver<T>) {}
    signal (event: Event<T>): void {
      switch (event.kind) {
        case 'add': this.receiver.add?.(event); break;
        case 'delete': this.receiver.delete?.(event); break;
        case 'clear': this.receiver.clear?.(event); break;
      }
    }
    end (): void {
      this.receiver.end?.();
    }
    unsubscribed (): void {
      this.receiver.unsubscribed?.();
    }
  }
  export function subscribe<T> (source: SetSource<T>, receiver: EventReceiver<T>): Subscription<T> {
    return source.subscribe(new EventReceiverAdapter(receiver));
  }
}
