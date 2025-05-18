import { getMaterialColorGroup, getMaterialColorValue, isMaterialColorName, isMaterialColorShade, Material, MaterialSC } from '../../color/material';
import { StaticColor } from '../../color/static-color';
import { isArray, isDefined, isFunction, isString, isUndefined } from '../../general/type-checking';
import { cmsg, ConsoleMessage, ConsoleMessageReusables, type ConsoleMessageFactory } from './console-message';
import { ConsoleNotes } from './console-notes';

const useNSFactory = (factoryName: string) => (...args: ConsoleMessageFactory.Parameters): ConsoleMessage => ConsoleMessageReusables.getFactory(factoryName).apply(null, args);
const coloredTextFactory = (colorSpec: StaticColor.Spec) => {
  const color = StaticColor.from(colorSpec);
  return (...msgs: ConsoleMessage.ContentArray) => cmsg(msgs, { 'color': color.hex, 'font-weight': 'normal' });
};

function materialColorConsoleMessage<M extends Material> (materialColor: M, shade: keyof M, content: ConsoleMessage.Content, styles?: ConsoleMessage.Styles, tailArgs?: any[]): ConsoleMessage;
function materialColorConsoleMessage (materialColor: Material, shade: keyof Material, content: ConsoleMessage.Content, styles?: ConsoleMessage.Styles, tailArgs?: any[]): ConsoleMessage {
  const msg = cmsg(content, { 'color': materialColor[shade], ...styles });
  if (isDefined(tailArgs)) msg.addTailArgs(...tailArgs);
  return msg;
}
interface MaterialColorShadeFunction {
  (content: ConsoleMessage.Content, styles?: ConsoleMessage.Styles): ConsoleMessage;
  (content: ConsoleMessage.Content, styles: ConsoleMessage.Styles, tailArgs?: any[]): ConsoleMessage;
  (content: ConsoleMessage.Content, tailArgs?: any[]): ConsoleMessage;
}
function materialColorShadeFunction<M extends Material> (materialColor: M, shade: keyof M, extraStyles?: ConsoleMessage.Styles): MaterialColorShadeFunction {
  return function (content: ConsoleMessage.Content, styles_or_tailArgs?: ConsoleMessage.Styles | any[], tailArgs?: any[]): ConsoleMessage {
    let styles: ConsoleMessage.Styles | undefined;
    if (isArray(styles_or_tailArgs)) {
      tailArgs = styles_or_tailArgs;
    }
    else {
      styles = styles_or_tailArgs;
    }
    return materialColorConsoleMessage(materialColor, shade, content, { ...extraStyles, ...styles }, tailArgs);
  };
}

interface AugmentedMaterialColorShadeFunction extends MaterialColorShadeFunction {
  bold: {
    (content: ConsoleMessage.Content, tailArgs?: any[]): ConsoleMessage;
    italic: {
      (content: ConsoleMessage.Content, tailArgs?: any[]): ConsoleMessage;
    };
  };
  italic: {
    (content: ConsoleMessage.Content, tailArgs?: any[]): ConsoleMessage;
  };
  normal: {
    (content: ConsoleMessage.Content, tailArgs?: any[]): ConsoleMessage;
    italic: {
      (content: ConsoleMessage.Content, tailArgs?: any[]): ConsoleMessage;
    };
  };
}
function augmentedMaterialColorShadeFunction<M extends Material> (materialColor: M, shade: keyof M): AugmentedMaterialColorShadeFunction {
  const shadeFunction = materialColorShadeFunction(materialColor, shade);
  return Object.assign(shadeFunction, {
    bold: Object.assign(materialColorShadeFunction(materialColor, shade, { 'font-weight': 'bold' }), {
      italic: materialColorShadeFunction(materialColor, shade, { 'font-weight': 'bold', 'font-style': 'italic' }),
    }),
    italic: materialColorShadeFunction(materialColor, shade, { 'font-style': 'italic' }),
    normal: Object.assign(materialColorShadeFunction(materialColor, shade, { 'font-weight': 'normal' }), {
      italic: materialColorShadeFunction(materialColor, shade, { 'font-weight': 'normal', 'font-style': 'italic' }),
    }),
  });
}

