import { disposableFunction, dispose, disposeOnAbort, isDisposable, isLegacyDisposable } from '../../general/disposables';
import { bindMethod } from '../../general/functional';
import { isDefined, isFunction } from '../../general/type-checking';
import { firstElement } from '../../primitive';

export interface Subscribable<TEventArgs extends unknown[] = unknown[]> {
  readonly isEnded?: boolean;
  subscribe<TRefArgs extends any[] = []> (subscriber: Subscribable.Subscriber<TEventArgs, TRefArgs>, ...args: TRefArgs): DisposableFunction;
}
export namespace Subscribable {
  export interface DemandStatus {
    readonly demandExists: boolean;
    readonly subscriberCount: number;
    readonly isEnded: boolean;
  }

  export function subscribe<TEventArgs extends unknown[], TRefArgs extends any[] = []> (
    abortSignal: AbortSignal,
    subscribable: Subscribable<TEventArgs>,
    subscriber: Subscriber<TEventArgs, TRefArgs>,
    ...refArgs: TRefArgs
  ): void {
    if (abortSignal.aborted) return;
    const disposable = subscribable.subscribe(subscriber, ...refArgs);
    disposeOnAbort(abortSignal, disposable);
  }

  export class Controller<TEventArgs extends unknown[] = []> implements Subscribable<TEventArgs>, DemandStatus {
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
          case 'subscribe': onDemandChanged.onSubscribe?.(this, receiver!); break;
          case 'unsubscribe': onDemandChanged.onUnsubscribe?.(this, receiver!); break;
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
      if (isFunction(receiver)) receiver = { event: receiver };
      this.__incrementDemand();
      const subscription: Subscription<TEventArgs, TRefArgs> = { receiver, refArgs, unsubscribed: false };
      this.#subscriptions.push(subscription);
      this.notifyDemandChanged('subscribe', receiver);

      if (this.isEnded) this.scheduleImmediateEndForNewSubscriber(subscription);

      return disposableFunction(() => {
        const index = this.#subscriptions.indexOf(subscription);
        if (index === -1) return;

        this.#subscriptions.splice(index, 1);
        this.notifyDemandChanged('unsubscribe', receiver);

        subscription.unsubscribed = true;
        if (isDefined(receiver.unsubscribed)) receiver.unsubscribed(...refArgs);

        this.__decrementDemand();
      });
    }

    #hold = 0;
    hold () {
      if (this.#hold++ === 0) {
        let sub: Subscription<TEventArgs, any>;
        for (let i = 0; i < this.#subscriptions.length; i++) {
          sub = this.#subscriptions[i];
          if (isDefined(sub.receiver.hold)) sub.receiver.hold(...sub.refArgs);
        }
      }
    }

    release () {
      if (this.#hold === 0) {
        throw new Error(`Unexpected call to 'Subscribable.Controller.release' while no HOLD state is in effect.`);
      }
      if (--this.#hold === 0) {
        let sub: Subscription<TEventArgs, any>;
        for (let i = 0; i < this.#subscriptions.length; i++) {
          sub = this.#subscriptions[i];
          if (isDefined(sub.receiver.release)) sub.receiver.release(...sub.refArgs);
        }
      }
    }

    /**
     * Dispatches the specified event arguments to all active subscribers. An error will be thrown the `end` method has
     * been called previously. The `isEnded` property can be checked to determine if this is the case.
     */
    event (...eventArgs: TEventArgs) {
      if (this.isEnded) throw new Error(`Cannot emit events after an 'end' signal has been dispatched. Check the 'isEnded' property if unsure.`);

      let sub: Subscription<TEventArgs, any>;
      for (let i = 0; i < this.#subscriptions.length; i++) {
        sub = this.#subscriptions[i];
        sub.receiver.event(...eventArgs, ...sub.refArgs);
      }
    }

