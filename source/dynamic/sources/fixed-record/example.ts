import type { FixedRecordSource } from './fixed-record-source';

namespace FixedRecordSourceExample {
  interface TestRecord {
    count: number;
    name: string;
  }
  type NumberEvent = { /* Defining this event is an exercise left to the reader */ };
  type StringEvent = { /* Defining this event is an exercise left to the reader */ };
  interface TestRecordEvents {
    count: NumberEvent;
    name: StringEvent;
  }

  interface State {
    sum: number;
    readonly __record: Readonly<TestRecord>;
  }

  export function consumeFixedRecordSource (source: FixedRecordSource<TestRecord>) {
    const state: State = {
      sum: 0,
      get __record () { return sub.__record; },
    };
    const sub: FixedRecordSource.Subscription<TestRecord> = source.subscribe(onRecordChanged, state);

    state.sum = sub.__record.count;

    setInterval(() => {
      console.log(`[${Date.now()}] Count: ${state.sum}, Name: ${sub.__record.name}`);
    }, 1000);
  }

  function onRecordChanged (event: FixedRecordSource.Event<TestRecord, TestRecordEvents>, state: State) {
    switch (event.kind) {
      case 'set':
        if (event.values.count !== undefined) {
          state.sum = event.values.count;
        }
        break;
      case 'patch':
        // TODO: Implement patch handling based on however NumberEvent and StringEvent are defined.
        break;
      case 'batch':
        for (const subEvent of event.events) {
          onRecordChanged(subEvent, state);
        }
        break;
      default: {
        throw new Error(`Unsupported event kind: ${event}`);
      }
    }
  }
}
