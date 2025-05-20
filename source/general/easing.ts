/* CREDIT: https://github.com/streamich/ts-easing */

export type EasingFunction = (time: number) => number;

export interface EasingFunctions {
  /** No easing, no acceleration */
  linear: EasingFunction;
  /** Accelerates fast, then slows quickly towards end. */
  quadratic: EasingFunction;
  /** Overshoots over 1 and then returns to 1 towards end. */
  cubic: EasingFunction;
  /** Overshoots over 1 multiple times - wiggles around 1. */
  elastic: EasingFunction;
  /** Accelerating from zero velocity */
  inQuad: EasingFunction;
  /** Decelerating to zero velocity */
  outQuad: EasingFunction;
  /** Acceleration until halfway, then deceleration */
  inOutQuad: EasingFunction;
  /** Accelerating from zero velocity */
  inCubic: EasingFunction;
  /** Decelerating to zero velocity */
  outCubic: EasingFunction;
  /** Acceleration until halfway, then deceleration */
  inOutCubic: EasingFunction;
  /** Accelerating from zero velocity */
  inQuart: EasingFunction;
  /** Decelerating to zero velocity */
  outQuart: EasingFunction;
  /** Acceleration until halfway, then deceleration */
  inOutQuart: EasingFunction;
  /** Accelerating from zero velocity */
  inQuint: EasingFunction;
  /** Decelerating to zero velocity */
  outQuint: EasingFunction;
  /** Acceleration until halfway, then deceleration */
  inOutQuint: EasingFunction;
  /** Accelerating from zero velocity */
  inSine: EasingFunction;
  /** Decelerating to zero velocity */
  outSine: EasingFunction;
  /** Accelerating until halfway, then decelerating */
  inOutSine: EasingFunction;
  /** Exponential accelerating from zero velocity */
  inExpo: EasingFunction;
  /** Exponential decelerating to zero velocity */
  outExpo: EasingFunction;
  /** Exponential accelerating until halfway, then decelerating */
  inOutExpo: EasingFunction;
  /** Circular accelerating from zero velocity */
  inCirc: EasingFunction;
  /** Circular decelerating to zero velocity Moves VERY fast at the beginning and then quickly slows down in the middle.
   * This tween can actually be used in continuous transitions where target value changes all the time, because of the
   * very quick start, it hides the jitter between target value changes. */
  outCirc: EasingFunction;
  /** Circular acceleration until halfway, then deceleration */
  inOutCirc: EasingFunction;
}

export const Easing: EasingFunctions = {
  linear: (t) => t,
  quadratic: (t) => t * (-(t * t) * t + 4 * t * t - 6 * t + 4),
  cubic: (t) => t * (4 * t * t - 9 * t + 6),
  elastic: (t) => t * (33 * t * t * t * t - 106 * t * t * t + 126 * t * t - 67 * t + 15),
  inQuad: (t) => t * t,
  outQuad: (t) => t * (2 - t),
  inOutQuad: (t) => t < .5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  inCubic: (t) => t * t * t,
  outCubic: (t) => (--t) * t * t + 1,
  inOutCubic: (t) => t < .5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
  inQuart: (t) => t * t * t * t,
  outQuart: (t) => 1 - (--t) * t * t * t,
  inOutQuart: (t) => t < .5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t,
  inQuint: (t) => t * t * t * t * t,
  outQuint: (t) => 1 + (--t) * t * t * t * t,
  inOutQuint: (t) => t < .5 ? 16 * t * t * t * t * t : 1 + 16 * (--t) * t * t * t * t,
  inSine: (t) => -Math.cos(t * (Math.PI / 2)) + 1,
  outSine: (t) => Math.sin(t * (Math.PI / 2)),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  inExpo: (t) => Math.pow(2, 10 * (t - 1)),
  outExpo: (t) => -Math.pow(2, -10 * t) + 1,
  inOutExpo: (t) => {
    t /= .5;
    if (t < 1) return Math.pow(2, 10 * (t - 1)) / 2;
    t--;
    return (-Math.pow(2, -10 * t) + 2) / 2;
  },
  inCirc: (t) => -Math.sqrt(1 - t * t) + 1,
  outCirc: (t) => Math.sqrt(1 - (t = t - 1) * t),
  inOutCirc: (t) => {
    t /= .5;
    if (t < 1) return -(Math.sqrt(1 - t * t) - 1) / 2;
    t -= 2;
    return (Math.sqrt(1 - t * t) + 1) / 2;
  },
};