    /**
     * Signals that no further 'event' signals will be ever be dispatched to subscribers beyond this point. Future calls
     * to `end` will be disregarded.
     *
     * Note that new subscriptions are still possible after this point and all demand-related events sent to the
     * controller's owner will continue to be emitted as normal, potentially leading to redundant work being done if the
     * demand event handler implementation does not track whether the `end` has been called previously (the `isEnded`
     * property is a way of checking this if it's not being tracked elsewhere). Aside from this, the only difference in
     * intrinsic behaviour after calling `end` is that new subscribers will be immediately sent an 'end' event in the
     * next tick after they subscribe, and further attempts to emit 'event' signals will cause an error to be thrown.
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
        if (!sub.unsubscribed) sub.receiver.end(...sub.refArgs);
      }
    }
  }
  export namespace Controller {
    export interface Auxiliary<TEventArgs extends unknown[]> extends Omit<Controller<TEventArgs>, 'subscribe' | 'event' | 'end'> {}
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
      onSubscribe? (controller: Controller<TEventArgs>, receiver: Receiver<TEventArgs, unknown[]>): void;
      onUnsubscribe? (controller: Controller<TEventArgs>, receiver: Receiver<TEventArgs, unknown[]>): void;
    }
  }

  export type Subscriber<TEventArgs extends unknown[], TRefArgs extends any[] = []> = Receiver<TEventArgs, TRefArgs> | Receiver<TEventArgs, TRefArgs>['event'];
  export interface Receiver<TEventArgs extends unknown[], TRefArgs extends any[] = []> {
    /**
     * Signal: An upstream source that has authority to dispatch signals to the receiver has established a HOLD state.
     * @remarks
     * A HOLD state indicates that a synchronous operation has commenced upstream from the receiver, such that there is
     * a chance that work done during the operation may result in the receiver being signalled multiple times in the
     * same synchronous execution cycle.
     *
     * Note that if a receiver implements a `hold` handler, it MUST also implement a `release` handler. Implementing
     * a `hold` handler without a corresponding `release` handler will likely result in erroneous behaviour.
     *
     * When a `hold` signal is received, the receiver is encouraged to do the following:
     *
     * - Keep a reference count of the number `hold` signals it has received.
     *   - Note that even if a receiver is only subscribed to a single upstream source, it should not assume that there
     *     is only one upstream source with authority to directly signal the receiver. Sometimes an upstream source may
     *     internally share references to its subscribers as part of its implementation, leading to a possibility of
     *     multiple upstream sources having authority to signal the receiver. As such, always keep a reference count
     *     even if only subscribing the receiver to a single source.
     * - If this `hold` signal establishes a reference count of 1 (i.e. start of a new upstream operation), the receiver
     *   should immediately forward a `hold` signal to any downstream receivers. The entire downstream graph should be
     *   aware that an operation has begun so as to avoid propagating to descendants redundant signals that will likely
     *   be immediately superseded in the same execution cycle once the upstream operation completes.
     * - While the HOLD state remains in effect, the receiver should:
     *   - minimise any work it does
     *   - avoid propagating any further signals downstream
     * - For each `release` signal received, the receiver should decrement its reference count.
     * - When the reference count reaches zero, the receiver should consider the upstream operation to have completed:
     *   - Any buffered event data and other signals recorded should be processed as a batch.
     *   - If appropriate, dispatch a single `event` signal downstream.
     *   - Finally, if any `end` or `unsubscribed` signals were received while the HOLD state was in effect, they should be
     *     propagated downstream (in that order).
     *
     * See the {@link SignalStatus} helper class, which streamlines much of the above logic.
     */
    hold? (...args: TRefArgs): void;

    /**
     * Signal: An upstream source that has authority to dispatch signals to the receiver has released its HOLD state.
     * @remarks
     * See {@link hold} for full details on
     */
    release? (...args: TRefArgs): void;

    /**
      * Signal: The receiver is being notified that something occurred upstream from itself.
      *
      * @remarks
      * The receiver should process the event. Though not mandatory, if a HOLD state is currently in effect, the
      * receiver is encouraged to wait until a `release` signal is received before propagating further signals
      * downstream.
      */
    event (...refArgs: [...TEventArgs, ...TRefArgs]): void;

    /**
     * Signal: No further `event` signals will ever be received. The subscription is still active nonetheless.
     * @remarks
     * Note that it is never guaranteed that an `end` event will be received. Dispatch of an `end` event is at the
     * discretion of the source's implementer.
     */
    end? (...args: TRefArgs): void;