function materialColorGroupFunction<M extends Material> (materialColor: M) {
  const mcolor = augmentedMaterialColorShadeFunction(materialColor, 500);
  const extensions: { [K in keyof M]: AugmentedMaterialColorShadeFunction } = {} as any;
  for (const shadeKey in materialColor) {
    extensions[shadeKey] = augmentedMaterialColorShadeFunction(materialColor, shadeKey);
  }
  return Object.assign(mcolor, extensions);
}

export function defineConsoleMessageStandardNS () {
  const punctuationColor = MaterialSC.blueGray[600].desaturate('50%');
  const textColor = MaterialSC.gray[300];
  const devTextColor = MaterialSC.amber[500];
  const devLabelTextColor = MaterialSC.amber[500];
  const quotedStrColor = MaterialSC.green[200].desaturate('50%');
  const fieldNameColor = MaterialSC.blueGray[400];
  const typeNameColor = MaterialSC.deepPurple[300];
  const keywordColor = MaterialSC.blue[500].desaturate('50%');
  const functionNameColor = MaterialSC.deepOrange[500];
  const numericIdColor = MaterialSC.blue[300].desaturate('25%');
  const numericIndexColor = MaterialSC.blue[500].desaturate('25%');
  const darkBackgroundColor = StaticColor.Black.setAlpha(0.6);
  const devBackgroundColor = MaterialSC.red[500].setLightness(0.11);

  const iconSpacingSize = '2px';
  const textSpacingSize = '5px';

  const CONSTRUCTION_SIGN_CHAR = '\u{1F6A7}';
  const STOP_SIGN_CHAR = '\u{1F6D1}';

  const WIP_LABEL_LARGE = ConsoleMessage([CONSTRUCTION_SIGN_CHAR, ConsoleMessage(` WIP `, {
    'padding': '5px 0',
    'font-weight': 'bold',
    'font-size': '18px',
    'color': 'black',
    'background-color': Material.yellow[500],
  })], {
    'font-size': '18px',
    'padding': '5px 0.5ex',
    'background-color': StaticColor.Black,
  });
  const WIP_LABEL_BOOKMARK = ConsoleMessage([` WORK IN PROGRESS `], {
    'font-weight': 'bold',
    'font-style': 'normal',
    'color': Material.yellow[500],
    'background-color': 'black',
  }).spaceAround();

  const ASSERTION_FAILURE_LABEL = ConsoleMessage([STOP_SIGN_CHAR, ConsoleMessage(` Assertion Failure `, {
    'padding': '5px 0',
    'font-weight': 'bold',
    'font-size': '18px',
    'color': Material.red,
    'background-color': MaterialSC.red[500].setLightness(0.11),
  })], {
    'font-size': '18px',
    'padding': '5px 0.5ex',
    'background-color': StaticColor.Black,
  });

  cmsg.ns.register('cmsg.std.text', { 'color': textColor.hex, 'font-weight': 'normal' });
  cmsg.ns.register('cmsg.std.punctuated', { 'color': punctuationColor.hex, 'font-weight': 'normal' });
  cmsg.ns.register('cmsg.std.fieldName', { 'color': fieldNameColor.hex, 'font-weight': 'normal' });
  cmsg.ns.register('cmsg.std.typeName', { 'color': typeNameColor.hex, 'font-weight': 'normal' });
  cmsg.ns.register('cmsg.std.keyword', { 'color': keywordColor.hex, 'font-weight': 'normal' });
  cmsg.ns.register('cmsg.std.functionName', { 'color': functionNameColor.hex, 'font-weight': 'normal' });
  cmsg.ns.register('cmsg.std.id.numeric', { 'color': numericIdColor.hex, 'font-weight': 'normal' });

  const Punctuated = useNSFactory('cmsg.std.punctuated');
  const FieldName = useNSFactory('cmsg.std.fieldName');
  const TypeName = useNSFactory('cmsg.std.typeName');
  const Keyword = useNSFactory('cmsg.std.keyword');
  const FunctionName = useNSFactory('cmsg.std.functionName');
  const UnquotedString = (msg: ConsoleMessage.Content) => cmsg(msg, ConsoleMessageReusables.stylesFrom(quotedStrColor));

  const PlainLabel = (label: ConsoleMessage.Content, style?: ConsoleMessage.StylesOrColor, bgcolor?: ConsoleMessage.StyleValue) => {
    const styles = ConsoleMessageReusables.stylesFrom(style ?? textColor.hex, {
      'background-color': bgcolor ?? darkBackgroundColor,
      'font-weight': 'bold',
      // 'padding': `0 ${textSpacingSize}`,
      // 'margin-right': textSpacingSize,
    });
    return cmsg([cmsg(' '), label, cmsg(' ')], styles).spaceRight();
  };
  class StandaloneColoredLabelAPI {
    constructor (bgcolor: ConsoleMessage.StyleValue = darkBackgroundColor) { this.#bgcolor = bgcolor; }
    readonly #bgcolor: ConsoleMessage.StyleValue;

    static {
      const isDeclaredKey = <K extends keyof StandaloneColoredLabelAPI>(key: K | string): key is K => key !== 'constructor' && StandaloneColoredLabelAPI.prototype.hasOwnProperty(key);
      const descrs = Object.getOwnPropertyDescriptors(StandaloneColoredLabelAPI.prototype);
      for (const key in descrs) {
        if (isDeclaredKey(key)) descrs[key].enumerable = true;
      }
      Object.defineProperties(StandaloneColoredLabelAPI.prototype, descrs);
    }
    static bindAll (instance: StandaloneColoredLabelAPI = new StandaloneColoredLabelAPI()) {
      for (const key in instance) {
        if (isFunction(instance[key])) {
          instance[key] = instance[key].bind(instance);
        }
      }
      return instance;
    }

    /** @deprecated Need to find a better location for this method. */
    dev (label: ConsoleMessage.Content) { return IconLabel(CONSTRUCTION_SIGN_CHAR, label, devLabelTextColor, this.#bgcolor); }

    red (label: ConsoleMessage.Content) { return PlainLabel(label, Material.red[500], this.#bgcolor); }
    pink (label: ConsoleMessage.Content) { return PlainLabel(label, Material.pink[500], this.#bgcolor); }
    purple (label: ConsoleMessage.Content) { return PlainLabel(label, Material.purple[500], this.#bgcolor); }
    deepPurple (label: ConsoleMessage.Content) { return PlainLabel(label, Material.deepPurple[500], this.#bgcolor); }
    indigo (label: ConsoleMessage.Content) { return PlainLabel(label, Material.indigo[500], this.#bgcolor); }
    blue (label: ConsoleMessage.Content) { return PlainLabel(label, Material.blue[500], this.#bgcolor); }
    lightBlue (label: ConsoleMessage.Content) { return PlainLabel(label, Material.lightBlue[500], this.#bgcolor); }
    cyan (label: ConsoleMessage.Content) { return PlainLabel(label, Material.cyan[500], this.#bgcolor); }
    teal (label: ConsoleMessage.Content) { return PlainLabel(label, Material.teal[500], this.#bgcolor); }
    green (label: ConsoleMessage.Content) { return PlainLabel(label, Material.green[500], this.#bgcolor); }
    lightGreen (label: ConsoleMessage.Content) { return PlainLabel(label, Material.lightGreen[500], this.#bgcolor); }
    lime (label: ConsoleMessage.Content) { return PlainLabel(label, Material.lime[500], this.#bgcolor); }
    yellow (label: ConsoleMessage.Content) { return PlainLabel(label, Material.yellow[500], this.#bgcolor); }
    amber (label: ConsoleMessage.Content) { return PlainLabel(label, Material.amber[500], this.#bgcolor); }
    orange (label: ConsoleMessage.Content) { return PlainLabel(label, Material.orange[500], this.#bgcolor); }
    deepOrange (label: ConsoleMessage.Content) { return PlainLabel(label, Material.deepOrange[500], this.#bgcolor); }
    brown (label: ConsoleMessage.Content) { return PlainLabel(label, Material.brown[500], this.#bgcolor); }
    gray (label: ConsoleMessage.Content) { return PlainLabel(label, Material.gray[500], this.#bgcolor); }
    blueGray (label: ConsoleMessage.Content) { return PlainLabel(label, Material.blueGray[500], this.#bgcolor); }
    black (label: ConsoleMessage.Content) { return PlainLabel(label, StaticColor.Black, this.#bgcolor); }
    white (label: ConsoleMessage.Content) { return PlainLabel(label, StaticColor.White, this.#bgcolor); }
  }
  const DefaultColoredLabel = StandaloneColoredLabelAPI.bindAll();

  interface CreateLabelledMessage {
    (label: ConsoleMessage.Content, message: ConsoleMessage.Content): ConsoleMessage;
  }
  interface LabelledAPI extends CreateLabelledMessage {
    red: LabelledPresetMaterialNameAPI<'red'>;
    pink: LabelledPresetMaterialNameAPI<'pink'>;
    purple: LabelledPresetMaterialNameAPI<'purple'>;
    deepPurple: LabelledPresetMaterialNameAPI<'deepPurple'>;
    indigo: LabelledPresetMaterialNameAPI<'indigo'>;
    blue: LabelledPresetMaterialNameAPI<'blue'>;
    lightBlue: LabelledPresetMaterialNameAPI<'lightBlue'>;
    cyan: LabelledPresetMaterialNameAPI<'cyan'>;
    teal: LabelledPresetMaterialNameAPI<'teal'>;
    green: LabelledPresetMaterialNameAPI<'green'>;
    lightGreen: LabelledPresetMaterialNameAPI<'lightGreen'>;
    lime: LabelledPresetMaterialNameAPI<'lime'>;
    yellow: LabelledPresetMaterialNameAPI<'yellow'>;
    amber: LabelledPresetMaterialNameAPI<'amber'>;
    orange: LabelledPresetMaterialNameAPI<'orange'>;
    deepOrange: LabelledPresetMaterialNameAPI<'deepOrange'>;
    brown: LabelledPresetMaterialNameAPI<'brown'>;
    gray: LabelledPresetMaterialNameAPI<'gray'>;
    blueGray: LabelledPresetMaterialNameAPI<'blueGray'>;
    black: CreateLabelledMessage;
    white: CreateLabelledMessage;
  }
  type LabelledPresetMaterialNameAPI<K extends keyof Material.Namespace> = CreateLabelledMessage & {
    [S in keyof Material.Namespace[K]]: CreateLabelledMessage;
  };

  const IconLabel = (icon: string, label: ConsoleMessage.Content, color: ConsoleMessage.StyleValue, bgcolor: ConsoleMessage.StyleValue = darkBackgroundColor) => cmsg([
    cmsg(icon, {
      'padding': `0 ${iconSpacingSize}`,
      'background-color': darkBackgroundColor,
    }),
    cmsg([
      cmsg(' '),
      label,
      cmsg(' '),
    ], {
      'color': color,
      'background-color': bgcolor,
    }),
  ]);
  const separator = Punctuated(`|`).spaceAround();

  let externalCallSiteLineNumber = -1;
  function createUniqueSourceToken () {
    // We only want to keep the part of the stack trace that uniquely identified where the console messaging library was
    // called from. Anything preceding that line may be unique from one call to the next, and anything after it is
    // redundant references to the console messaging library.
    const lines = new Error().stack!.split('\n');
    if (externalCallSiteLineNumber === -1) {
      outer: {
        for (let i = 1; i < lines.length; ++i) {
          if (!lines[i].includes('sx-presentation/source/console')) {
            externalCallSiteLineNumber = i;
            break outer;
          }
        }
        throw new Error(`Could not find the line number of the external call site in the stack trace.`);
      }
    }
    lines[1] = lines[externalCallSiteLineNumber];
    lines.length = 2;
    return lines.join('\n');
  }


  return {
    mc: {
      red: materialColorGroupFunction(Material.red),
      pink: materialColorGroupFunction(Material.pink),
      purple: materialColorGroupFunction(Material.purple),
      deepPurple: materialColorGroupFunction(Material.deepPurple),
      indigo: materialColorGroupFunction(Material.indigo),
      blue: materialColorGroupFunction(Material.blue),
      lightBlue: materialColorGroupFunction(Material.lightBlue),
      cyan: materialColorGroupFunction(Material.cyan),
      teal: materialColorGroupFunction(Material.teal),
      green: materialColorGroupFunction(Material.green),
      lightGreen: materialColorGroupFunction(Material.lightGreen),
      lime: materialColorGroupFunction(Material.lime),
      yellow: materialColorGroupFunction(Material.yellow),
      amber: materialColorGroupFunction(Material.amber),
      orange: materialColorGroupFunction(Material.orange),
      deepOrange: materialColorGroupFunction(Material.deepOrange),
      brown: materialColorGroupFunction(Material.brown),
      gray: materialColorGroupFunction(Material.gray),
      blueGray: materialColorGroupFunction(Material.blueGray),
    },
    c: {
      black: coloredTextFactory(StaticColor.Black),
      white: coloredTextFactory(StaticColor.White),
    },
    text: Object.assign(useNSFactory('cmsg.std.text'), {
      plain: Object.assign(useNSFactory('cmsg.std.text'), {
        italic: ConsoleMessageReusables.getFactory('cmsg.std.text')({ 'font-style': 'italic' }),
      }),
      subdued: coloredTextFactory(textColor.interpolate(punctuationColor, 0.15)),
      subdued2: coloredTextFactory(textColor.interpolate(punctuationColor, 0.3)),
      subdued3: coloredTextFactory(textColor.interpolate(punctuationColor, 0.45)),
      subdued4: coloredTextFactory(textColor.interpolate(punctuationColor, 0.6)),
      subdued5: coloredTextFactory(textColor.interpolate(punctuationColor, 0.75)),
      dev: coloredTextFactory(devTextColor),
    }),
    separator,
    punctuated: Punctuated,
    /** text: [verbatim] | color: {@link fieldNameColor} | styles: normal */
    fieldName: FieldName,
    /** text: [verbatim] | color: {@link typeNameColor} | styles: normal */
    typeName: TypeName,
    /** text: [verbatim] | color: {@link keywordColor} | styles: normal */
    keyword: Keyword,
    /** text: [verbatim] | color: {@link functionNameColor} | styles: normal */
    functionName: FunctionName,
    numeric: {
      /** text: [verbatim] | color {@link numericIdColor} | styles: normal */
      id: useNSFactory('cmsg.std.id.numeric'),
      /** text: [`#`verbatim] | colors: {@link punctuationColor}, {@link numericIndexColor} | styles: normal */
      index: Object.assign((index: number) => ConsoleMessage([Punctuated('#'), index], { 'color': numericIndexColor.hex }), {
        /** text: [`#`verbatim`:`] | spaced right | colors: {@link punctuationColor}, {@link numericIndexColor} | styles: normal */
        asPrefix: (index: number) => Punctuated(['#', ConsoleMessage(index, { 'color': numericIndexColor.hex }), ':']).spaceRight(),
      }),
    },
    quotedstr: (msg: ConsoleMessage.Content, styles?: ConsoleMessage.StylesOrColor) => Punctuated(['"', UnquotedString(msg), '"']),
    unquotedstr: UnquotedString,
    squareBracketed: (...msgs: ConsoleMessage.ContentArray) => Punctuated(['[', ...msgs, ']']),
    angleBracketed: (...msgs: ConsoleMessage.ContentArray) => Punctuated(['<', ...msgs, '>']),
    braced: (...msgs: ConsoleMessage.ContentArray) => Punctuated(['{', ...msgs, '}']),
    parenthesized: (...msgs: ConsoleMessage.ContentArray) => Punctuated(['(', ...msgs, ')']),
    field: (name: string, value: ConsoleMessage.Content) => Punctuated([FieldName(name), ': ', value]),

    notes: {
      print: Object.assign((content: ConsoleNotes.ContentList) => ConsoleNotes.printMessageList(content), {
        once: ((cache) => (content: ConsoleNotes.ContentList) => {
          const token = createUniqueSourceToken();
          if (cache.has(token)) return;
          cache.add(token);
          ConsoleNotes.printMessageList(content);
        })(new Set<string>()),
      }),
    },

    /**
     * Produces a console message representing a label/tag that can then be used within other messages as needed
     * (usually as the first item of content prefixing everything else).
     */
    label: Object.assign(PlainLabel, DefaultColoredLabel, {
      bg: <{
        <K extends keyof Material.Namespace> (materialColor: K, shade?: keyof Material.Namespace[K]): StandaloneColoredLabelAPI;
        (bgcolor: string | StaticColor): StandaloneColoredLabelAPI;
      }>(<K extends keyof Material.Namespace> (arg: K | string | StaticColor, shade?: keyof Material.Namespace[K]): StandaloneColoredLabelAPI => {
        const bgcolor = isString(arg)
          ? isMaterialColorName(arg) ? getMaterialColorValue(arg, shade) : arg
          : arg.hex;
        return new StandaloneColoredLabelAPI(bgcolor);
      }),
    }),
    /**
     * Produces a console message that begins with a label/tag, followed by additional message content.
     */
    labelled: Object.assign((label: ConsoleMessage.Content, message: ConsoleMessage.Content) => cmsg([label, message]), {
      /**
       * Produces a labelled console message where the label is in {@link devLabelTextColor amber} and is prefixed with `🚧`.
       * @deprecated Need to find a better location for this method.
       */
      dev: (label: ConsoleMessage.Content, message: ConsoleMessage.Content) => cmsg([DefaultColoredLabel.dev(label), message]),

      red: (label: ConsoleMessage.Content, message: ConsoleMessage.Content) => cmsg([DefaultColoredLabel.red(label), message]),
      pink: (label: ConsoleMessage.Content, message: ConsoleMessage.Content) => cmsg([DefaultColoredLabel.pink(label), message]),
      purple: (label: ConsoleMessage.Content, message: ConsoleMessage.Content) => cmsg([DefaultColoredLabel.purple(label), message]),
      deepPurple: (label: ConsoleMessage.Content, message: ConsoleMessage.Content) => cmsg([DefaultColoredLabel.deepPurple(label), message]),
      indigo: (label: ConsoleMessage.Content, message: ConsoleMessage.Content) => cmsg([DefaultColoredLabel.indigo(label), message]),
      blue: (label: ConsoleMessage.Content, message: ConsoleMessage.Content) => cmsg([DefaultColoredLabel.blue(label), message]),
      lightBlue: (label: ConsoleMessage.Content, message: ConsoleMessage.Content) => cmsg([DefaultColoredLabel.lightBlue(label), message]),
      cyan: (label: ConsoleMessage.Content, message: ConsoleMessage.Content) => cmsg([DefaultColoredLabel.cyan(label), message]),
      teal: (label: ConsoleMessage.Content, message: ConsoleMessage.Content) => cmsg([DefaultColoredLabel.teal(label), message]),
      green: (label: ConsoleMessage.Content, message: ConsoleMessage.Content) => cmsg([DefaultColoredLabel.green(label), message]),
      lightGreen: (label: ConsoleMessage.Content, message: ConsoleMessage.Content) => cmsg([DefaultColoredLabel.lightGreen(label), message]),
      lime: (label: ConsoleMessage.Content, message: ConsoleMessage.Content) => cmsg([DefaultColoredLabel.lime(label), message]),
      yellow: (label: ConsoleMessage.Content, message: ConsoleMessage.Content) => cmsg([DefaultColoredLabel.yellow(label), message]),
      amber: (label: ConsoleMessage.Content, message: ConsoleMessage.Content) => cmsg([DefaultColoredLabel.amber(label), message]),
      orange: (label: ConsoleMessage.Content, message: ConsoleMessage.Content) => cmsg([DefaultColoredLabel.orange(label), message]),
      deepOrange: (label: ConsoleMessage.Content, message: ConsoleMessage.Content) => cmsg([DefaultColoredLabel.deepOrange(label), message]),
      brown: (label: ConsoleMessage.Content, message: ConsoleMessage.Content) => cmsg([DefaultColoredLabel.brown(label), message]),
      gray: (label: ConsoleMessage.Content, message: ConsoleMessage.Content) => cmsg([DefaultColoredLabel.gray(label), message]),
      blueGray: (label: ConsoleMessage.Content, message: ConsoleMessage.Content) => cmsg([DefaultColoredLabel.blueGray(label), message]),
      white: (label: ConsoleMessage.Content, message: ConsoleMessage.Content) => cmsg([DefaultColoredLabel.white(label), message]),

      bg: <{
        <K extends keyof Material.Namespace> (materialColor: K, /* range: 0-1 */ lightness: number): LabelledAPI;
        <K extends keyof Material.Namespace> (materialColor: K, shade?: keyof Material.Namespace[K]): LabelledAPI;
        (bgcolor: string | StaticColor): LabelledAPI;
      }>(<K extends keyof Material.Namespace> (arg: K | string | StaticColor, shade?: keyof Material.Namespace[K] | number): LabelledAPI => {
        let bgcolor: string;
        if (isString(arg)) {
          if (isMaterialColorName(arg)) {
            if (isMaterialColorShade(arg, shade)) bgcolor = getMaterialColorValue(arg, shade);
            else if (isUndefined(shade)) bgcolor = getMaterialColorValue(arg);
            else {
              // TypeScript bug: For some reason here `shade` has lost its type and become equivalent to `PropertyKey`.
              bgcolor = StaticColor.fromHex(getMaterialColorValue(arg)).setLightness(shade as number).hex;
            }
          }
          else bgcolor = arg;
        }
        else bgcolor = arg.hex;

        return new Proxy<LabelledAPI>((() => {}) as any, {
          get (t, p, r) {
            if (!isString(p)) return;
            outer: {
              let color: StaticColor;
              switch (p) {
                case 'black': color = StaticColor.Black; break;
                case 'white': color = StaticColor.White; break;
                default: break outer;
              }
              return (label: ConsoleMessage.Content, message: ConsoleMessage.Content) => cmsg([PlainLabel(label, color, bgcolor), message]);
            }
            if (isMaterialColorName(p)) {
              const materialColor = getMaterialColorGroup(p as keyof Material.Namespace);
              return new Proxy((
                (label: ConsoleMessage.Content, message: ConsoleMessage.Content) => cmsg([PlainLabel(label, materialColor[500], bgcolor), message])
              ), {
                get (t, p, r) {
                  if (!(p in materialColor)) return;
                  return (label: ConsoleMessage.Content, message: ConsoleMessage.Content) => cmsg([PlainLabel(label, materialColor[p], bgcolor), message]);
                },
              });
            }
            console.warn(`WARNING: cmsg.std.labelled.bg()[${isString(p) ? `"${p}"` : String(p)}] not supported.`);
          },
          apply (_target, _this, args) {
            const [label, message] = args;
            return cmsg([PlainLabel(label, Material.gray[500], bgcolor), message]);
          },
        });
      }),
    }),
    wip: <{
      (message: ConsoleMessage.Content): ConsoleMessage;
      <R>(message: ConsoleMessage.Content, callback: () => R): R;
      <R>(callback: () => R): R;
      print (message: ConsoleMessage.Content): void;
      small: {
        (message: ConsoleMessage.Content): ConsoleMessage;
        print (message: ConsoleMessage.Content): void;
      };
    }>(Object.assign(wipMessageLarge, {
      print: (message: string) => wipMessageLarge(message).print(),
      small: Object.assign(wipMessageSmall, {
        print: (message: string) => wipMessageSmall(message).print(),
      }),
    })),
    assert: <{
      (test: boolean, message: ConsoleMessage.Content): ConsoleMessage;
      print (test: boolean, message: ConsoleMessage.Content): void;
    }>(Object.assign(assert, {
      print: (test: boolean, message: ConsoleMessage.Content) => assert(test, message)?.print(),
    })),
  };

  function wipMessageLarge (message: ConsoleMessage.Content): ConsoleMessage;
  function wipMessageLarge<R> (message: ConsoleMessage.Content, callback: () => R): R;
  function wipMessageLarge<R> (callback: () => R): R;
  function wipMessageLarge<R> (arg: ConsoleMessage.Content | (() => R), callback?: () => R) {
    const content: ConsoleMessage.Content[] = [WIP_LABEL_LARGE];
    let message: ConsoleMessage;
    if (isFunction(arg)) {
      callback = arg;
      message = WIP_LABEL_LARGE;
    }
    else {
      content.push(' ', arg, ' ');
      message = cmsg(content, {
        'padding': '5px 0',
        'font-weight': 'bold',
        'font-size': '18px',
        'color': Material.yellow[300],
        'background-color': darkBackgroundColor,
      });
    }
    return callback ? message.printGroup(callback) : message;
  }

  function wipMessageSmall (message: string): ConsoleMessage {
    const messageStyle = {
      'font-weight': 'normal',
      'font-style': 'italic',
      'color': 'white',
    };
    return cmsg([CONSTRUCTION_SIGN_CHAR, WIP_LABEL_BOOKMARK, cmsg([message], messageStyle).spaceAround()])
      .appendToGroup(cmsg(new Error(`This error generated for purposes of capturing a stack trace`).stack))
      .collapseGroup();
  }

  function assert (test: boolean, message: ConsoleMessage.Content): ConsoleMessage | undefined {
    if (!test) return cmsg([ASSERTION_FAILURE_LABEL, ' ', message], {
      'padding': '5px 0',
      'font-weight': 'bold',
      'font-size': '18px',
      'color': Material.red[100],
      'background-color': darkBackgroundColor,
    });
  }
}
