import { ArraySource } from './array-source';

namespace ArraySourceExample {
  interface State {
    sum: number;
    readonly deltas: number[];
    readonly __array: readonly number[];
  }

  export function consumeArraySource (source: ArraySource<number>) {
    const state: State = {
      sum: 0,
      deltas: [],
      get __array () { return sub.__array; },
    };
    const sub: ArraySource.Subscription<number> = source.subscribe(onArrayChanged, state);
    state.sum = sub.__array.reduce((sum, value) => sum + value, 0);

    // We'll sample array state every 1000 milliseconds
    setInterval(() => {
      // The subscription always provides read-only access to the raw array represented by the source
      console.log(`[${Date.now()}] The current sum is ${state.sum} (total values: ${sub.__array.length})`);
    }, 1000);
  }

  function onArrayChanged (event: ArraySource.Event<number>, state: State) {
    switch (event.kind) {
      case 'push': {
        event.values.forEach(value => state.sum += value);
        state.deltas.push(...event.values);
        break;
      }
      case 'pop': {
        const value = state.__array[state.__array.length - 1];
        state.sum -= value;
        state.deltas.push(-value);
        break;
      }
      case 'unshift': {
        event.values.forEach(value => state.sum += value);
        state.deltas.push(...event.values);
        break;
      }
      case 'shift': {
        const value = state.__array[0];
        state.sum -= value;
        state.deltas.push(-value);
        break;
      }
      case 'splice': {
        // Remove deleted values from sum
        for (let i = 0; i < event.deletions; i++) {
          const value = state.__array[event.index + i];
          state.sum -= value;
          state.deltas.push(-value);
        }
        // Add inserted values to sum
        for (const value of event.insertions) {
          state.sum += value;
          state.deltas.push(value);
        }
        break;
      }
      case 'set': {
        const { index, value } = event;
        const oldValue = state.__array[index];
        state.sum += value - oldValue;
        state.deltas.push(value - oldValue);
        break;
      }
      case 'batch': {
        for (const batchEvent of event.events) {
          onArrayChanged(batchEvent, state);
        }
        break;
      }
    }
  }
}
