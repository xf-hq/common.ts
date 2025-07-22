const relativeTimeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

// Define time units and their duration in milliseconds.
// The order is important, from largest to smallest.
const TIME_UNITS: { unit: Intl.RelativeTimeFormatUnitSingular; ms: number }[] = [
  { unit: 'year', ms: 31536000000 }, // 365 * 24 * 60 * 60 * 1000
  { unit: 'month', ms: 2592000000 }, // 30 * 24 * 60 * 60 * 1000
  { unit: 'day', ms: 86400000 }, // 24 * 60 * 60 * 1000
  { unit: 'hour', ms: 3600000 }, // 60 * 60 * 1000
  { unit: 'minute', ms: 60000 }, // 60 * 1000
  { unit: 'second', ms: 1000 }, // 1000
];

/**
 * Returns phrases like "500ms ago", "1 minute ago", "2 hours ago", "3 days ago", etc.
 */
export function relativeTimePhrase (timestamp: number, now = Date.now()): string {
  const diffMs = timestamp - now;
  const absDiffMs = Math.abs(diffMs);

  // Handle sub-second differences manually, as Intl.RelativeTimeFormat
  // support for 'millisecond' is very recent (ES2024).
  if (absDiffMs < 1000) {
    return diffMs >= 0 ? `in ${absDiffMs}ms` : `${absDiffMs}ms ago`;
  }

  // Find the largest appropriate unit to represent the time difference.
  for (const { unit, ms } of TIME_UNITS) {
    if (absDiffMs >= ms) {
      const value = Math.round(diffMs / ms);
      return relativeTimeFormatter.format(value, unit);
    }
  }

  // This fallback should theoretically not be reached if absDiffMs >= 1000,
  // but it's good practice to have it.
  return relativeTimeFormatter.format(Math.round(diffMs / 1000), 'second');
}

export interface IntervalDescriptionComponents {
  readonly adjective: null | 'about' | 'over' | 'almost';
  readonly value: number;
  readonly unitOrUnits: IntervalDescriptionComponents.Unit;
  readonly unitSingular: IntervalDescriptionComponents.UnitSingular;
}
export namespace IntervalDescriptionComponents {
  export type UnitSingular = Intl.RelativeTimeFormatUnitSingular | 'millisecond';
  export type Unit = Intl.RelativeTimeFormatUnit | 'millisecond' | 'milliseconds';

  /**
   * Changes the singular form of the `unit` argument to its plural form.
   * @param unit The unit to pluralize.
   * @returns The plural form of the unit.
   */
  export function pluralizeUnit (unit: UnitSingular): Unit;
  /**
   * Changes the singular form of the `unit` argument to its plural form unless the `value` is 1, in which case it
   * returns the singular form unaltered.
   * @param unit The unit to pluralize.
   * @param value The value to check. Default is 0, which yields the plural form of the unit.
   */
  export function pluralizeUnit (unit: UnitSingular, value?: number): Unit;
  export function pluralizeUnit (unit: UnitSingular, value = 0): Unit {
    return value === 1 ? unit : `${unit}s` as Unit;
  }
}

function approximateIntervalPhraseComponents (durationMs: number): IntervalDescriptionComponents {
  // A negative duration is treated as its absolute value.
  const absDurationMs = Math.abs(durationMs);

  // Milliseconds are always exact.
  if (absDurationMs < 1000) {
    return {
      value: absDurationMs,
      unitSingular: 'millisecond',
      unitOrUnits: IntervalDescriptionComponents.pluralizeUnit('millisecond', absDurationMs),
      adjective: null,
    };
  }

  // Find the largest unit that the duration is greater than or equal to.
  let bestUnit: Intl.RelativeTimeFormatUnitSingular = 'second';
  let bestUnitMs = 1000;
  for (const unit of TIME_UNITS) {
    if (absDurationMs >= unit.ms) {
      bestUnit = unit.unit;
      bestUnitMs = unit.ms;
      break; // Exit after finding the largest appropriate unit.
    }
  }

  const exactValue = absDurationMs / bestUnitMs;
  const roundedValue = Math.round(exactValue);
  const floorValue = Math.floor(exactValue);

  // Rule 1: "No adjective" for values very close to a whole number.
  // e.g., 1h 58m or 2h 2m should both be "2 hours".
  // This is checked first as it takes precedence.
  if (roundedValue > 0 && Math.abs(exactValue - roundedValue) <= 0.05) {
    return {
      adjective: null,
      value: roundedValue,
      unitOrUnits: IntervalDescriptionComponents.pluralizeUnit(bestUnit, roundedValue),
      unitSingular: bestUnit,
    };
  }

  // Rule 2: Use "about", "over", or "almost" based on the fractional part.
  const fraction = exactValue - floorValue;

  // e.g., 2.1 hours -> "about 2 hours"
  if (fraction <= 0.15) return {
    adjective: 'about',
    value: floorValue,
    unitOrUnits: IntervalDescriptionComponents.pluralizeUnit(bestUnit, floorValue),
    unitSingular: bestUnit,
  };
  // e.g., 2.35 hours -> "over 2 hours"
  if (fraction < 0.85) return {
    adjective: 'over',
    value: floorValue,
    unitOrUnits: IntervalDescriptionComponents.pluralizeUnit(bestUnit, floorValue),
    unitSingular: bestUnit,
  };
  // e.g., 2.8 hours -> "almost 3 hours"
  return {
    adjective: 'almost',
    value: floorValue + 1,
    unitOrUnits: IntervalDescriptionComponents.pluralizeUnit(bestUnit, floorValue + 1),
    unitSingular: bestUnit,
  };
}

function _formatIntervalPhrase (components: IntervalDescriptionComponents): string {
  const suffix = components.unitSingular === 'millisecond' ? 'ms' : ' ' + components.unitOrUnits;
  return components.adjective ? `${components.adjective} ${components.value}${suffix}` : `${components.value}${suffix}`;
}

/**
 * (New) Formats a duration into a human-readable string based on specific rules.
 * @param durationMs The interval duration in milliseconds.
 * @returns A formatted string like "500ms", "about 2 hours", or "almost 1 year".
 */
export function approximateIntervalPhrase (durationMs: number): string {
  const components = approximateIntervalPhraseComponents(durationMs);
  return _formatIntervalPhrase(components);
}

/**
 * Same as `approximateIntervalPhrase`, but with " has" or " have" appended, depending one whether the
 * duration is singular or plural. Example: "about 1 hour has", "almost 19 minutes have".
 */
export function approximateIntervalPhraseWithHaveOrHas (durationMs: number): string {
  const phrase = approximateIntervalPhraseComponents(durationMs);
  return `${_formatIntervalPhrase(phrase)} ${phrase.value === 1 ? 'has' : 'have'}`;
}
