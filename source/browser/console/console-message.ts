import { normalizeBlockIndentToString } from '../../primitive/string';
import { ThisShouldBeUnreachable } from '../../general/errors';
import { FnCC } from '../../general/factories-and-latebinding';
import { isArray, isDefined, isFunction, isNonArrayObject, isNotNull, isNull, isNumber, isPrimitive, isString, isUndefined } from '../../general/type-checking';
import { Material, getMaterialColorName, isMaterialColorGroup, type MaterialSC } from '../../color/material';
import { defineConsoleMessageStandardNS } from './console-message.standard-ns';
import { isStaticColor, type StaticColor } from '../../color/static-color';

/**
 * **THIS LIBRARY CAN BE SAFELY USED IN CODE THAT RUNS IN CONSOLES & TERMINALS.**
 *
 * Node.js recognises and automatically disregards %c style tokens, which means it is safe to use this library in
 * Node.js code without worrying about it ruining console output.
 *
 * ENHANCEMENT: This code can be improved to automatically convert 'color' and 'background-color' styles to ANSI colors.
 * The message string will have to be parsed for %c tokens, and the style tokens will have to be stripped out and
 * replaced with the appropriate ANSI escape sequences. Use of an external library like chalk can do the heavy lifting
 * required to convert CSS colors to ANSI colors.
 */

export namespace ConsoleMessage {
  export type StyleValue = string | number | Material | MaterialSC | StaticColor;
  export type Styles = Record<string, StyleValue>;
  export type StylesOrColor = Styles | Material | MaterialSC | StaticColor | string;
  export type Content = ContentUnit | ContentArray;
  export type ContentUnit = Primitive | ConsoleMessage;
  export type ContentArray = Content[];
  export type PrintMode = 'group' | 'log' | 'warn';
}
export interface ConsoleMessage {
  readonly isCollapsed: boolean;
  /** Sets the print mode for this message. Defaults to `log`. Note that even if `setMode` is not explicitly called, any
   * nested child messages (added via `appendToGroup` called against this message or any of its inline sub-messages)
   * will coerce this message into "group" mode automatically. */
  setMode (mode: ConsoleMessage.PrintMode): this;
  /** If in "group" mode, this makes it so that `console.groupCollapsed()` is preferred over `console.group()` when
   * printing this message. Note that there may be other conditions that override this preference in some cases. */
  collapseGroup (): this;
  /** If in "group" mode, this makes it so that `console.group()` is preferred over `console.groupCollapsed()` when
   * printing this message. Note that there may be other conditions that override this preference in some cases. Note
   * that groups are expanded by default, so calling `expandGroup` is only necessary in cases where there is a
   * possibility that the group has transitioned to a collapsed state prior to calling this method. */
  expandGroup (): this;
  /** Clears existing styles (if any) and replaces them with the specified `style`. */
  setStyle (style: ConsoleMessage.Styles): this;
  /** Updates the current message so that the specified `style` is merged with the existing styles. */
  patchStyle (style: ConsoleMessage.Styles): this;
  /** Enforces a space between this message and any non-zero-length preceding message. Does not appear at the start of
   * the overall message. Multiple spaces will collapse into a single space. */
  spaceLeft (): this;
  /** Enforces a space between this message and any non-zero-length following message. Does not appear at the end of the
   * overall message. Multiple spaces will collapse into a single space. */
  spaceRight (): this;
  /** Enforces a space between this message and any non-zero-length preceding or following message. Does not appear at
   * the start or end of the overall message. Multiple spaces will collapse into a single space. */
  spaceAround (): this;
  /** Updates the current message so that the specified `content` is appended to the end. */
  appendInline (...content: ConsoleMessage.ContentArray): this;
  /** Updates the current message so that the specified `prefix` and `suffix` are prepended and appended to the message
   * respectively. */
  surround (prefix: ConsoleMessage.ContentUnit, suffix: ConsoleMessage.ContentUnit): this;
  /** Adds general reference arguments to be logged after the main message. */
  addTailArgs (...tail: any[]): this;
  /** Associates specified messages as group-indented child messages of this message, and forces this message into
   * "group" mode. When this message is printed, the child messages will be printed immediately as group children of
   * this message before any other manually-printed messages appear in the same group. */
  appendToGroup (...innerMessages: ConsoleMessage[]): this;
  /** Logs this message to the console. Shorthand for `beginPrint()` followed by `endPrint()`. */
  print (...tail: any[]): void;
  /** Begins logging this message to the console. If this message is in "group" mode, a console group will be opened.
   * Must be followed by a call to `endPrint()`. If it is known that the message is not in group mode, a call to
   * `print()` may be a more concise choice, as any subsequent messages printed prior to the call to `endPrint()` will
   * be printed at the same indentation level as this message, and `endPrint()` will have no effect. */
  beginPrint (...tail: any[]): this;
  printGroup<R> (callback: () => R): R;
  /** Technically required following a call to `beginPrint()`, but has no effect if the message is not in "group" mode.
   * See `beginPrint` for further details. */
  endPrint (): void;
}
type _ConsoleMessage = ConsoleMessage;
interface CollectorState {
  strings: string[];
  styles: string[];
  fontWeight: string[];
  fontStyle: string[];
  color: string[];
  bgcolor: string[];
  inners: ConsoleMessage.ContentUnit[];
  tail: any[];
  isSpacedLeft: boolean;
}

