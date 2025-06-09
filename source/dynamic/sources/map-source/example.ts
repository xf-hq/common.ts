import { MapSource } from './map-source';

namespace MapSourceExample {
  interface State {
    sum: number;
    readonly deltas: number[];
    readonly __map: ReadonlyMap<string, number>;
  }

  export function consumeMapSource (source: MapSource<string, number>) {
    const state: State = {
      sum: 0,
      deltas: [],
      get __map () { return sub.__map; },
    };
    const sub: MapSource.Subscription<string, number> = source.subscribe(onMapChanged, state);
    state.sum = [...sub.__map.values()].reduce((a, b) => a + b, 0);

    // We'll sample map state every 1000 milliseconds
    setInterval(() => {
      // The subscription always provides access to the current value of the source
      console.log(`[${Date.now()}] The current sum is ${state.sum} (total values summed: ${sub.__map.size})`);
    }, 1000);
  }
  function onMapChanged (event: MapSource.Event<string, number>, state: State) {
    if (event.add) {
      for (const [key, value] of event.add) {
        state.sum += value;
        state.deltas.push(value);
      }
    }
    
    if (event.change) {
      for (const [key, newValue] of event.change) {
        const oldValue = state.__map.get(key);
        if (oldValue !== undefined) {
          state.sum -= oldValue;
          state.deltas.push(-oldValue);
        }
        state.sum += newValue;
        state.deltas.push(newValue);
      }
    }
    
    if (event.delete) {
      for (const key of event.delete) {
        const oldValue = state.__map.get(key);
        if (oldValue !== undefined) {
          state.sum -= oldValue;
          state.deltas.push(-oldValue);
        }
      }
    }
  }
}