    /**
     * Signal: The receiver is no longer subscribed. Work should cease and state should be cleaned up.
     * @remarks
     * Indicates that the subscription with which the receiver is associated has been disposed by the subscriber. No
     * further events will be dispatched to the receiver. Any current state or subcontextual work being maintained as
     * part of the receiver's lifecycle should be cleaned up and any associated subprocesses terminated/aborted
     * accordingly.
     *
     * The 'unsubscribed' signal is a quality-of-life convenience that provides implementers with a way to automatically
     * clean up references that are isolated to the scope of execution of the receiver, eliminating the need to manually
     * expose those internal references to the subscribing process purely for cleanup purposes when the subscription is
     * disposed. In short, it's usually better to let a receiver clean up its own state up rather than deferring that
     * responsibility to external code.
     *
     * Note that unlike the 'end' signal, the 'unsubscribed' signal is non-optional for well-behaving implementations of
     * the `Subscribable` interface:
     *
     * - When a subscription with which a receiver is associated is terminated, if the receiver implements
     *   `unsubscribed`, it must be signalled accordingly.
     * - If the source implementing `Subscribable` also implements some form of destruction mechanism (such as
     *   `Disposable`) and that mechanism is invoked, all actively subscribed receivers that implement `unsubscribed`
     *   must be signalled immediately.
     */
    unsubscribed? (...args: TRefArgs): void;
  }

  interface Subscription<TEventArgs extends unknown[], TRefArgs extends any[] = []> {
    readonly receiver: Receiver<TEventArgs, TRefArgs>;
    readonly refArgs: TRefArgs;
    unsubscribed: boolean;
  }
  interface EndableSubscription<TEventArgs extends unknown[], TRefArgs extends any[] = []> extends Subscription<TEventArgs, TRefArgs> {
    readonly receiver: SomeRequired<Receiver<TEventArgs, TRefArgs>, 'end'>;
  }
  const isEndableSubscription = (sub: Subscription<any, any>): sub is EndableSubscription<any, any> => isDefined(sub.receiver.end);

  /**
   * A helper class that makes it easier for receivers to implement support for the various optional signal types that
   * the `Subscribable.Receiver` interface defines.
   * @remarks
   * @see [subscribable.examples.ts](./subscribable.examples.ts)
   */
  export class SignalStatus<TEventArgs extends unknown[] = unknown[]> {
    #holdCount = 0;
    #isEnded = false;
    #isUnsubscribed = false;
    #events?: { buffer: TEventArgs[]; flushed: 0; flushing: boolean };

    private get _events () { return this.#events ??= { buffer: [], flushed: 0, flushing: false }; }

    get holdCount () { return this.#holdCount; }
    get isOnHold () { return this.#holdCount > 0; }
    get isEnded () { return this.#isEnded; }
    get isUnsubscribed () { return this.#isUnsubscribed; }
    get hasBufferedEvents () { return this._events.buffer.length > 0; }
    get bufferedEventCount () { return this._events.buffer.length; }
    get isFlushing () { return this._events.flushing; }

    /**
     * Increments the reference counter for the current HOLD state.
     * @returns
     *   - `true` if this is this call establishes a new HOLD state
     *   - `false` if the call is joining an existing HOLD state
     */
    initiateHold (): boolean {
      return ++this.#holdCount === 1;
    }

    /**
     * Decrements the reference counter for the current HOLD state.
     * @returns
     *  - `true` if this call ends the overall HOLD state
     *  - `false` if the HOLD state remains in effect
     */
    releaseHold (): boolean {
      if (this.#holdCount === 0) {
        throw new Error(`Unexpected call to 'Subscribable.SignalStatus.releaseHold' while no HOLD state is in effect.`);
      }
      return --this.#holdCount === 0;
    }

    /**
     *
     */
    holdEvent (...eventArgs: TEventArgs): void {
      if (this.#isEnded || this.#isUnsubscribed) return;
      this._events.buffer.push(eventArgs);
    }

    /**
     * Records the receipt of an 'end' signal.
     */
    holdEnd () {
      this.#isEnded = true;
    }

    /**
     * Records the receipt of an 'unsubscribed' signal.
     */
    holdUnsubscribed () {
      this.#isUnsubscribed = true;
    }

    /**
     * Drains any buffered events that have been recorded since the last call to this method.
     * @remarks
     * - If called while another `flush` operation is in progress, no events will be yielded by this call. This does not
     *   necessarily provide a guarantee that all events will be yielded to the original caller (i.e. they could stop
     *   iterating before reaching the end of the buffer), only that there will not be two callers flushing events from
     *   the buffer at the same time.
     * - If the caller stops iterating before all buffered events have been yielded, any remaining events that have not
     *   yet been yielded will be retained at the head of the buffer and made available to the next `flush` operation.
     * - If an event processed during a `flush` operation results in a cyclic (downstream-to-upstream) execution path
     *   that leads back to an interjecting call to `holdEvent` on this `SignalStatus` instance, the event will be
     *   appended to the existing buffer and will be yielded as part of the current `flush` operation, after all
     *   existing buffered events have been yielded.
     */
    *flush (): Generator<TEventArgs> {
      const events = this.#events;
      if (!events || events.flushing) return;
      try {
        events.flushing = true;
        while (events.flushed < events.buffer.length) {
          yield events.buffer[events.flushed++];
        }
      }
      finally { // <-- Ensure that the operation is concluded properly even if the caller exits the iteration loop early
        if (events.flushed === events.buffer.length) {
          events.buffer.length = 0; // All events have been flushed, clear the array efficiently
        }
        else {
          events.buffer.splice(0, events.flushed); // Remove the flushed events from the buffer, leaving the unflushed ones intact
        }
        events.flushed = 0; // Reset the flushed index
        events.flushing = false;
      }
    }

    /**
     * Immediately detaches all events from the buffer and resets the buffer to an empty state. The detached events are
     * returned as an array.
     * @remarks
     * This operation may be safely called while a `flush` operation is in progress. If that happens, the flush iterator
     * will skip any events that the `unbuffer` method returned.
     */
    unbuffer (): TEventArgs[] {
      const events = this._events;
      const buffer = events.buffer;
      events.buffer = [];
      events.flushed = 0;
      return buffer;
    }

    peekNextEvent (): TEventArgs | undefined {
      const events = this.#events;
      if (events) return firstElement(events.buffer);
    }
  }

  /**
   * SharedDemandListener is a reference-counted demand listener intended for scenarios where, for a given set of
   * closely related sources, whichever one of them comes online first should result in a single operation or process
   * managing whatever state the sources rely on collectively. An example is a pair of independent mouse coordinate
   * sources; one for 'x' and one for 'y'. If either source comes online, the implementation would need to set up a
   * 'mousemove' DOM event listener. Efficiency dictates that both 'x' and 'y' values would be being recorded for each
   * mousemove event received by the DOM event listener, even if only one of those values happens to be in demand.
   * Redundancy is avoided by having both sources share the same demand listener and sample the same state where the x
   * and y values are being recorded.
   */
  export class SharedDemandListener<TEventArgs extends unknown[]> implements DemandObserver.ListenerInterface<TEventArgs> {
    #refCount = 0;
    constructor (protected readonly handlers: { online (): void; offline (): void }) {}
    online () { if (this.#refCount++ === 0) this.handlers.online(); }
    offline () { if (--this.#refCount === 0) this.handlers.offline(); }
  }

  /**
   * A super convenient way to define on-demand subscribable sources that can then be constructed as needed.
   *
   * Example with a driver object with its own cleanup logic:
   * ```ts
   * const OnClickLocation = Subscribable.OnDemand({
   *   // We are in an OFFLINE state when there are no subscribers. When someone subscribes to an offline source, we
   *   // transition to an ONLINE state, at which point the `online` handler is called.
   *   online: (out: Subscribable.Controller<[x: number, y: number]>, element: HTMLElement) => {
   *     const listener = (event: MouseEvent) => out.event(event.clientX, event.clientY);
   *     element.addEventListener('mousemove', listener);
   *     // Whatever you return here will be passed to the `offline` handler when the source is no longer in demand:
   *     return listener;
   *   },
   *   // We are in an ONLINE state while there is at least one active subscriber. We transition back to an OFFLINE
   *   // state when the last active subscriber disposes their subscription, which triggers a call to the `offline`
   *   // handler, putting the source back in its original OFFLINE state, ready for a new subscriber to come along.
   *   offline: (listener: (event: MouseEvent) => void, element: HTMLElement) => {
   *     element.removeEventListener('mousemove', listener);
   *   }
   * });
   * const mySource = OnClickLocation(myElement);
   * mySource.subscribe((x, y) => { doSomethingWithCoordinates(x, y); });
   * ```
   *
   * Return a `Disposable` and it will be disposed automatically if no `offline` handler is provided:
   * ```ts
   * import { disposableFrom } from '@xf-common/general/disposables';
   * const OnSelectEntity = Subscribable.OnDemand({
   *   online: (out: Subscribable.Controller<[id: string]>, element: HTMLElement, id: string) => {
   *     const listener = () => out.event(id);
   *     element.addEventListener('click', listener);
   *     return disposableFrom(() => element.removeEventListener('click', listener));
   *   },
   * });
   * ```
   *
   * The implementation also supports returning an `AbortController` (again, omit the `offline` handler):
   * ```ts
   * const OnSelectEntity = Subscribable.OnDemand({
   *   online: (out: Subscribable.Controller<[id: string]>, element: HTMLElement, id: string) => {
   *     const abortController = new AbortController();
   *     element.addEventListener('click', listener = () => out.event(id), { signal: abortController.signal });
   *     return abortController;
   *   },
   * });
   * ```
   *
   * If there's no `offline` handler, you can optionally just pass a function that will be used as the `online` handler:
   * ```ts
   * const OnSelectEntity = Subscribable.OnDemand(
   *   (out: Subscribable.Controller<[id: string]>, context: DOMContext, id: string) => context.onClickOrTap(() => out.event(id))
   * );
   * ```
   *
   */
  export function OnDemand<TEventArgs extends unknown[], TSelfArgs extends unknown[]> (online: OnDemand.Driver<TEventArgs, TSelfArgs, Disposable | AbortController>['online']): OnDemand<TEventArgs, TSelfArgs>;
  export function OnDemand<TEventArgs extends unknown[], TSelfArgs extends unknown[], TState> (driver: OnDemand.Driver<TEventArgs, TSelfArgs, TState>): OnDemand<TEventArgs, TSelfArgs>;
  export function OnDemand<TEventArgs extends unknown[], TSelfArgs extends unknown[], TState> (driver: OnDemand.Driver<TEventArgs, TSelfArgs, TState> | OnDemand.Driver<TEventArgs, TSelfArgs, TState>['online']): OnDemand<TEventArgs, TSelfArgs> {
    if (isFunction(driver)) driver = { online: driver };
    return (...args) => OnDemand.create(driver, ...args);
  }
  export type OnDemand<TEventArgs extends unknown[], TSelfArgs extends unknown[]> = (...args: TSelfArgs) => Subscribable<TEventArgs>;
  export namespace OnDemand {
    export function create<TEventArgs extends unknown[], TSelfArgs extends unknown[], TState> (driver: Driver<TEventArgs, TSelfArgs, TState>, ...args: TSelfArgs): Subscribable<TEventArgs> {
      return new Controller(new DemandObserver(driver, args));
    }
    export interface Driver<TEventArgs extends unknown[], TSelfArgs extends unknown[], TState> {
      online (out: Controller<TEventArgs>, ...args: TSelfArgs): TState;
      offline? (state: TState, ...args: TSelfArgs): void;
    }
    export const DemandObserver = class OnDemand_DemandObserver<TEventArgs extends unknown[], TSelfArgs extends unknown[], TState> implements DemandObserver.ListenerInterface<TEventArgs> {
      constructor (
        private readonly driver: Driver<TEventArgs, TSelfArgs, TState>,
        private readonly args: TSelfArgs,
      ) {}
      #state: TState | undefined;
      online (out: Controller<TEventArgs>) {
        this.#state = this.driver.online(out, ...this.args);
      }
      offline () {
        const driver = this.driver;
        if (isDefined(driver.offline)) {
          driver.offline(this.#state!, ...this.args);
        }
        else if (this.#state instanceof AbortController) {
          this.#state.abort();
        }
        else if (isDisposable(this.#state)) {
          dispose(this.#state);
        }
        else if (isLegacyDisposable(this.#state)) {
          this.#state.dispose();
        }
        this.#state = undefined;
      }
    };
  }
}
