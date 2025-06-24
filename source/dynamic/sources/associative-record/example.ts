import { Subscribable } from '../../core';
import { AssociativeRecordSource } from './associative-record-source';

namespace AssociativeRecordSourceSubscriptionExample {
  export function run (abortSignal: AbortSignal, upstreamSource: AssociativeRecordSource<number>) {
    // The abortSignal lets the source automatically handle all necessary cleanup when the subscription is no longer
    // needed. So all we need to do here is subscribe - "fire and forget", so to speak.
    AssociativeRecordSource.subscribe(abortSignal, upstreamSource, new FooReceiver());
  }

  // This example doesn't implement a constructor, but doing so is pretty common, seeing as we usually have to either
  // supply a downstream receiver reference, or a manual source (all of the source types in this library have an
  // associated `Manual` type constructed with a `create` function - `AssociativeRecordSource.create({ ... })` in this
  // case) that we're going to be forwarding changes to, or perhaps some other kind of state, e.g. DOM elements that
  // we're supposed to be maintaining in reflection of the data we're observing in the upstream source.
  class FooReceiver implements AssociativeRecordSource.Receiver<number> {
    // Be sure to study the implementation of `Subscribable.SignalStatus` to understand its purpose and how it is used.
    readonly #status = new Subscribable.SignalStatus<[event: AssociativeRecordSource.Event<number>]>();

    // This is always called by the system the moment the subscription is created. No other method will be called before
    // this one, so we should read the current state of whatever we've subscribed to and make sure we're in a state that
    // reflects whatever we'd normally be doing in response to future events, which conceptually are just
    // representations of changes in the upostream state.
    init (sub: AssociativeRecordSource.Subscription<number>): void {
      this._beginJob();
      for (const key in sub.__record) {
        this._add(key, sub.__record[key]);
      }
      this._commitJob();
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
        this._beginJob();
        // Unload any local events and try to do as much local work as possible to limit the need to spam external
        // state, downstream receivers, etc. For example, if
        for (const [event] of status.flush()) {
          this._applyEvent(event);
        }
        this._commitJob();
      }
      // If there were any downstream receivers, we'd dispatch a 'release' signal to them now.
      // this.#downstream.release(); // <-- Just an illustrative example
    }
    // This is a more complex example of how we might deal with handling multiple events in a single go. If the use case
    // is simpler, don't bother with any of this and just do the work in the event method directly. Use your best
    // judgment.

    event (event: AssociativeRecordSource.Event<number>): void {
      const status = this.#status;
      if (status.isOnHold) {
        // If the upstream source hasn't finished doing whatever it's doing, there's a chance we'll receive more events.
        return status.holdEvent(event);
      }
      // Event received from upstream is singular/isolated (not part of an operation - we weren't put into a hold state
      // before being sent this event), so we'll just go ahead and process it in isolation.
      this._beginJob();
      this._applyEvent(event);
      this._commitJob();
    }

    #someKindaTempState: unknown;
    private _beginJob (): void {
      // Initialize any temporary state that will be used to stage the events (only if applicable). Don't bother with
      // defining this method if it's not required.
    }
    private _applyEvent (event: AssociativeRecordSource.Event<number>): void {
      // Apply the events to temporary state, then when _commitJob is called, we should be able to do all the work in
      // one go (or at least in a minimal number of steps). For example:
      // - If we have downstream receivers, maybe we can emit only one event, or a smaller number of events than we
      //   received from the upstream source.
      // - If we're making updates to the DOM, we can write the changes to an intermediate location, then when
      //   _commitJob is called, we can apply all the changes in one go, which will minimize the number of reflows and
      //   repaints.
      if (event.add) {
        for (const key in event.add) {
          this._add(key, event.add[key]);
        }
      }
      if (event.change) {
        for (const key in event.change) {
          this._change(key, event.change[key]);
        }
      }
      if (event.delete) {
        for (const key of event.delete) {
          this._delete(key);
        }
      }
    }
    private _add (key: string, value: number): void {
      // Apply the value to state, allocate resources, etc.
    }
    private _change (key: string, value: number): void {
      // Update existing state, maybe clean up the old thing if applicable, etc.
    }
    private _delete (key: string): void {
      // Remove the value from state, do cleanup, etc.
    }
    private _commitJob (): void {
      // Do the actual work here, using the temporary state that was built up in _event. Then clear the temporary state.
      // This is the point where, if we have downstream receivers, we'd dispatch an event to them (or multiple events if
      // we absolutely can't squish what we did into a single event).
    }
  }
}
