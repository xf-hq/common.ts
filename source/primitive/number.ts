export function round (number: number): number {
  return (number + 0.5) << 0;
}

export function clamp (lbound: number, ubound: number, argument: number): number {
  return argument < lbound ? lbound : argument > ubound ? ubound : argument;
}

/**
 * @param lbound Inclusive lower bound
 * @param hbound Exclusive upper bound
 * @param value The value to wrap
 * @returns A number >= lbound and < hbound
 */
export function wrap (lbound: number, hbound: number, value: number): number {
  const size = hbound - lbound;
  const offset = value - lbound;
  return lbound + (offset % size + size) % size;
}


export function ifNaN (defaultValue: number, argument: number): number {
  return isNaN(argument) ? defaultValue : argument;
}
