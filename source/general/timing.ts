import { FailSafe } from './failsafe';
import { isDefined, isNumber, isUndefined } from './type-checking';

export type TimerHandle = ReturnType<typeof setTimeout>;

/** Returns a promise that resolves after the specified duration (in milliseconds) has elapsed. */
export const delay = async (duration: number) => new Promise<void>(resolve => FailSafe.setTimeout(resolve, duration));

/** Returns a function that does not execute until the specified interval (in milliseconds) has elapsed without having
 * made any subsequent calls to the same function inside that same time interval. If the returned function continues to
 * be called in rapid succession, the debounced function will never end up executing. The specified interval must be
 * allowed to elapse before the debounced function can execute.
 *
 * Note that only the arguments for the most recent call are used when the debounced function finally resolves. Prior
 * arguments are discarded. */
export function debounce<A extends any[]> (f: (...args: A) => void, interval: number, capToInterval?: boolean): (...args: A) => void;
export function debounce<A extends any[]> (f: (...args: A) => void, interval: number, maxDelay?: number): (...args: A) => void;
export function debounce<A extends any[]> (f: (...args: A) => void, interval: number, arg: boolean | number = false) {
  const maxDelay = isNumber(arg) ? arg : arg ? interval : 0;
  let timerHandle: TimerHandle | undefined;
  let argsToUse: A;
  let sessionStart = 0;
  function callback (): void {
    timerHandle = undefined;
    f(...argsToUse);
    argsToUse = undefined!;
    sessionStart = 0;
  }
  const cancel = () => {
    clearTimeout(timerHandle);
    timerHandle = undefined;
    argsToUse = undefined!;
    sessionStart = 0;
  };
  const noop = () => {};
  return (...args: A) => {
    argsToUse = args;
    const now = Date.now();
    let intervalToUse = interval;
    if (isDefined(timerHandle)) {
      clearTimeout(timerHandle);
      if (maxDelay > interval) {
        if (now - sessionStart >= maxDelay) {
          callback();
          sessionStart = 0;
          return noop;
        }
        const timeUntilMaxDelay = maxDelay - (now - sessionStart);
        if (timeUntilMaxDelay < interval) {
          intervalToUse = timeUntilMaxDelay;
        }
      }
    }
    else {
      sessionStart = now;
    }
    timerHandle = FailSafe.setTimeout(callback, intervalToUse);
    return cancel;
  };
}

/** Returns a function that will not execute more frequently than the number of milliseconds specified by
 * `minIntervalBetweenCalls`. If the returned function is called too soon after a previous call, a timer is used to
 * schedule the call to resolve after the minimum interval has elapsed (assuming no such timer is already active for the
 * function).
 *
 * Note that this `throttle` implementation is a little better than a typical throttling function; in this
 * implementation the most recent call is always guaranteed to run (unless the timer is manually cancelled), and that
 * the most recent arguments passed to the returned function will always be used, even if the most recent call was
 * prevented by the throttling logic. */
export function throttle<A extends any[]> (f: (...args: A) => void, minIntervalBetweenCalls: number) {
  let timerHandle: TimerHandle | undefined, earliestTimestampAllowedForNextCall = 0;
  let argsToUse: A;
  function callback () {
    earliestTimestampAllowedForNextCall += minIntervalBetweenCalls;
    timerHandle = undefined;
    f(...argsToUse);
    argsToUse = undefined!;
  }
  const cancel = () => {
    clearTimeout(timerHandle);
    timerHandle = undefined;
    argsToUse = undefined!;
  };
  return (...args: A) => {
    argsToUse = args;
    if (isUndefined(timerHandle)) {
      const currentTimestamp = Date.now();
      if (currentTimestamp < earliestTimestampAllowedForNextCall) {
        timerHandle = FailSafe.setTimeout(callback, earliestTimestampAllowedForNextCall - currentTimestamp);
      }
      else {
        earliestTimestampAllowedForNextCall = currentTimestamp;
        FailSafe.emit(callback);
      }
    }
    return cancel;
  };
}
