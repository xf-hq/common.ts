import type { AssociativeRecordSource } from './associative-record-source';

namespace AssociativeRecordSourceExample {
  interface State {
    sum: number;
    readonly __record: Readonly<Record<string, number>>;
  }

  export function consumeAssociativeRecordSource (source: AssociativeRecordSource<number>) {
    const state: State = {
      sum: 0,
      // Use of a getter here provides the handler function with access to the current record data, which we normally
      // require access to the subscription instance to get.
      get __record () { return sub.__record; },
    };
    // Passing the state object as a tail argument means that it will be passed to our handler function every time
    // the record changes. This means we can define the handler function ahead of time and avoid closures around the
    // state object.
    const sub: AssociativeRecordSource.Subscription<number> = source.subscribe(onRecordChanged, state);

    // Calculate initial sum from all values
    for (const key in sub.__record) {
      state.sum += sub.__record[key];
    }

    // We'll sample record state every 1000 milliseconds
    setInterval(() => {
      // The subscription always provides access to the current value of the source
      console.log(`[${Date.now()}] The current sum is ${state.sum} (total keys: ${Object.keys(sub.__record).length})`);
    }, 1000);
  }

  function onRecordChanged (event: AssociativeRecordSource.Event<number>, state: State) {
    switch (event.kind) {
      case 'set': {
        for (const key in event.changes) {
          const value = event.changes[key];
          state.sum += value;
        }
        break;
      }
      case 'delete': {
        const value = state.__record[event.key];
        state.sum -= value;
        break;
      }
      case 'clear': {
        state.sum = 0;
        break;
      }
    }
  }
}
