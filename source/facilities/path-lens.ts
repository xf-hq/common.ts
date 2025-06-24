import { isUndefined } from '../general/type-checking';

interface PathFields {
  readonly path: string;
  readonly separator: string;
  readonly segments: SegmentFields[];
}
interface SegmentFields {
  readonly value: string;
  readonly path_i: number;
  pathToSegmentEnd?: string;
  pathFromSegmentStart?: string;
}

export class PathLens {
  static from (separator: string, path: string): PathLens {
    const segments: SegmentFields[] = [];
    let i_start = 0;
    if (path.length > 0) {
      let i_nextSeparator: number;
      let i_end: number;
      let done = false;
      do {
        i_nextSeparator = path.indexOf(separator, i_start);
        i_end = i_nextSeparator === -1 ? path.length : i_nextSeparator;
        if (i_start >= i_end) {
          done = true;
        }
        else {
          segments.push({
            path_i: i_start,
            value: path.substring(i_start, i_end),
          });
          i_start = i_nextSeparator === -1 ? i_end : i_nextSeparator + separator.length;
        }
      }
      while (!done);
    }
    return new PathLens({ path, separator, segments }, 0, null);
  }

  constructor (fields: PathFields, segments_i: number, previous: PathLens | null) {
    this.#fields = fields;
    this.#segments_i = segments_i;
    this.#previous = previous;
  }
  readonly #fields: PathFields;
  readonly #segments_i: number;
  readonly #previous: PathLens | null;

  get isEnd (): boolean {
    return this.#segments_i === this.#fields.segments.length;
  }
  get isLastSegment (): boolean {
    return this.#segments_i === this.#fields.segments.length - 1;
  }
  get isEmptySegment (): boolean {
    return this.#fields.segments[this.#segments_i].value.length === 0;
  }
  /**
   * Returns `true` if `next()` is able advance to a subsequent segment.
   */
  get hasSubsequentSegments (): boolean {
    return this.#segments_i < this.#fields.segments.length - 1;
  }
  /**
   * 0 if either `isLastSegment` or `isEnd` are `true`, otherwise the number of segments that follow the current segment.
   */
  get subsequentSegmentsCount (): number {
    return this.hasSubsequentSegments ? this.#fields.segments.length - this.#segments_i - 1 : 0;
  }
  /**
   * The number of segments that remain in the path, including the current segment.
   * Returns 0 if `isEnd` is `true`.
   */
  get remainingSegmentsCount (): number {
    return this.#fields.segments.length - this.#segments_i;
  }
  /**
   * The index of the current segment in the segments array, or -1 if the end of the path has already been reached.
   */
  get segmentOrdinal (): number {
    if (this.isEnd) return -1;
    return this.#segments_i;
  }
  /**
   * The index of the next segment in the segments array, or -1 if there are no more segments.
   */
  get nextSegmentOrdinal (): number {
    if (this.isEnd) return -1;
    return this.#segments_i + 1;
  }
  /**
   * The full path that this segment is a part of.
   */
  get fullPath (): string {
    return this.#fields.path;
  }
  get pathToSegmentStart (): string {
    return this.#previous?.pathToSegmentEnd ?? '';
  }
  get pathToSegmentEnd (): string {
    if (this.isLastSegment) return this.fullPath;
    const segment = this.#fields.segments[this.#segments_i];
    if (isUndefined(segment.pathToSegmentEnd)) {
      segment.pathToSegmentEnd = this.#fields.path.substring(0, segment.path_i + segment.value.length);
    }
    return segment.pathToSegmentEnd;
  }
  get pathFromSegmentStart (): string {
    if (this.isEnd) return '';
    if (this.isLastSegment) return this.fullPath;
    const segment = this.#fields.segments[this.#segments_i];
    if (isUndefined(segment.pathFromSegmentStart)) {
      segment.pathFromSegmentStart = this.#fields.path.substring(segment.path_i);
    }
    return segment.pathFromSegmentStart;
  }
  get pathFromSegmentEnd (): string {
    if (!this.hasSubsequentSegments) return '';
    return this.nextSegment.pathFromSegmentStart;
  }
  get segmentValue (): string {
    if (this.isEnd) return '';
    return this.#fields.segments[this.#segments_i].value;
  }

  get previousSegment (): PathLens | null {
    return this.#previous;
  }
  #next?: PathLens;
  get nextSegment (): PathLens {
    return this.#next ??= this.isEnd ? this : new PathLens(this.#fields, this.#segments_i + 1, this);
  }
}
