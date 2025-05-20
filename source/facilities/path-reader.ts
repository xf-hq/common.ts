import { isDefined, isString, isUndefined } from '../general/type-checking';

export class PathReader {
  /** If the path is a string and no separator is specified, the separator will default to a colon (":") character. */
  static from (path: string | PathReader): PathReader;
  static from (separator: string, path: string | PathReader): PathReader;
  static from (path_or_separator: string | PathReader, path?: string | PathReader): PathReader {
    if (isUndefined(path_or_separator)) {
      throw new Error('PathReader.from() requires at least one argument.');
    }
    if (path_or_separator instanceof PathReader) return path_or_separator;
    if (path instanceof PathReader) return path;
    if (isDefined(path)) return new PathReader(path_or_separator, path);
    else return new PathReader(':', path_or_separator);
  }
  static maybeFrom = (separator: string, path: unknown): PathReader | undefined => path instanceof PathReader ? path : isString(path) ? new PathReader(separator, path) : undefined;

  constructor (separator: string, path: string) {
    this.#separator = separator;
    this.#fullPath = path;
    this.#read(0);
  }
  readonly #fullPath: string;
  readonly #separator: string;
  #currentSegmentOnly: string;
  #remainingPathFromCurrentIndex: string;
  #currentIndex = 0;

  #read (fromStringIndex: number) {
    const colon = this.#fullPath.indexOf(this.#separator, fromStringIndex);
    this.#remainingPathFromCurrentIndex = this.#fullPath.substring(fromStringIndex);
    if (colon === -1) {
      this.#currentSegmentOnly = this.#remainingPathFromCurrentIndex;
      this.#currentIndex = this.#fullPath.length;
    }
    else {
      this.#currentSegmentOnly = this.#fullPath.substring(fromStringIndex, colon);
      this.#currentIndex = colon + 1;
    }
  }

  get fullPath () { return this.#fullPath; }
  get currentIndex () { return this.#currentIndex; }
  get currentSegment () { return this.#currentSegmentOnly; }
  get currentPath () { return this.#remainingPathFromCurrentIndex; }
  get isLastSegment () { return this.#currentIndex === this.#fullPath.length; }
  get isEndOfString () { return this.#remainingPathFromCurrentIndex.length === 0; }

  advanceToNextSegment (): this {
    if (!this.isEndOfString) this.#read(this.#currentIndex);
    return this;
  }

  backtrackToPreviousSegment (): this {
    if (this.#currentIndex > 0) {
      const colon = this.#fullPath.lastIndexOf(this.#separator, this.#currentIndex - 1);
      this.#read(colon + 1);
    }
    return this;
  }

  rewindToFirstSegment (): this {
    this.#read(0);
    return this;
  }

  clone (): PathReader {
    const clone = new PathReader(this.#separator, this.#fullPath);
    clone.#currentSegmentOnly = this.#currentSegmentOnly;
    clone.#remainingPathFromCurrentIndex = this.#remainingPathFromCurrentIndex;
    clone.#currentIndex = this.#currentIndex;
    return clone;
  }

  cloneAndAdvance (): PathReader {
    const clone = this.clone();
    clone.advanceToNextSegment();
    return clone;
  }

  toString () { return this.#fullPath; }
  [Symbol.toPrimitive] () { return this.toString(); }
}
