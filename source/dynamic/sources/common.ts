import type { Subscribable } from '../core';

export function hasAnyDemand (...sources: { __emitter: Subscribable.Controller.Auxiliary<any> }[]): boolean {
  for (let i = 0; i < sources.length; ++i) {
    if (sources[i].__emitter.demandExists) return true;
  }
  return false;
}
