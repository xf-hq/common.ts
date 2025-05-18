import { isNonNegativeInteger } from './type-checking';

export function assertArgumentIsNonNegativeInteger (value: number, name?: string): void {
  if (!isNonNegativeInteger(value)) {
    throw new TypeError(`Argument${name ? ` '${name}'` : ''} must be a non-negative integer (got <${value}>)`);
  }
}
