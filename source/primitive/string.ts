import { anyDefined, isArray, isDefined, isString } from '../general/type-checking';
import { TemplateLiteral } from './template-literal';

export const firstChar = (s: Exclude<string, ''>) => s[0];
export const lastChar = (s: Exclude<string, ''>) => s[s.length - 1];
export const truncateStringTail = (s: string, tailCharsToRemove: number) => s.substring(0, s.length - tailCharsToRemove);
export const truncateStringWithEllipsis = (s: string, maxLength: number) => s.length <= maxLength ? s : s.substring(0, maxLength) + '…';
/** If longer than `maxLength`, this function collapses the string so that it retains only the start and end of the
 * original string. Excess characters in the middle of the string are replaced with an ellipsis character. */
export function collapseStringWithEllipsis (s: string, maxLength: number): string {
  if (s.length <= maxLength) return s;
  const rlen = maxLength >>> 1;
  const llen = maxLength - rlen;
  return s.substring(0, llen) + '…' + s.substring(s.length - rlen);
}
export function truncateStringWithEllipsisToSingleLine (s: string, maxLength: number): string {
  return truncateStringWithEllipsis(s.replace(/\s+/g, ' '), maxLength);
}

export const newlinesToSpaces = (s: string) => s.replace(/\r?\n/g, ' ');

const _isChar_ = (mincc: number, maxcc: number) => (s: string) => {
  if (s.length !== 1) return false;
  const c = s.charCodeAt(0);
  return c >= mincc && c <= maxcc;
};
export function isLetterChar (s: string) {
  if (s.length !== 1) return false;
  const c = s.charCodeAt(0);
  return (c >= 65 && c <= 90) || (c >= 97 && c <= 122);
}
export const isUpperCaseChar = _isChar_(65, 90);
export const isLowerCaseChar = _isChar_(97, 122);
export const isDigit = _isChar_(48, 57);
export const startsWithLetterChar = (s: string) => isLetterChar(s.slice(0, 1));
export function isHexChar () {
  return (s: string) => {
    if (s.length !== 1) return false;
    const c = s.charCodeAt(0);
    // 0-9, A-F, a-f
    return (c >= 48 && c <= 57) || (c >= 65 && c <= 70) || (c >= 97 && c <= 102);
  };
}

export const isCamelCase = (s: string) => /^[a-z][A-Za-z]*$/.test(s);
export const isPascalCase = (s: string) => /^[A-Z][A-Za-z]*$/.test(s);

