import { Subscribable } from '../../core';
import { ValueSource } from './value-source';

namespace ValueSourceSubscriptionExample {
  export function run (abortSignal: AbortSignal, upstreamSource: ValueSource<number>) {
    // The abortSignal lets the source automatically handle all necessary cleanup when the subscription is no longer
    // needed. So all we need to do here is subscribe - "fire and forget", so to speak.
    ValueSource.subscribe(abortSignal, upstreamSource, new FooReceiver());
  }

  // This example doesn't implement a constructor, but doing so is pretty common, seeing as we usually have to either
  // supply a downstream receiver reference, or a manual source (all of the source types in this library have an
  // associated `Manual` type constructed with a `create` function - `ValueSource.create(x)` in this case) that we're
  // going to be forwarding changes to, or perhaps some other kind of state, e.g. DOM elements that we're supposed to be
  // maintaining in reflection of the data we're observing in the upstream source.
  class FooReceiver implements ValueSource.Receiver<number> {
    // Be sure to study the implementation of `Subscribable.SignalStatus` to understand its purpose and how it is used.
    readonly #status = new Subscribable.SignalStatus<[value: number]>();

    // This is always called by the system the moment the subscription is created. No other method will be called before
    // this one, so we should read the current state of whatever we've subscribed to and make sure we're in a state that
    // reflects whatever we'd normally be doing in response to future events, which conceptually are just
    // representations of changes in the upostream state.
    init (sub: ValueSource.Subscription<number>): void {
      this._updateValue(sub.value);
    }

    // This indicates that an upstream source wants us to hold off on doing any work or forwarding events downstream
    // until it has finished its current operation. It may send us multiple events during this time. We should collect
    // those events and process them after the hold is released, or we could process them locally as they are received,
    // applying them to some kind of intermediate/aggregate state, and then process that state more efficiently when the
    // hold is released. In this example, we use the `holdEvent` feature of `SignalStatus` to just collect the events
    // and process them all at once when the hold is released. Note that some receivers may have more than one upstream
    // source, which is why `initiateHold` returns a boolean. Internally it keeps a reference count of how many times it
    // has been called. That way we can set up our hold state just for the first hold signal we receive. Others will
    // merely result in an incremented reference count, returning false and thus skipping the body of the `if` block.
    hold (): void {
      if (this.#status.initiateHold()) {
        // If there were any downstream receivers, we'd dispatch a 'hold' signal to them now.
        // this.#downstream.hold(); // <-- Just an illustrative example
      }
    }

    // Same deal as `hold`. `releaseHold` returns true if the reference count reaches zero. We also check
    // status.hasBufferedEvents to avoid redundantly setting up intermediate state if we'll never end up using it.
    release (): void {
      const status = this.#status;
      if (status.releaseHold() && status.hasBufferedEvents) {
        // When a ValueSource is held, it may send multiple values. We only care about the most recent one.
        const buffered = [...status.flush()];
        const [lastValue] = buffered[buffered.length - 1];
        this._updateValue(lastValue);
      }
      // If there were any downstream receivers, we'd dispatch a 'release' signal to them now.
      // this.#downstream.release(); // <-- Just an illustrative example
    }

    event (value: number): void {
      const status = this.#status;
      if (status.isOnHold) {
        // If the upstream source hasn't finished doing whatever it's doing, there's a chance we'll receive more values.
        // We'll buffer them and process the last one on release.
        return status.holdEvent(value);
      }
      // Event received from upstream is singular/isolated (not part of an operation - we weren't put into a hold state
      // before being sent this event), so we'll just go ahead and process it in isolation.
      this._updateValue(value);
    }

    private _updateValue (value: number): void {
      // In a real-world scenario, we would do something with the value here, like updating the DOM, writing to a
      // file, or making a network request. For this example, we'll just log it to the console.
      console.log(`The value is now: ${value}`);
    }
  }
}
