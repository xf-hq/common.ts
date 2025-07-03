import { isIterable } from '../../../general/type-checking';
import { Subscribable } from '../../core/subscribable';
import { SetSourceTag } from './common';
import { DraftSetSourceEvent } from './draft-set-source-event';
import { ManualSetSource } from './manual-set-source';

export function isSetSource (source: any): source is SetSource<any> {
  return source?.[SetSourceTag] === true;
}

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
  export interface Event<T> {
    readonly add: ReadonlyArray<T> | null;
    readonly delete: ReadonlyArray<T> | null;
  }
  export namespace Event {
    export function draft<T> () { return new DraftSetSourceEvent<T>(); }
    export type Draft<T> = DraftSetSourceEvent<T>;
  }
  export interface Immediate<T> extends SetSource<T> {
    readonly __set: ReadonlySet<T>;
    readonly size: number;
  }
  export interface Manual<T> extends Immediate<T> {
    readonly __emitter: Subscribable.Controller.Auxiliary<[event: SetSource.Event<T>]>;

    hold (): void;
    release (): void;

    add (value: T): void;
    delete (value: T): boolean;
    clear (): void;
    modify (additions: ReadonlyArray<T>, deletions: ReadonlyArray<T>): void;

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
    add? (values: ReadonlyArray<T>): void;
    delete? (values: ReadonlyArray<T>): void;
    end? (): void;
    unsubscribed? (): void;
  }

  export class EventReceiverAdapter<T> implements Receiver<T> {
    constructor (private readonly receiver: EventReceiver<T>) {}
    event (event: Event<T>): void {
      if (event.add) {
        this.receiver.add?.(event.add);
      }
      if (event.delete) {
        this.receiver.delete?.(event.delete);
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
