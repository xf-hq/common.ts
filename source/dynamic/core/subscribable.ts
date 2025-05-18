import { disposableFunction } from '../../general/disposables';
import { bindMethod } from '../../general/functional';
import { isDefined, isFunction } from '../../general/type-checking';

export interface Subscribable<TEventArgs extends unknown[] = unknown[]> {
  readonly isEnded?: boolean;
  subscribe<TRefArgs extends any[] = []> (subscriber: Subscribable.Subscriber<TEventArgs, TRefArgs>, ...args: TRefArgs): DisposableFunction;
}
export namespace Subscribable {
  export class Controller<TEventArgs extends unknown[] = unknown[]> implements Subscribable<TEventArgs> {
    constructor (onDemandChanged?: DemandObserver<TEventArgs>) {
      this.#onDemandChanged = onDemandChanged;
    }
    readonly #onDemandChanged: DemandObserver<TEventArgs> | undefined;
    readonly #subscriptions: Subscription<TEventArgs, unknown[]>[] = [];
    #demandRefCount = 0;
    #newSubscriptionsAwaitingEndEvents: EndableSubscription<TEventArgs, unknown[]>[] | undefined;

    private notifyDemandChanged (event: Extract<DemandObserver.Event, 'online' | 'offline'>): void;
    private notifyDemandChanged (event: Extract<DemandObserver.Event, 'subscribe' | 'unsubscribe'>, receiver: Receiver<TEventArgs, unknown[]>): void;
    private notifyDemandChanged (event: DemandObserver.Event, receiver?: Receiver<TEventArgs, unknown[]>) {
      const onDemandChanged = this.#onDemandChanged;
      if (isDefined(onDemandChanged)) {
        if (isFunction(onDemandChanged)) onDemandChanged(event, this, receiver);
        else switch (event) {
          case 'online': onDemandChanged.online?.(this); break;
          case 'offline': onDemandChanged.offline?.(this); break;
          case 'subscribe': onDemandChanged.subscribe?.(this, receiver!); break;
          case 'unsubscribe': onDemandChanged.unsubscribe?.(this, receiver!); break;
        }
      }
    }

