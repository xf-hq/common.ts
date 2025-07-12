export namespace Persistence {
  export interface Serializer<TData, TSerialized> {
    serialize (data: TData): TSerialized;
    deserialize (serialized: TSerialized): TData;
  }

  export interface EventType<TEventData, TChangeData, TStagingArgs extends any[] = any[]> {
    readonly typeId: string;
    /**
     * Returns data representing _what was observed_, NOT what was (or which might be) changed in response.
     */
    createData (changes: Change<TChangeData>[], ...args: TStagingArgs): TEventData;
  }

  export class Event<TEventData, TChangeData> {
    constructor (
      public readonly type: EventType<TEventData, TChangeData, any[]>,
      public readonly header: Event.Header,
      public readonly changes: Change<TChangeData>[],
      private readonly _stagingArgs: any[],
    ) {}
    #data?: TEventData;

    get data (): TEventData {
      return this.#data ??= this.type.createData(this.changes, ...this._stagingArgs);
    }
  }
  export namespace Event {
    export interface Header {
      readonly timestamp: number;
    }
  }

  export interface ChangeType<TChangeData, TStaged, TStagingArgs extends any[]> {
    readonly typeId: string;
    /**
     * Initializes and returns a stateful representation of the change, to be updated once it has been applied.
     */
    stage (...args: TStagingArgs): TStaged;
    /**
     * Staged changes should be applied idempotently to the target. `true` should be returned the first time this is
     * called for a given `state` reference, then `false` for subsequent calls receiving the same `state` object. The
     * fact that the change has been applied should be recorded in the `state` object.
     * @returns true if the intended target was updated, otherwise false.
     */
    applyIdempotent (state: TStaged): boolean;
    /**
     * In general this will be called _after_ the change has been applied to the target. The data returned should
     * describe the particulars of the change.
     */
    createData (state: TStaged): TChangeData;
  }

  export class Change<TChangeData, TStaged = any> {
    constructor (
      public readonly type: ChangeType<TChangeData, TStaged, any[]>,
      private readonly _state: TStaged,
    ) {}
    #changeData?: TChangeData;

    get data (): TChangeData { return this.#changeData ??= this.type.createData(this._state); }
  }
}
