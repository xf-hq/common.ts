import { isAsync, type Async } from '../async/async';
import { isOnDemandAsync, type OnDemandAsync } from '../async/on-demand-async';
import type { ArrayData } from './arrays';
import type { AssociativeRecordData } from './associative-records';
import type { FixedRecordData } from './fixed-records';
import type { MapData } from './maps';
import type { SetData } from './sets';
import type { BooleanData, NumberData, StringData, ValueData } from './values';

export const isExplicitAsyncData = (value: any): value is AsyncData => isAsync(value) || isOnDemandAsync(value);

export type NotAsyncData =
  | ValueData.NotAsync<any>
  | StringData.NotAsync
  | NumberData.NotAsync
  | BooleanData.NotAsync
  | ArrayData.NotAsync<any>
  | MapData.NotAsync<any, any>
  | SetData.NotAsync<any>
  | FixedRecordData.NotAsync<any, any>
  | AssociativeRecordData.NotAsync<any>;

export type AsyncData<TNotAsync extends NotAsyncData = any> = Async<TNotAsync> | OnDemandAsync<TNotAsync>;