export const isConsoleMessage = (value: any): value is ConsoleMessage => value instanceof ConsoleMessage;
export const ConsoleMessage = Object.assign(FnCC(class ConsoleMessage implements _ConsoleMessage {
  static create: {
    (content?: Primitive | _ConsoleMessage | ConsoleMessage.ContentArray, style?: ConsoleMessage.StylesOrColor | keyof Material.Namespace | `#${string}`): _ConsoleMessage;
    (style?: ConsoleMessage.Styles): _ConsoleMessage;
  } = (content_or_style?: Primitive | _ConsoleMessage | ConsoleMessage.ContentArray | ConsoleMessage.Styles, maybe_style?: ConsoleMessage.StylesOrColor | keyof Material.Namespace | `#${string}`) => {
    if (isStaticColor(maybe_style)) maybe_style = maybe_style.hex;
    if (isMaterialColorGroup(maybe_style)) maybe_style = getMaterialColorName(maybe_style);
    if (isString(maybe_style) || isNumber(maybe_style)) maybe_style = { 'color': (maybe_style as string).startsWith('#') ? maybe_style : Material[maybe_style][500], 'font-weight': 'normal' };
    if (isUndefined(content_or_style)) return new ConsoleMessage([], maybe_style ?? {});
    if (isConsoleMessage(content_or_style) && isUndefined(maybe_style)) return content_or_style;
    let content: ConsoleMessage.ContentArray;
    if (isArray(content_or_style)) content = content_or_style;
    else if (isConsoleMessage(content_or_style) || isPrimitive(content_or_style)) content = [content_or_style];
    else return new ConsoleMessage([], content_or_style);
    return new ConsoleMessage(content, maybe_style);
  };
  constructor (content: ConsoleMessage.ContentArray, style?: ConsoleMessage.Styles) {
    this.#content = content;
    this.#style = style;
  }
  #content: ConsoleMessage.ContentArray;
  #inner: ConsoleMessage.ContentUnit[] = [];

  #style: ConsoleMessage.Styles | undefined;
  #mode: ConsoleMessage.PrintMode = 'log';
  #tail: any[] = [];
  #collapsed = false;
  #leftSpacer: boolean;
  #rightSpacer: boolean;

  get isCollapsed (): boolean { return this.#collapsed; }

  setMode (mode: ConsoleMessage.PrintMode): this {
    this.#mode = mode;
    return this;
  }
  collapseGroup (): this {
    this.#collapsed = true;
    return this;
  }
  expandGroup (): this {
    this.#collapsed = false;
    return this;
  }
  setStyle (style: ConsoleMessage.Styles): this {
    this.#style = style;
    return this;
  }
  patchStyle (style: ConsoleMessage.Styles): this {
    this.#style = { ...this.#style, ...style };
    return this;
  }
  spaceLeft (): this {
    this.#leftSpacer = true;
    return this;
  }
  spaceRight (): this {
    this.#rightSpacer = true;
    return this;
  }
  spaceAround (): this {
    this.spaceLeft();
    this.spaceRight();
    return this;
  }
  appendInline (...content: ConsoleMessage.ContentArray): this {
    this.#content.push(...content);
    return this;
  }
  surround (left: ConsoleMessage.ContentUnit, right: ConsoleMessage.ContentUnit): this {
    this.#content.unshift(left);
    this.#content.push(right);
    return this;
  }
  addTailArgs (...tail: any[]): this {
    this.#tail.push(...tail);
    return this;
  }
  appendToGroup (...innerMessages: _ConsoleMessage[]): this {
    if (innerMessages.length === 0) return this;
    this.setMode('group');
    this.#inner.push(...innerMessages);
    return this;
  }
  collect (state: CollectorState, isStart: boolean, isEnd: boolean): void {
    state.tail.push(...this.#tail);

    if (!state.isSpacedLeft && !isStart && this.#leftSpacer) {
      state.strings.push('%c ');
      state.styles.push(this.#addInheritedBackgroundColor(state, ''));
      state.isSpacedLeft = true;
    }

    const fontWeight_local = this.#style?.['font-weight'];
    const fontStyle_local = this.#style?.['font-style'];
    const color_local = this.#style?.['color'];
    const bgcolor_local = this.#style?.['background-color'];
    if (fontWeight_local) state.fontWeight.push(String(fontWeight_local));
    if (fontStyle_local) state.fontStyle.push(String(fontStyle_local));
    if (color_local) state.color.push(String(color_local));
    if (bgcolor_local) state.bgcolor.push(String(bgcolor_local));

    const entries = Object.entries(this.#style ?? {});
    const thisStyle: { value: string; shouldBeRestored: boolean } = { value: '', shouldBeRestored: false };
    state.inners.push(...this.#inner);
    if (entries.length > 0) {
      state.strings.push('%c');
      let styleValue = entries.map(([key, value]) => `${key}: ${isStaticColor(value) ? value.hex : isMaterialColorGroup(value) ? value[500] : value}`).join('; ');
      if (!fontWeight_local) styleValue = this.#addInheritedFontWeight(state, styleValue);
      if (!fontStyle_local) styleValue = this.#addInheritedFontStyle(state, styleValue);
      if (!color_local) styleValue = this.#addInheritedColor(state, styleValue);
      if (!bgcolor_local) styleValue = this.#addInheritedBackgroundColor(state, styleValue);
      thisStyle.value = styleValue;
      state.styles.push(styleValue);
    }
    else {
      thisStyle.value = this.#addInheritedFontWeight(state, thisStyle.value);
      thisStyle.value = this.#addInheritedFontStyle(state, thisStyle.value);
      thisStyle.value = this.#addInheritedColor(state, thisStyle.value);
      thisStyle.value = this.#addInheritedBackgroundColor(state, thisStyle.value);
    }

    this.#collectFromArray(state, isStart, isEnd, thisStyle, this.#content);

    if (fontWeight_local) state.fontWeight.pop();
    if (fontStyle_local) state.fontStyle.pop();
    if (color_local) state.color.pop();
    if (bgcolor_local) state.bgcolor.pop();

    if (!state.isSpacedLeft && !isEnd && this.#rightSpacer) {
      state.strings.push('%c ');
      state.styles.push(this.#addInheritedBackgroundColor(state, ''));
      state.isSpacedLeft = true;
    }
  }
  #addInheritedFontWeight (state: CollectorState, baseStyleString: string): string {
    return this.#addInheritedStyle(state.fontWeight, 'font-weight', baseStyleString);
  }
  #addInheritedFontStyle (state: CollectorState, baseStyleString: string): string {
    return this.#addInheritedStyle(state.fontStyle, 'font-style', baseStyleString);
  }
  #addInheritedColor (state: CollectorState, baseStyleString: string): string {
    return this.#addInheritedStyle(state.color, 'color', baseStyleString);
  }
  #addInheritedBackgroundColor (state: CollectorState, baseStyleString: string): string {
    return this.#addInheritedStyle(state.bgcolor, 'background-color', baseStyleString);
  }
  #addInheritedStyle (stack: ConsoleMessage.StyleValue[], styleName: string, baseStyleString: string): string {
    if (stack.length === 0) return baseStyleString;
    const inheritedStyle = `${styleName}: ${stack[stack.length - 1]}`;
    return baseStyleString ? `${inheritedStyle}; ${baseStyleString}` : inheritedStyle;
  }
  #collectFromArray (state: CollectorState, isStart: boolean, isEnd: boolean, thisStyle: { value: string; shouldBeRestored: boolean }, content: ConsoleMessage.ContentArray): void {
    for (let i = 0; i < content.length; ++i) {
      const item = content[i];
      if (isConsoleMessage(item)) {
        const lastStyle = state.styles.length === 0 ? '' : state.styles[state.styles.length - 1];
        (item as ConsoleMessage).collect(state, i === 0 && isStart, i === content.length - 1 && isEnd);
        if (state.styles.length > 0 && state.styles[state.styles.length - 1] !== lastStyle) thisStyle.shouldBeRestored = true;
      }
      else if (isArray(item)) {
        this.#collectFromArray(state, i === 0 && isStart, i === content.length - 1 && isEnd, thisStyle, item);
      }
      else {
        if (thisStyle.shouldBeRestored) {
          state.strings.push('%c');
          state.styles.push(thisStyle.value);
          thisStyle.shouldBeRestored = false;
        }
        state.strings.push(String(item));
        state.isSpacedLeft = false;
      }
    }
  }
  print (...tail: ConsoleMessage.ContentArray): void {
    this.beginPrint(...tail);
    this.endPrint();
  }
  printGroup <R>(callback: () => R): R {
    this.setMode('group');
    this.beginPrint();
    try {
      return callback();
    }
    finally {
      this.endPrint();
    }
  }
  static #groupDepth = 0;
  beginPrint (...tail: ConsoleMessage.ContentArray): this {
    const state: CollectorState = {
      strings: [],
      styles: [],
      fontWeight: [],
      fontStyle: [],
      color: [],
      bgcolor: [],
      inners: [],
      tail: [],
      isSpacedLeft: false,
    };
    this.collect(state, true, true);
    if (this.#mode !== 'group' && state.inners.length > 0) this.setMode('group');
    const message = state.strings.join('');
    switch (this.#mode) {
      case 'group': {
        if (++ConsoleMessage.#groupDepth > 20) {
          throw new Error(`console.group() depth exceeded`);
        }
        if (this.#collapsed) console.groupCollapsed(message, ...state.styles, ...state.tail, ...tail);
        else console.group(message, ...state.styles, ...state.tail, ...tail);
        break;
      }
      case 'log': console.log(message, ...state.styles, ...state.tail, ...tail); break;
      case 'warn': console.warn(message, ...state.styles, ...state.tail, ...tail); break;
      default: throw new ThisShouldBeUnreachable();
    }
    for (let i = 0; i < state.inners.length; ++i) {
      const item = state.inners[i];
      if (item instanceof ConsoleMessage) {
        item.beginPrint();
        item.endPrint();
      }
      else console.log(item);
    }
    return this;
  }
  endPrint (): void {
    if (this.#mode === 'group') {
      console.groupEnd();
      --ConsoleMessage.#groupDepth;
    }
  }
}), {
  /**
   * Shorthand for creating a new `ConsoleMessage` instance and immediately printing it to the console. This is equivalent
   * to calling `ConsoleMessage(...args).print()`, though has an added benefit of allowing nested child messages to be
   * defined inline as part of the initial call.
   *
   * @param content The main content of the message. If a `ConsoleMessage` instance is passed, it will be used directly.
   * @param tailArgs Optional. Any additional arguments to be printed after the main content.
   * @param style Styles to use to format the main message. Alternatively, specify a color string or `Material` instance
   *   and it will be used as the text colour.
   * @param childMessages Optional. Any nested child messages to be printed as part of this message. These will be printed
   *   as group-indented child messages. Each entry in the array can be a primitive value, a `ConsoleMessage` instance, or
   *   an array of values of the same form as the top-level arguments being described in this documentation, allowing
   *   nested child messages to be defined inline.
   */
  print: Object.assign(quickPrint, {
    red: (message: ConsoleMessage.Content, ...tailArgs: any[]) => quickPrint(message, tailArgs, Material.red[500]),
    pink: (message: ConsoleMessage.Content, ...tailArgs: any[]) => quickPrint(message, tailArgs, Material.pink[500]),
    purple: (message: ConsoleMessage.Content, ...tailArgs: any[]) => quickPrint(message, tailArgs, Material.purple[500]),
    deepPurple: (message: ConsoleMessage.Content, ...tailArgs: any[]) => quickPrint(message, tailArgs, Material.deepPurple[500]),
    indigo: (message: ConsoleMessage.Content, ...tailArgs: any[]) => quickPrint(message, tailArgs, Material.indigo[500]),
    blue: (message: ConsoleMessage.Content, ...tailArgs: any[]) => quickPrint(message, tailArgs, Material.blue[500]),
    lightBlue: (message: ConsoleMessage.Content, ...tailArgs: any[]) => quickPrint(message, tailArgs, Material.lightBlue[500]),
    cyan: (message: ConsoleMessage.Content, ...tailArgs: any[]) => quickPrint(message, tailArgs, Material.cyan[500]),
    teal: (message: ConsoleMessage.Content, ...tailArgs: any[]) => quickPrint(message, tailArgs, Material.teal[500]),
    green: (message: ConsoleMessage.Content, ...tailArgs: any[]) => quickPrint(message, tailArgs, Material.green[500]),
    lightGreen: (message: ConsoleMessage.Content, ...tailArgs: any[]) => quickPrint(message, tailArgs, Material.lightGreen[500]),
    lime: (message: ConsoleMessage.Content, ...tailArgs: any[]) => quickPrint(message, tailArgs, Material.lime[500]),
    yellow: (message: ConsoleMessage.Content, ...tailArgs: any[]) => quickPrint(message, tailArgs, Material.yellow[500]),
    amber: (message: ConsoleMessage.Content, ...tailArgs: any[]) => quickPrint(message, tailArgs, Material.amber[500]),
    orange: (message: ConsoleMessage.Content, ...tailArgs: any[]) => quickPrint(message, tailArgs, Material.orange[500]),
    deepOrange: (message: ConsoleMessage.Content, ...tailArgs: any[]) => quickPrint(message, tailArgs, Material.deepOrange[500]),
    brown: (message: ConsoleMessage.Content, ...tailArgs: any[]) => quickPrint(message, tailArgs, Material.brown[500]),
    gray: (message: ConsoleMessage.Content, ...tailArgs: any[]) => quickPrint(message, tailArgs, Material.gray[500]),
    blueGray: (message: ConsoleMessage.Content, ...tailArgs: any[]) => quickPrint(message, tailArgs, Material.blueGray[500]),
  }),
  group: Object.assign(quickGroup, {
    red: (message: ConsoleMessage.Content, group: () => void) => quickGroup(message, Material.red[500], group),
    pink: (message: ConsoleMessage.Content, group: () => void) => quickGroup(message, Material.pink[500], group),
    purple: (message: ConsoleMessage.Content, group: () => void) => quickGroup(message, Material.purple[500], group),
    deepPurple: (message: ConsoleMessage.Content, group: () => void) => quickGroup(message, Material.deepPurple[500], group),
    indigo: (message: ConsoleMessage.Content, group: () => void) => quickGroup(message, Material.indigo[500], group),
    blue: (message: ConsoleMessage.Content, group: () => void) => quickGroup(message, Material.blue[500], group),
    lightBlue: (message: ConsoleMessage.Content, group: () => void) => quickGroup(message, Material.lightBlue[500], group),
    cyan: (message: ConsoleMessage.Content, group: () => void) => quickGroup(message, Material.cyan[500], group),
    teal: (message: ConsoleMessage.Content, group: () => void) => quickGroup(message, Material.teal[500], group),
    green: (message: ConsoleMessage.Content, group: () => void) => quickGroup(message, Material.green[500], group),
    lightGreen: (message: ConsoleMessage.Content, group: () => void) => quickGroup(message, Material.lightGreen[500], group),
    lime: (message: ConsoleMessage.Content, group: () => void) => quickGroup(message, Material.lime[500], group),
    yellow: (message: ConsoleMessage.Content, group: () => void) => quickGroup(message, Material.yellow[500], group),
    amber: (message: ConsoleMessage.Content, group: () => void) => quickGroup(message, Material.amber[500], group),
    orange: (message: ConsoleMessage.Content, group: () => void) => quickGroup(message, Material.orange[500], group),
    deepOrange: (message: ConsoleMessage.Content, group: () => void) => quickGroup(message, Material.deepOrange[500], group),
    brown: (message: ConsoleMessage.Content, group: () => void) => quickGroup(message, Material.brown[500], group),
    gray: (message: ConsoleMessage.Content, group: () => void) => quickGroup(message, Material.gray[500], group),
    blueGray: (message: ConsoleMessage.Content, group: () => void) => quickGroup(message, Material.blueGray[500], group),
  }),
  groupCollapsed: Object.assign(quickGroupCollapsed, {
    red: (message: ConsoleMessage.Content, group: () => void) => quickGroupCollapsed(message, Material.red[500], group),
    pink: (message: ConsoleMessage.Content, group: () => void) => quickGroupCollapsed(message, Material.pink[500], group),
    purple: (message: ConsoleMessage.Content, group: () => void) => quickGroupCollapsed(message, Material.purple[500], group),
    deepPurple: (message: ConsoleMessage.Content, group: () => void) => quickGroupCollapsed(message, Material.deepPurple[500], group),
    indigo: (message: ConsoleMessage.Content, group: () => void) => quickGroupCollapsed(message, Material.indigo[500], group),
    blue: (message: ConsoleMessage.Content, group: () => void) => quickGroupCollapsed(message, Material.blue[500], group),
    lightBlue: (message: ConsoleMessage.Content, group: () => void) => quickGroupCollapsed(message, Material.lightBlue[500], group),
    cyan: (message: ConsoleMessage.Content, group: () => void) => quickGroupCollapsed(message, Material.cyan[500], group),
    teal: (message: ConsoleMessage.Content, group: () => void) => quickGroupCollapsed(message, Material.teal[500], group),
    green: (message: ConsoleMessage.Content, group: () => void) => quickGroupCollapsed(message, Material.green[500], group),
    lightGreen: (message: ConsoleMessage.Content, group: () => void) => quickGroupCollapsed(message, Material.lightGreen[500], group),
    lime: (message: ConsoleMessage.Content, group: () => void) => quickGroupCollapsed(message, Material.lime[500], group),
    yellow: (message: ConsoleMessage.Content, group: () => void) => quickGroupCollapsed(message, Material.yellow[500], group),
    amber: (message: ConsoleMessage.Content, group: () => void) => quickGroupCollapsed(message, Material.amber[500], group),
    orange: (message: ConsoleMessage.Content, group: () => void) => quickGroupCollapsed(message, Material.orange[500], group),
    deepOrange: (message: ConsoleMessage.Content, group: () => void) => quickGroupCollapsed(message, Material.deepOrange[500], group),
    brown: (message: ConsoleMessage.Content, group: () => void) => quickGroupCollapsed(message, Material.brown[500], group),
    gray: (message: ConsoleMessage.Content, group: () => void) => quickGroupCollapsed(message, Material.gray[500], group),
    blueGray: (message: ConsoleMessage.Content, group: () => void) => quickGroupCollapsed(message, Material.blueGray[500], group),
  }),
  factory: undefined! as ConsoleMessageFactory,
  /**
   * Facilitates registration of reusable `ConsoleMessage` instances and `ConsoleMessageFactory` functions. This allows
   * common message presets and formatting styles and conventions to be defined once and then reused across the
   * codebase. Namespace paths are separated by `:` characters, and can be nested arbitrarily deep.
   *
   * @example
   *
   * ```typescript
   * // To see what is already registered:
   * cmsg.ns.dump();
   *
   * // Register a reusable factory:
   * cmsg.ns.register('myapp:error', cmsg.factory({ color: 'red' }));
   * // Immediate usage (retrieving the factory and then using it):
   * cmsg.ns.f('myapp:error').print('Network error occurred:');
   * // Or create it now and then reuse it later:
   * const networkErrorMsg = cmsg.ns.f('myapp:error', 'Network error occurred:', { color: 'red' });
   *
   * // For convenience, factories can be registered in a single step, without having to explicitly construct them:
   * cmsg.ns.register('myapp:error', { color: 'red' });
   *
   * // Register a reusable preset message:
   * cmsg.ns.register('myapp:errors:unhandled', cmsg('Unhandled error:', { color: 'red' }));
   * // Immediate usage:
   * cmsg.ns.print('myapp:errors:unhandled', anErrorThatWasThrown);
   * // Reuse of a preset in another message:
   * cmsg.ns.register('myapp:labels:unhandled-error', (
   *   cmsg('UNHANDLED ERROR', { 'background-color': 'red', 'color': 'yellow', 'padding': '2px 5px' }).spaceRight()
   * ));
   * cmsg.print([cmsg.ns('myapp:labels:unhandled-error'), 'The error details were:'], [anErrorThatWasThrown]);
   * // or:
   * const message = cmsg([cmsg.ns('myapp:labels:unhandled-error'), 'The error details were:'], { color: 'red' });
   * message.addTailArgs(anErrorThatWasThrown);
   * message.print();
   * ```
   */
  ns: undefined! as {
    get: typeof ConsoleMessageReusables.getPreset;
    f: typeof ConsoleMessageReusables.getFactory & {
      print: (nameOrPath: string, ...args: ConsoleMessageFactory.Parameters) => void;
    };
    register: typeof ConsoleMessageReusables.register;
    print: (nameOrPathToPresetConsoleMessage: string, ...tailArgs: any[]) => void;
    dump: () => void;
  },
  mcolor: Material,
  std: undefined! as ReturnType<typeof defineConsoleMessageStandardNS>,
});

Object.defineProperties(ConsoleMessage, {
  factory: {
    configurable: false,
    enumerable: true,
    get () { return ConsoleMessageFactory; },
  },
  ns: {
    configurable: false,
    enumerable: true,
    writable: false,
    value: {
      get: (nameOrPath: string) => ConsoleMessageReusables.getPreset(nameOrPath),
      f: Object.assign((nameOrPath: string) => ConsoleMessageReusables.getFactory(nameOrPath), {
        print: (nameOrPath: string, ...args: Parameters<ConsoleMessageFactory>) => {
          const factory = ConsoleMessageReusables.getFactory(nameOrPath);
          const result = factory(...args) as ConsoleMessage | ConsoleMessageFactory;
          const message = isConsoleMessageFactory(result) ? result() : result;
          message.print();
        },
      }),
      register: (nameOrPath: string, spec: ConsoleMessageReusables.RegistrationSpec) => ConsoleMessageReusables.register(nameOrPath, spec),
      print: (nameOrPath: string, ...tailArgs: any[]) => ConsoleMessageReusables.getPreset(nameOrPath).print(...tailArgs),
      dump: () => ConsoleMessageReusables.printAllRegistrations(),
    },
  },
  std: {
    configurable: false,
    enumerable: true,
    get: (() => {
      let std: ReturnType<typeof defineConsoleMessageStandardNS> | undefined;
      return function () { return std ??= defineConsoleMessageStandardNS(); };
    })(),
  },
});

/**
 * A concise alias for {@link ConsoleMessage} intended to be quick to type and to synergise nicely with automatic
 * imports. Use with {@link cmsg.print} for additional convenience in logging to the console.
 */
export type cmsg = typeof ConsoleMessage;
export const cmsg = ConsoleMessage;

export const isConsoleMessageFactory = (value: any): value is ConsoleMessageFactory => isFunction(value) && isFunction(value['print']);
export namespace ConsoleMessageFactory {
  export type Parameters =
    | []
    | [content: ConsoleMessage.Content, extendedStyles?: ConsoleMessage.Styles, childMessages?: QuickPrintChildMessage[]]
    | [content: ConsoleMessage.Content, childMessages?: QuickPrintChildMessage[]]
    | [extendedStyles: ConsoleMessage.Styles];
}
export interface ConsoleMessageFactory {
  /**
   * Creates whatever message the factory would create by default. Note that if the factory has only been configured
   * with styles and no content, the message it returns will be devoid of content and useless for printing unless
   * content is subsequently added to it.
   */
  (): ConsoleMessage;
  /**
   * Constructs a new message with the factory's default styles and the specified `content`. If an `extendedStyles`
   * argument is provided, they will be merged into the factory's default styles. If a `childMessages` argument is
   * provided, they will be added as group-indented child messages of the returned message instance.
   */
  (content: ConsoleMessage.Content, extendedStyles?: ConsoleMessage.Styles, childMessages?: QuickPrintChildMessage[]): ConsoleMessage;
  /**
   * Constructs a new message with the factory's default styles and the specified `content`. If a `childMessages`
   * argument is provided, they will be added as group-indented child messages of the returned message instance.
   */
  (content: ConsoleMessage.Content, childMessages?: QuickPrintChildMessage[]): ConsoleMessage;
  /**
   * Returns a new factory amended with the new styles merged into the existing styles.
   */
  (extendedStyles: ConsoleMessage.Styles): ConsoleMessageFactory;
}
export const ConsoleMessageFactory = (styles: ConsoleMessage.Styles): ConsoleMessageFactory => {
  return function factory (
    content_or_extendedStyles?: ConsoleMessage.Content | ConsoleMessage.Styles,
    extendedStyles_or_childMessages?: ConsoleMessage.Styles | QuickPrintChildMessage[],
    maybe_childMessages?: QuickPrintChildMessage[]
  ): any {
    if (isUndefined(content_or_extendedStyles)) {
      return ConsoleMessage(styles);
    }
    if (!isConsoleMessage(content_or_extendedStyles) && isNonArrayObject(content_or_extendedStyles)) {
      return ConsoleMessageFactory({ ...styles, ...content_or_extendedStyles as any });
    }
    if (isDefined(extendedStyles_or_childMessages)) {
      if (isArray(extendedStyles_or_childMessages)) {
        const childMessages = mapQuickPrintChildMessageArrayToConsoleMessages(extendedStyles_or_childMessages);
        const message = ConsoleMessage(content_or_extendedStyles as any, styles);
        message.appendToGroup(...childMessages);
        return message;
      }
      else {
        const message = ConsoleMessage(content_or_extendedStyles as any, { ...styles, ...extendedStyles_or_childMessages });
        if (isDefined(maybe_childMessages)) {
          message.appendToGroup(...mapQuickPrintChildMessageArrayToConsoleMessages(maybe_childMessages));
        }
        return message;
      }
    }
    else {
      return ConsoleMessage(content_or_extendedStyles as any, styles);
    }
  };
};

type QuickGroupArgs<R> =
  | [content: ConsoleMessage.Content, group: () => R]
  | [content: ConsoleMessage.Content, messageColor: string | Material, group: () => R]
  | [content: ConsoleMessage.Content, style: ConsoleMessage.Styles, group: () => R]
  | [content: ConsoleMessage.Content, tailArgs: any[], messageColor: string | Material, group: () => R]
  | [content: ConsoleMessage.Content, tailArgs: any[], style: ConsoleMessage.Styles, group: () => R];

function quickGroup<R> (...args: QuickGroupArgs<R>): R {
  const group = args.pop() as () => R;
  const msg = quickPrintArgsToConsoleMessage(...args as any as QuickPrintArgs).setMode('group').beginPrint();
  const result = group();
  msg.endPrint();
  return result;
}
function quickGroupCollapsed<R> (...args: QuickGroupArgs<R>): R {
  const group = args.pop() as () => R;
  const msg = quickPrintArgsToConsoleMessage(...args as any as QuickPrintArgs).setMode('group').collapseGroup().beginPrint();
  const result = group();
  msg.endPrint();
  return result;
}

type QuickPrintArgs =
  | [content: ConsoleMessage.Content, tailArgs: any[], messageColor: string | Material, childMessages?: QuickPrintChildMessage[]]
  | [content: ConsoleMessage.Content, tailArgs: any[], style: ConsoleMessage.Styles, childMessages?: QuickPrintChildMessage[]]
  | [content: ConsoleMessage.Content, messageColor: string | Material, childMessages?: QuickPrintChildMessage[]]
  | [content: ConsoleMessage.Content, style?: ConsoleMessage.Styles, childMessages?: QuickPrintChildMessage[]]
  | [content: ConsoleMessage.Content, childMessages?: QuickPrintChildMessage[]];
type QuickPrintChildMessage = ConsoleMessage.ContentUnit | QuickPrintArgs;
function quickPrint (...args: QuickPrintArgs): void {
  quickPrintArgsToConsoleMessage(...args).print();
}
function quickPrintArgsToConsoleMessage (...args: QuickPrintArgs): ConsoleMessage;
function quickPrintArgsToConsoleMessage (
  content: ConsoleMessage.Content,
  tailArgs_or_style_or_childMessages?: any[] | string | Material | ConsoleMessage.Styles | QuickPrintChildMessage[],
  style_or_childMessages?: string | Material | ConsoleMessage.Styles | QuickPrintChildMessage[],
  maybe_childMessages?: QuickPrintChildMessage[]
): ConsoleMessage {
  if (isString(content)) content = normalizeBlockIndentToString(content);
  let tailArgs: any[] | undefined;
  let style: string | Material | ConsoleMessage.Styles | undefined;
  let childMessages: QuickPrintChildMessage[] | undefined;
  if (arguments.length === 2 && isArray(tailArgs_or_style_or_childMessages)) {
    childMessages = tailArgs_or_style_or_childMessages as QuickPrintChildMessage[];
  }
  else if (isArray(tailArgs_or_style_or_childMessages)) {
    tailArgs = tailArgs_or_style_or_childMessages;
    style = style_or_childMessages as string | Material | ConsoleMessage.Styles;
    childMessages = maybe_childMessages;
  }
  else {
    style = tailArgs_or_style_or_childMessages as string | Material | ConsoleMessage.Styles;
    childMessages = style_or_childMessages as QuickPrintChildMessage[] | undefined;
  }
  let message: ConsoleMessage;
  if (isDefined(style)) {
    if (isMaterialColorGroup(style)) style = style[500];
    if (isString(style)) style = { 'color': style, 'font-weight': 'normal' };
    message = ConsoleMessage(content, style);
  }
  else {
    message = ConsoleMessage(content);
  }
  if (isDefined(tailArgs)) message.addTailArgs(...tailArgs);
  if (isDefined(childMessages)) {
    for (let i = 0; i < childMessages.length; ++i) {
      const child = childMessages[i];
      message.appendToGroup(convertQuickPrintChildMessageToConsoleMessage(child));
    }
  }
  return message;
}
function mapQuickPrintChildMessageArrayToConsoleMessages (messages: QuickPrintChildMessage[]) {
  const result: ConsoleMessage[] = [];
  for (let i = 0; i < messages.length; ++i) {
    const child = messages[i];
    result.push(convertQuickPrintChildMessageToConsoleMessage(child));
  }
  return result;
}
function convertQuickPrintChildMessageToConsoleMessage (child: QuickPrintChildMessage): ConsoleMessage {
  if (isPrimitive(child)) return ConsoleMessage(child);
  if (isConsoleMessage(child)) return child;
  return quickPrintArgsToConsoleMessage(...child);
}

export namespace ConsoleMessageReusables {
  export type NamespaceRecordSpec = { [nameOrPath: string]: ConsoleMessage | ConsoleMessageFactory | NamespaceRecordSpec };
  export type NamespaceRegistrationSpec = ConsoleMessage | ConsoleMessageFactory | NamespaceRecordSpec;
  export type RegistrationSpec = ConsoleMessage | ConsoleMessageFactory | { [styleKey: string]: any };

  export function register (namespaces: NamespaceRecordSpec): void;
  export function register (nameOrPath: string, spec: RegistrationSpec): void;
  export function register (namespaces_or_nameOrPath: NamespaceRecordSpec | string, spec?: RegistrationSpec) {
    if (isString(namespaces_or_nameOrPath)) {
      registerConsoleMessageNamespace(namespaces_or_nameOrPath, spec!, RootNamespace);
    }
    else {
      registerConsoleMessageNamespaces(namespaces_or_nameOrPath, RootNamespace);
    }
  }

  export function getPreset (nameOrPath: string): ConsoleMessage {
    const path = nameOrPath.split(':');
    const entry = getEntry(nameOrPath, path, 0, RootNamespace);
    if (isNull(entry.message)) {
      throw new Error(`[ConsoleMessageReusables] There is a registration for path "${nameOrPath}", but it does not include a preset ConsoleMessage instance`);
    }
    return entry.message;
  }

  export function getFactory (nameOrPath: string): ConsoleMessageFactory {
    const path = nameOrPath.split(':');
    const entry = getEntry(nameOrPath, path, 0, RootNamespace);
    if (isNull(entry.factory)) {
      throw new Error(`[ConsoleMessageReusables] There is a registration for path "${nameOrPath}", but it does not include a ConsoleMessageFactory instance`);
    }
    return entry.factory;
  }

  interface NamespaceEntry {
    message: ConsoleMessage | null;
    factory: ConsoleMessageFactory | null;
    namespace: Map<string, NamespaceEntry>;
  }
  const RootNamespace = new Map<string, NamespaceEntry>();

  const isStyleValue = (value: any): value is ConsoleMessage.StyleValue => isPrimitive(value) || isMaterialColorGroup(value);
  function isStylesRecord (a: NamespaceRecordSpec | ConsoleMessage.Styles): a is ConsoleMessage.Styles {
    for (const key in a) {
      if (!isStyleValue(a[key])) return false;
    }
    return true;
  }

  export function stylesFrom (stylesOrColor: ConsoleMessage.StylesOrColor, extraStyles?: ConsoleMessage.Styles): ConsoleMessage.Styles {
    if (isString(stylesOrColor)) return { 'color': stylesOrColor, 'font-weight': 'normal', ...extraStyles };
    if (isStaticColor(stylesOrColor)) return { 'color': stylesOrColor.hex, 'font-weight': 'normal', ...extraStyles };
    if (isMaterialColorGroup(stylesOrColor)) return { 'color': stylesOrColor[500], 'font-weight': 'normal', ...extraStyles };
    return { 'font-weight': 'normal', ...stylesOrColor, ...extraStyles };
  }

  function registerConsoleMessageNamespace (nameOrPath: string, spec: RegistrationSpec | NamespaceRecordSpec, currentEntries: Map<string, NamespaceEntry>) {
    const path = nameOrPath.split(':');
    let entry = currentEntries.get(nameOrPath);
    if (isUndefined(entry)) {
      entry = { message: null, factory: null, namespace: new Map() };
      currentEntries.set(path[0], entry);
    }
    if (path.length > 1) {
      registerConsoleMessageNamespace(nameOrPath.slice(path[0].length + 1), spec, entry.namespace);
      return;
    }
    if (isConsoleMessageFactory(spec)) {
      entry.factory = spec;
    }
    else if (isConsoleMessage(spec)) {
      entry.message = spec;
    }
    else if (isStylesRecord(spec)) {
      // The spec is a style group, so we're registering a new factory.
      entry.factory = ConsoleMessageFactory(spec);
    }
    else {
      registerConsoleMessageNamespaces(spec, entry.namespace);
    }
  }
  function registerConsoleMessageNamespaces (spec: NamespaceRecordSpec, entries: Map<string, NamespaceEntry>) {
    for (const key in spec) {
      registerConsoleMessageNamespace(key, spec[key], entries);
    }
  }

  function getEntry (spec: string, path: string[], index: number, entries: Map<string, NamespaceEntry>): NamespaceEntry {
    if (index >= path.length) {
      throw new Error('Index out of range');
    }
    const entry = entries.get(path[index]);
    if (isUndefined(entry)) {
      throw new Error(path.length === 1
        ? `[ConsoleMessageReusables] The root namespace does not contain an entry named "${spec}"`
        : `[ConsoleMessageReusables] Namespace path "${spec} does not match any existing registration (The name "${path[index]}" at index #${index} of namespace path "${spec}" does not match any existing registered namespace entry)`);
    }
    if (index === path.length - 1) return entry;
    return getEntry(spec, path, index + 1, entry.namespace);
  }

  export function printAllRegistrations () {
    const msg = ConsoleMessage('Registered console message presets and factories:', { color: Material.amber[500] });
    appendPrintableNamespaceEntries(msg, RootNamespace);
    msg.print();
  }
  function appendPrintableNamespaceEntries (msg: ConsoleMessage, ns: Map<string, NamespaceEntry>): ConsoleMessage {
    for (const [name, entry] of ns) {
      const entryMsg = cmsg.std.punctuated(['<', ConsoleMessage(name, { color: Material.pink[300] }), '>']);
      if (isNotNull(entry.message)) {
        entryMsg.appendToGroup(
          ConsoleMessage([ConsoleMessage(`PRESET MESSAGE`, { color: Material.lightBlue }), ` (displayed below):`], { 'font-weight': 'normal' })
            .appendToGroup(entry.message)
        );
      }
      else if (isNotNull(entry.factory)) {
        entryMsg.appendToGroup(
          ConsoleMessage([ConsoleMessage(`FACTORY`, { color: Material.lightBlue }), ` (example output below):`], { 'font-weight': 'normal' })
            .appendToGroup(entry.factory('This message string is the sole argument that was passed to the factory function for this example.'))
        );
      }
      else {
        entryMsg.appendToGroup(ConsoleMessage(`Namespace entry contains neither a preset message nor a factory.`, { color: Material.brown }));
      }
      if (entry.namespace.size > 0) {
        appendPrintableNamespaceEntries(entryMsg, entry.namespace);
      }
      msg.appendToGroup(entryMsg);
    }
    return msg;
  }
}
