import { dispose } from '../../../general/disposables';
import { Subscribable } from '../../core/subscribable';
import type { ValueSource } from './value-source';

namespace ValueSourceExample {
  interface State {
    readonly subscription: ValueSource.Subscription<number>;
    sum: number;
  }
  export function consumeValueSource (source: ValueSource<number>) {
    // Making the state an object allows us to pass it by reference to the event handler, where it can be updated.
    const state: Writable<State> = {
      subscription: undefined!, // We'll assign this in a moment
      sum: 0,
    };
    // The subscription always provides access to the current value. There are two ways to get access to the
    // subscription object. It is first passed to the callback we pass to `subscribe`, and it is also returned by
    // `subscribe`. It is
    const sub = source.subscribe(initializeSubscription, state);
    // We'll sample the current value every 1000 milliseconds
    setInterval(() => {
      // The subscription always provides access to the current value
      console.log(`[${Date.now()}] Current value: ${sub.value}`);
    }, 1000);
    setTimeout(() => {
      // After 30 seconds we'll dispose the subscription, which will shut down it down and prevent further signals.
      dispose(sub);
    }, 30000);
  }

  function initializeSubscription (subscription: ValueSource.Subscription<number>, state: Writable<State>): Subscribable.Subscriber<[value: number], [state: State]> {
    // The subscription object provides a view of the current value and whether or not the source's state has been
    // finalized (i.e. will never change again).
    state.subscription = subscription;
    state.sum = subscription.value;
    return onValueChanged;
  }

  function onValueChanged (value: number, state: State) {
    state.sum += value;
    console.log(`The value of the source is now: ${value} (sum of all values so far: ${state.sum})`);
    if (state.subscription.isFinalized) {
      console.log(`The source has been finalized - no more changes will occur`);
    }
  }
}