const rxRegExpSpecialChars = /[-[\]{}()*+?.,\\^$|#\s]/g;
export const escapeRegExpChars = (s: string) => s.replace(rxRegExpSpecialChars, '\\$&');

export function humanReadableANDStringFromArray (strings: any[]): string {
  const segments: string[] = [];
  for (let i = 0; i < strings.length; ++i) {
    if (i > 0) segments.push(i === strings.length - 1 ? ' and ' : ', ');
    segments.push(strings[i]);
  }
  return segments.join('');
}

export type inls = typeof inls;
/**
 * Inline multiline string normalization utility.
 * @remarks
 * This is a utility designed for cases where we want to inline a long, manually line-wrapped string literal in code via
 * a template literal expression, but without having to worry about all the unwanted padding, newlines and indentation
 * required to keep the text of the string neatly positioned in the code where it appears. The output string is produced
 * by first trimming and unindenting the input string, then replacing with a space any newlines that are immediately
 * preceded and followed by a non-whitespace character. Supports correct unwrapping of line breaks in hyphenated words,
 * and preserves line breaks appropriately when adjacent to simple markdown-style headings (lines prefixed with a single
 * hash followed by a space) and list items (lines beginning with a dash or an integer followed by a period, then
 * followed by a space).
 */
export function inls (text: string): string;
export function inls (strings: TemplateStringsArray, ...tokens: unknown[]): string;
export function inls (text_or_strings: string | TemplateStringsArray, ...tokens: unknown[]): string {
  const string = isString(text_or_strings) ? text_or_strings : TemplateLiteral.staticJoin(text_or_strings, tokens);
  const normalized = normalizeBlockIndentToString(string);
  // For each newline, replace it with a space as long as none of the following is true:
  // - The newline is preceded or followed by whitespace
  // - The newline is preceded by a hash (markdown heading) or hyphen (unordered list item) character
  // - The newline is followed by a number and a period (ordered list item)
  // - As an edge case, if a line ends with a single hyphen and the next line begins with an alphanumeric character, the
  //   newline is replaced with an empty string, restoring breaks in hyphenated words.
  const withRestoredHyphenations = normalized.replace(/(?<=[A-Za-z])-\r?\n(?=[A-Za-z])/g, '');
  return withRestoredHyphenations.replace(/(?<!\s)\r?\n(?!\s|(?:[#-]|[0-9]\.\s)\s)/g, ' ');
  // Note that the above is insufficient for dealing with more complex scenarios such as unwrapping list items within
  // lists that retain some degree of indentation after the initial unindenting process. The current regular expression
  // would see wrapped lines of text as being preceded by whitespace, which would prevent the newline from being
  // replaced with a space.
}
export function inlblock (text: string): string;
export function inlblock (strings: TemplateStringsArray, ...tokens: unknown[]): string;
export function inlblock (text_or_strings: string | TemplateStringsArray, ...tokens: unknown[]): string {
  const string = isString(text_or_strings) ? text_or_strings : TemplateLiteral.staticJoin(text_or_strings, tokens);
  return normalizeBlockIndentToString(string.trimEnd());
}
export namespace inlblock {
  export function indent (spaces: number, text: string) {
    return normalizeBlockIndent(text).map(line => ' '.repeat(spaces) + line).join('\n');
  }
}

export interface Inline {
  segments: any[];
}
export function Inline (inlineText: Inline | any[]): Inline {
  if (Inline.isInline(inlineText)) return inlineText;
  if (isArray(inlineText)) return Inline.create({ segments: inlineText });
  return Inline.create(inlineText);
}
export namespace Inline {
  /** @internal */
  export function create (inlineText: Inline): Inline {
    inlineText = { ...inlineText };
    Object.defineProperty(inlineText, 'toString', { value: InlineToString });
    return inlineText;
  }
  /** @internal Defines the `toString` method for `Inline` objects. */
  function InlineToString (this: Inline): string { return Inline.join(this); }
  export const isInline = (target: unknown): target is Inline => target?.toString === InlineToString;

  export function render (text: any): string {
    if (isArray(text) || isInline(text)) return join(text);
    return String(text);
  }

  /**
   * Implemented in terms of segments, not lines. Nested arrays are treated as arrays of text segments. Newlines are not
   * taken into account at all. Their use in this context is at the discretion of the caller, and whatever comes from
   * that is their responsibility. If a segment array contains a `Block`, it is rendered with one level of increased
   * indentation, but then the resultant string is inlined as though it were a single segment without any newlines.
   * @param inlineText The inline text object or an array of segments to join.
   * @param currentIndent The current indentation level string. Any {@link Block} segments nested as segments will wrap
   *   to the next line with indentation applied as per the `currentIndent` value.
   * @param tabSize The number of spaces for each indentation level.
   */
  export function join (inlineText: Inline | any[], currentIndent = '', tabSize = 2): string {
    if (isArray(inlineText)) {
      inlineText = { segments: inlineText };
    }
    const parts: string[] = [];
    for (const segment of inlineText.segments) {
      _processInlineSegment(segment, parts, currentIndent, tabSize);
    }
    return parts.join('');
  }

  /** @internal Helper function for Inline.join to process individual segments recursively. */
  function _processInlineSegment (segment: any, parts: string[], currentIndent: string, tabSize: number): void {
    if (Block.isBlock(segment)) {
      // Render the block with increased indentation relative to the current inline context
      const blockIndent = currentIndent + ' '.repeat(tabSize);
      const renderedBlock = Block.join(segment, blockIndent, tabSize);
      // Inline the result by replacing newlines with spaces, effectively treating it as a single segment
      parts.push(renderedBlock.replace(/\r?\n/g, ' '));
    }
    else if (isArray(segment)) {
      // Recursively process nested arrays of segments
      segment.forEach(subSegment => _processInlineSegment(subSegment, parts, currentIndent, tabSize));
    }
    else if (isInline(segment)) {
      // Recursively process nested InlineText objects
      parts.push(join(segment, currentIndent, tabSize));
    }
    else if (isString(segment)) {
      const hasNewline = segment.includes('\n');
      if (hasNewline) {
        // const lines = splitToNestedBlocks(segment
      }
    }
    else if (isDefined(segment)) {
      // Convert other defined types to string and add them as segments
      parts.push(String(segment));
    }
    // Null or undefined segments are ignored
  }
}

export interface Block {
  lines: any[];
  /** Prevents top-level lines in the block from being indented further than the parent block. */
  partial?: boolean;
  /** Specifies something to be prepended to each line when the block is serialized to a string. */
  prepend?: { readonly string: string; readonly skipBlocks?: boolean; readonly skipFirst?: boolean };
  /** Specifies something to be appended to each line when the block is serialized to a string. */
  append?: { readonly string: string; readonly skipBlocks?: boolean; readonly skipLast: boolean };
}
export function Block (block: Block | any[]): Block {
  if (Block.isBlock(block)) return block;
  if (isArray(block)) return Block.create({ lines: block });
  return Block.create(block);
}
export namespace Block {
  /** @internal */
  export function create (block: Block): Block {
    block = { ...block };
    Object.defineProperty(block, 'toString', { value: BlockToString });
    return block;
  }
  /** @internal Defines the `toString` method for `Block` objects. */
  function BlockToString (this: Block): string { return Block.join(this); }
  export const isBlock = (target: unknown): target is Block => target?.toString === BlockToString;

  export function join (block: any[] | Block | Inline, currentIndent = '', tabSize = 2): string {
    if (Inline.isInline(block)) return Inline.join(block, currentIndent, tabSize);
    if (isArray(block)) block = { lines: block };
    const lines: string[] = [];
    const hasOptions = anyDefined(block.prepend, block.append);
    for (let i = 0; i < block.lines.length; ++i) {
      const item = block.lines[i];
      let line: string;
      let isBlock: boolean;
      let increaseIndent = false;
      if (Inline.isInline(item)) {
        const text = Inline.join(item, currentIndent + 1, tabSize);
        if (text.length === 0) continue;
        line = text;
        isBlock = false;
      }
      else if (Block.isBlock(item)) {
        isBlock = true;
        if (!item.partial) increaseIndent = true;
      }
      else if (isArray(item)) {
        isBlock = true;
        increaseIndent = true;
      }
      else {
        isBlock = false;
      }
      if (isBlock) {
        const indent = increaseIndent ? currentIndent + ' '.repeat(tabSize) : currentIndent;
        line = join(item, indent, tabSize);
        isBlock = true;
      }
      else {
        line = String(item);
        isBlock = false;
      }
      if (hasOptions) {
        if (isDefined(block.prepend) && (i > 0 || !block.prepend.skipFirst) && (!isBlock || !block.prepend.skipBlocks)) {
          line = block.prepend.string + line;
        }
        if (isDefined(block.append) && (i < block.lines.length - 1 || !block.append.skipLast) && (!isBlock || !block.append.skipBlocks)) {
          line += block.append.string;
        }
      }
      if (!isBlock) {
        line = currentIndent + line;
      }
      lines.push(line);
    }
    const result = lines.join('\n');
    return result;
  }
}

export function normalizeBlockIndent (string: string, trimTrailingWhitespace = false): string[] {
  // If there's a leading empty line, the first line's indent needs to be included in the calculation. If the start of
  // the actual text begins on the first line though, the first line's indent is not considered.
  let lines: string[];
  let startLine: number;
  const firstLineHasText = string.split(/\r?\n/, 1)[0].trim().length > 0;
  if (firstLineHasText) {
    startLine = 1;
    lines = string.trim().split(/\r?\n/);
  }
  else {
    startLine = 0;
    lines = string.split(/\r?\n/);
    const firstNonEmptyLine = lines.findIndex(line => line.trim().length > 0);
    if (firstNonEmptyLine === -1) return [];
    lines.splice(0, firstNonEmptyLine);
  }
  let minIndent = string.length;
  for (let i = startLine; i < lines.length; ++i) {
    let s = lines[i];
    if (trimTrailingWhitespace) s = lines[i] = s.trimEnd();
    const match = /^(\s*)/.exec(s);
    const indent = match![1].length;
    if (indent !== s.length) minIndent = Math.min(minIndent, indent);
  }
  if (minIndent > 0) {
    for (let i = startLine; i < lines.length; ++i) {
      lines[i] = lines[i].substring(minIndent);
    }
  }
  return lines;
}
export function normalizeBlockIndentToString (string: string, trimTrailingWhitespace = false): string {
  return normalizeBlockIndent(string, trimTrailingWhitespace).join('\n');
}

/** Replaces with a single space any contiguous block of whitespace that (a) consists of zero or more spaces and exactly
 * one line break, and (b) is both preceded and followed by one or more non-whitespace characters. */
export function collapseSingleLineBreaks (string: string): string {
  return string.replace(/(?<=\S) *\n *(?=\S)/g, ' ');
}

const measureIndent = (line: string) => line.match(/^(\s*)/)![1].length;
const encodeLineDefault = (line: any) => line;
const encodeBlockDefault = (lines: any[]): any => lines;
const appendLineDefault = <T>(sources: T[], next: T) => sources.push(next);

export function splitToNestedBlocks (block: string): any[];
export function splitToNestedBlocks<T> (block: string, encodeLine?: (line: string) => T, encodeBlock?: (lines: T[]) => T, appendLine?: (lines: T[], line: T) => void): T[];
export function splitToNestedBlocks<T> (
  block: string,
  encodeLine: (line: string) => T = encodeLineDefault,
  encodeBlock: (lines: T[]) => T = encodeBlockDefault,
  appendLine: (lines: T[], line: T) => void = appendLineDefault,
): T[] {
  const rawLines = block.split('\n');
  const baseIndent = measureIndent(rawLines[0]);
  const stack: [number, T[]][] = [];
  let currentIndent = 0;
  let output: T[] = [];
  for (let i = 0; i < rawLines.length; ++i) {
    const rawLine = rawLines[i];
    const lineIndent = measureIndent(rawLine) - baseIndent;
    const encodedLine = encodeLine(rawLine.trim());
    if (lineIndent > currentIndent) {
      stack.push([currentIndent, output]);
      currentIndent = lineIndent;
      output = [encodedLine];
    }
    else {
      let TEMP = 0;
      while (lineIndent < currentIndent) {
        if (++TEMP > 1000) {
          throw new Error(`Infinite cycle detected`);
        }
        if (lineIndent < baseIndent) {
          console.warn(block);
          throw new Error(`Poorly-formatted code block cannot be safely split to nested blocks`);
        }
        const innerOutput = encodeBlock(output);
        [currentIndent, output] = stack.pop()!;
        appendLine(output, innerOutput);
      }
      appendLine(output, encodedLine);
    }
  }
  return output;
}