    get demandExists () { return this.#subscriptions.length > 0; }
    get subscriberCount () { return this.#subscriptions.length; }
    get isEnded () { return isDefined(this.#newSubscriptionsAwaitingEndEvents); }

    /**
     * In most cases this method should not need to be called directly. It is exposed publicly to allow for special
     * implementation cases where there is a need to ensure that the 'online' event has been called before a
     * subscription is made available to a subscriber. If manually calling this method, make sure that that an
     * accompanying call to `__decrementDemand` is made after the initial subscriber has been added, otherwise the
     * reference count may never reach zero and the 'offline' event will never be emitted.
     */
    __incrementDemand () {
      if (++this.#demandRefCount === 1) {
        this.notifyDemandChanged('online');
      }
    }
    /**
     * See {@link __incrementDemand} for usage notes.
     */
    __decrementDemand () {
      if (--this.#demandRefCount === 0) {
        this.notifyDemandChanged('offline');
      }
    }

    subscribe<TRefArgs extends any[] = []> (receiver: Subscriber<TEventArgs, TRefArgs>, ...refArgs: TRefArgs): DisposableFunction {
      if (isFunction(receiver)) receiver = { signal: receiver };
      this.__incrementDemand();
      const subscription: Subscription<TEventArgs, TRefArgs> = { receiver, refArgs, terminated: false };
      this.#subscriptions.push(subscription);
      this.notifyDemandChanged('subscribe', receiver);

      if (this.isEnded) this.scheduleImmediateEndForNewSubscriber(subscription);

      return disposableFunction(() => {
        const index = this.#subscriptions.indexOf(subscription);
        if (index === -1) return;

        this.#subscriptions.splice(index, 1);
        this.notifyDemandChanged('unsubscribe', receiver);

        subscription.terminated = true;
        if (isDefined(receiver.unsubscribed)) receiver.unsubscribed(...refArgs);

        this.__decrementDemand();
      });
    }

    /**
     * Dispatches the specified event arguments to all active subscribers. An error will be thrown the `end` method has
     * been called previously. The `isEnded` property can be checked to determine if this is the case.
     */
    signal (...eventArgs: TEventArgs) {
      if (this.isEnded) throw new Error(`Cannot emit events after the controller has been ended. Check the 'isEnded' property if unsure.`);

      let sub: Subscription<TEventArgs, any>;
      for (let i = 0; i < this.#subscriptions.length; i++) {
        sub = this.#subscriptions[i];
        sub.receiver.signal(...eventArgs, ...sub.refArgs);
      }
    }

    /**
     * Signals that no further 'signal' events will be ever be dispatched to subscribers beyond this point. Future calls
     * to `end` will be disregarded.
     *
     * Note that new subscriptions are still possible after this point and all demand-related events sent to the
     * controller's owner will continue to be emitted as normal, potentially leading to redundant work being done if the
     * demand event handler implementation does not track whether the `end` has been called previously (the `isEnded`
     * property is a way of checking this if it's not being tracked elsewhere). Aside from this, the only difference in
     * intrinsic behaviour after calling `end` is that new subscribers will be immediately sent an 'end' event in the
     * next tick after they subscribe, and further attempts to emit 'signal' events will cause an error to be thrown.
     */
    end () {
      if (this.isEnded) return;
      this.#newSubscriptionsAwaitingEndEvents = [];
      for (let i = 0; i < this.#subscriptions.length; i++) {
        const sub = this.#subscriptions[i];
        if (isDefined(sub.receiver.end)) sub.receiver.end(...sub.refArgs);
      }
    }

    private scheduleImmediateEndForNewSubscriber (subscription: Subscription<TEventArgs, unknown[]>) {
      if (!isEndableSubscription(subscription)) return;
      const newSubscriptions = this.#newSubscriptionsAwaitingEndEvents!;
      newSubscriptions.push(subscription);
      if (newSubscriptions.length === 1) {
        const callback = this.#processScheduledEndForNewSubscribers ??= bindMethod(this.processScheduledEndForNewSubscribers, this);
        queueMicrotask(callback);
      }
    }
    #processScheduledEndForNewSubscribers: () => void;
    private processScheduledEndForNewSubscribers () {
      const newSubscriptions = this.#newSubscriptionsAwaitingEndEvents!;
      this.#newSubscriptionsAwaitingEndEvents = [];
      for (let i = 0; i < newSubscriptions.length; i++) {
        const sub = newSubscriptions[i];
        if (!sub.terminated) sub.receiver.end(...sub.refArgs);
      }
    }
  }
  export namespace Controller {
    export interface Auxiliary<TEventArgs extends unknown[]> extends Omit<Controller<TEventArgs>, 'subscribe' | 'signal' | 'end'> {}
  }

  export type DemandObserver<TEventArgs extends unknown[]> = DemandObserver.ListenerFunction<TEventArgs> | DemandObserver.ListenerInterface<TEventArgs>;
  export namespace DemandObserver {
    export type Event = 'subscribe' | 'online' | 'unsubscribe' | 'offline';

    export interface ListenerFunction<TEventArgs extends unknown[]> {
      (event: DemandObserver.Event, controller: Controller<TEventArgs>, receiver?: Receiver<TEventArgs, unknown[]>): void;
    }
    export interface ListenerInterface<TEventArgs extends unknown[]> {
      online? (controller: Controller<TEventArgs>): void;
      offline? (controller: Controller<TEventArgs>): void;
      subscribe? (controller: Controller<TEventArgs>, receiver: Receiver<TEventArgs, unknown[]>): void;
      unsubscribe? (controller: Controller<TEventArgs>, receiver: Receiver<TEventArgs, unknown[]>): void;
    }
  }

  export type Subscriber<TEventArgs extends unknown[], TRefArgs extends any[] = []> = Receiver<TEventArgs, TRefArgs> | Receiver<TEventArgs, TRefArgs>['signal'];
  export interface Receiver<TEventArgs extends unknown[], TRefArgs extends any[] = []> {
    signal (...refArgs: [...TEventArgs, ...TRefArgs]): void;
    /**
     * Signal: No further `signal` events will ever be received. The subscription is still active nonetheless.
     *
     * @remarks
     * Note that it is never guaranteed that an `end` event will be received. Dispatch of an `end` event is at the
     * discretion of the source's implementer.
     */
    end? (...args: TRefArgs): void;
    /**
     * Signal: The receiver is no longer subscribed. Work should cease and state should be cleaned up.
     *
     * @remarks
     * Indicates that the subscription with which the receiver is associated has been terminated. No further events will
     * be dispatched to the receiver. Any current state or subcontextual work being maintained as part of the receiver's
     * lifecycle should be cleaned up and any associated subprocesses terminated/aborted accordingly.
     *
     * The 'terminate' signal is a quality-of-life convenience that provides implementers with a way to automatically
     * clean up references that are isolated to the scope of execution of the receiver, eliminating the need to manually
     * expose those internal references or the means to clean them up when the subscription's owner decides to terminate
     * it.
     *
     * Note that unlike the 'end' signal, the 'terminate' signal is non-optional for well-behaving implementations of
     * the `Subscribable` interface:
     *
     * - When a subscription with which a receiver is associated is terminated, if the receiver implements `terminate`,
     *   it must be signalled accordingly.
     * - If the source implementing `Subscribable` also implements some form of destruction mechanism (such as
     *   `Disposable`) and that mechanism is invoked, all actively subscribed receivers that implement `terminate` must
     *   be signalled immediately.
     */
    unsubscribed? (...args: TRefArgs): void;
  }

  interface Subscription<TEventArgs extends unknown[], TRefArgs extends any[] = []> {
    readonly receiver: Receiver<TEventArgs, TRefArgs>;
    readonly refArgs: TRefArgs;
    terminated: boolean;
  }
  interface EndableSubscription<TEventArgs extends unknown[], TRefArgs extends any[] = []> extends Subscription<TEventArgs, TRefArgs> {
    readonly receiver: SomeRequired<Receiver<TEventArgs, TRefArgs>, 'end'>;
  }
  const isEndableSubscription = (sub: Subscription<any, any>): sub is EndableSubscription<any, any> => isDefined(sub.receiver.end);

  /**
   * Creates a reference-counted instance of a demand listener for scenarios where the same initialisation work has to
   * be done if any of a set of subscribable sources comes online. An example is a pair of independent mouse coordinate
   * sources; one for 'x' and one for 'y'. If either source comes online, the implementation would need to set up a
   * 'mousemove' DOM event listener. Redundancy is avoided by having both sources share the same demand listener.
   */
  export function createSharedDemandListener<TEventArgs extends unknown[]> (events: { online (): void; offline (): void }): DemandObserver<TEventArgs> {
    let refCount = 0;
    function online () {
      if (refCount++ === 0) events.online();
    }
    function offline () {
      if (--refCount === 0) events.offline();
    }
    return (demand) => {
      switch (demand) {
        case 'online': online(); break;
        case 'offline': offline(); break;
      }
    };
  }
}
