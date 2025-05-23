import { isArray, isString } from '../../general/type-checking';

export namespace TemplateLiteral {
  export function isTemplateStringsArray (value: any): value is TemplateStringsArray {
    return isArray(value) && arrayIsTemplateStringsArray(value);
  }
  export function arrayIsTemplateStringsArray (array: ArrayLike<any>): array is TemplateStringsArray {
    return 'raw' in array && Array.isArray(array.raw);
  }

  export function maybeStaticJoin (strings: string | TemplateStringsArray, tokens?: unknown[]): string {
    if (isString(strings)) return strings;
    return staticJoin(strings, tokens ?? []);
  }

  export function staticJoin (strings: TemplateStringsArray, tokens: unknown[]): string {
    const segments: string[] = [];
    for (let i = 0; i < strings.length; ++i) {
      segments.push(strings[i]);
      if (i < tokens.length) segments.push(String(tokens[i]));
    }
    return segments.join('');
  }

  export type Factory<T> = (strings: TemplateStringsArray, ...tokens: unknown[]) => T;
  export function Factory<SPECIAL_TOKEN, SPECIAL_SEGMENT, FINAL_OUTPUT> ({
    isSpecialToken = (a: unknown): a is SPECIAL_TOKEN => true,
    resolveSpecialToken,
    isSpecialSegment = (a: unknown): a is SPECIAL_SEGMENT => !isString(a),
    finalizeStaticString,
    finalizeSegmentsArray,
    finalizeSpecialSegment = (a: SPECIAL_SEGMENT) => finalizeSegmentsArray([a]),
  }: Factory.Config<SPECIAL_TOKEN, SPECIAL_SEGMENT, FINAL_OUTPUT>): Factory<FINAL_OUTPUT> {
    return (strings: TemplateStringsArray, ...tokens: unknown[]) => {
      const segments: (string | SPECIAL_SEGMENT)[] = [];
      if (strings[0].length > 0) segments.push(strings[0]);
      let tailIndex = 0;
      for (let i = 0; i < tokens.length; ++i) {
        const token = tokens[i];
        let segment: SPECIAL_SEGMENT | string;
        outer: {
          if (isSpecialToken(token)) {
            segment = resolveSpecialToken(token/* , indent */);
            if (isSpecialSegment(segment)) {
              segments.push(segment);
              tailIndex = -1;
              break outer;
            }
          }
          else {
            segment = String(token);
          }
          tailIndex = Factory.appendString(segment, segments, tailIndex);
        }
        tailIndex = Factory.appendString(strings[i + 1], segments, tailIndex);
      }
      if (segments.length === 1) {
        const segment0 = segments[0];
        return isSpecialSegment(segment0) ? finalizeSpecialSegment(segment0) : finalizeStaticString(segment0);
      }
      return finalizeSegmentsArray(segments);
    };
  }
  export namespace Factory {
    /**
     * @template SPECIAL_TOKEN Tokens that require special handling. Other token types will be converted to strings automatically.
     * @template SPECIAL_SEGMENT Final non-static segments mapped from special tokens, forming part of the final output's composition.
     * @template FINAL_OUTPUT The final runtime string-representative object that the overall templating operation should produce.
     *
     * NOTE: The three `finalize*` methods are mutually exclusive. Only one is called to produce the final output.
     */
    export interface Config<SPECIAL_TOKEN, SPECIAL_SEGMENT, FINAL_OUTPUT> {
      /**
       * While processing the raw token list, this tells us whether or not we want to process the token
       * manually.
       *
       * OPTIONAL. If omitted, all tokens are treated as special tokens.
       */
      isSpecialToken?: (value: any) => value is SPECIAL_TOKEN;
      /**
       * If `isSpecialToken` returned `true`, this is what will be used to process the token, and will return either (a)
       * the token converted to a finalized string that will be appended as a static segment within the final string, or
       * (b) returns a "special segment", which is a segment our custom implementation will deal with itself.
       */
      resolveSpecialToken: (token: any) => SPECIAL_SEGMENT | string;
      /**
       * The `isSpecialSegment` function lets the `Factory` implementation identify which of those values
       * returned by `resolveSpecialToken` are to be treated as special segments to be included in the final output's
       * composition.
       *
       * OPTIONAL. If omitted, all non-string values returned by `resolveSpecialToken` will be treated as special.
       */
      isSpecialSegment?: (value: unknown) => value is SPECIAL_SEGMENT;
      /**
       * Called only if a final static string was able to be produced with no special segments. This should return the
       * runtime's equivalent of a static string with no dynamic behaviour.
       */
      finalizeStaticString: (string: string) => FINAL_OUTPUT;
      /**
       * Called only if a final string with at least one special segment was produced. The array contains strings
       * interspersed with special segments. A final object representing the runtime's equivalent of a dynamic string
       * (whatever "dynamic" means in this context) should be returned.
       */
      finalizeSegmentsArray: (segments: (string | SPECIAL_SEGMENT)[]) => FINAL_OUTPUT;
      /**
       * Called only if the final array of internal segments contains exactly one special segment and no static segments.
       * This is useful when a special segment is of the same form as the final output, allowing it to be returned
       * directly.
       *
       * OPTIONAL. `finalizeSpecialSegment` is an optional convenience to allow `finalizeSegmentsArray` to skip having to
       * check whether the array contains exactly one special segment.
       */
      finalizeSpecialSegment: (segment: SPECIAL_SEGMENT) => FINAL_OUTPUT;
    }
    export function appendString<SPECIAL_SEGMENT> (string: string, segments: (string | SPECIAL_SEGMENT)[], tailIndex: number) {
      if (string.length > 0) {
        if (tailIndex === -1 || segments.length === 0) {
          tailIndex = segments.length;
          segments.push(string);
        }
        else {
          segments[tailIndex] = segments[tailIndex] + string;
        }
      }
      return tailIndex;
    }
  }
}
