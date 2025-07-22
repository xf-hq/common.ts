import chalk from 'chalk';
import { multiplyHSL } from '../color/color-functions';
import { StaticColor } from '../color/static-color';
import { ConsoleLogger } from '../facilities/logging';
import { neverRegisterAsDisposed } from '../general/disposables';
import { isPlainObject, isString, isUndefined } from '../general/type-checking';
import { amber, amber800, colorizer, gray, gray400, gray700, gray800, gray900, lightBlue, lightBlue300, lime, orange, orange700, pink200, red, red700, teal, yellow400 } from './colorizers';

const SLATE = StaticColor.fromHex('#66757f');
const slate = colorizer(SLATE.hex);
const slateSubdued = colorizer(SLATE.darken(0.2).hex);
const slateBright = colorizer(SLATE.multiplyHSL(1, 1.2, 1.2).hex);

export namespace terminal {
  interface ConsoleMethodOptions {
    tag?: string;
    icon?: string;
    defaultColor: ((...args: any[]) => string) & { color: string };
    brightColor?: ((...args: any[]) => string) & { color: string };
    subduedColor?: ((...args: any[]) => string) & { color: string };
    log?: (...args: any[]) => void;
  }
  const taggedConsoleLogger = (options: ConsoleMethodOptions) => {
    const { tag, defaultColor, log = console.log } = options;
    const brightColor = options.brightColor ?? brighten(defaultColor);
    const subduedColor = options.subduedColor ?? subdue(defaultColor);
    const icon = options.icon ? `${options.icon} ` : '';
    if (tag) {
      const _tag = brightColor(tag ?? '');
      return (label: string | null, message: string, ...args: any[]) => {
        const callerNamePrefix = label ? `${brightColor(label)} | ` : '';
        log(subduedColor(`${icon}${_tag} | ${callerNamePrefix}${defaultColor(String(message))}`), ...args);
      };
    }
    else {
      return (label: string | null, message: string, ...args: any[]) => {
        const callerNamePrefix = label ? `${brightColor(label)} | ` : '';
        log(subduedColor(`${icon}${callerNamePrefix}${defaultColor(String(message))}`), ...args);
      };
    }
  };

  const brighten = (colorize: { color: string }) => colorizer(multiplyHSL(1, 1.5, 1.2, colorize.color));
  const subdue = (colorize: { color: string }) => colorizer(multiplyHSL(1, 0.5, 0.5, colorize.color));

  const errorDefault = taggedConsoleLogger({ defaultColor: red });
  const errorGrouped = taggedConsoleLogger({ defaultColor: red, log: console.group });
  export function error (label: string | null, message: string | Error, ...args: any[]) {
    if (message instanceof Error) {
      const error = message;
      message = error.message;
      errorGrouped(label, message);
      console.error(red700(error.stack));
      console.groupEnd();
      return;
    }
    if (args.length === 1 && args[0] instanceof Error) {
      const error = args[0];
      errorGrouped(label, message);
      console.error(red700(error.stack));
      console.groupEnd();
      return;
    }
    errorDefault(label, message, ...args);
  }
  export const critical = taggedConsoleLogger({ defaultColor: red, log: console.error });
  export const problem = taggedConsoleLogger({ defaultColor: red, icon: '‼️', log: console.log });
  export const working = taggedConsoleLogger({ defaultColor: amber800, log: console.info });
  export const warn = taggedConsoleLogger({ defaultColor: orange700, brightColor: orange700, icon: '⚠️', log: console.warn });
  export const info = taggedConsoleLogger({ defaultColor: lightBlue, log: console.info });
  export const good = taggedConsoleLogger({ defaultColor: lime, log: console.info });
  export const boring = taggedConsoleLogger({ defaultColor: gray700, brightColor: gray, subduedColor: gray900, log: console.info });
  export const verbose = taggedConsoleLogger({ defaultColor: slate, brightColor: slateBright, subduedColor: slateSubdued, log: console.info });
  export const log = taggedConsoleLogger({ defaultColor: gray400, log: console.log });
  export const debug = taggedConsoleLogger({ defaultColor: yellow400, log: console.debug });
  export const trace = taggedConsoleLogger({ defaultColor: teal, log: console.trace });
  export const todo = (() => {
    const defaultColor = amber;
    const log = taggedConsoleLogger({ tag: 'TODO', defaultColor, log: console.warn });
    const group = taggedConsoleLogger({ tag: 'TODO', defaultColor, log: console.group });
    const formatKey = (key: string) => gray800(`${lightBlue300(key)}:`);
    const logPlainObject = (fields: SRecord) => {
      for (const key in fields) {
        const rawValue = fields[key];
        let value: any;
        switch (typeof rawValue) {
          case 'string': value = chalk.italic(pink200(rawValue)); break;
          case 'object': {
            if (rawValue === null) { value = chalk.italic(gray800('null')); break; }
            if (isPlainObject(rawValue)) {
              console.group(`${formatKey(key)} ${gray(`{${gray800(`...`)}}`)}`);
              logPlainObject(rawValue);
              console.groupEnd();
              continue;
            }
          }
          default: value = rawValue; break;
        }
        console.log(formatKey(key), value);
      }
    };
    return (label: string | null, message: string, fields?: SRecord) => {
      if (!isPlainObject(fields)) return isUndefined(fields) ? log(label, message) : log(label, message, fields);
      group(label, message);
      logPlainObject(fields!);
      groupEnd();
    };
  })();
  export const group = Object.assign(taggedConsoleLogger({ defaultColor: gray700, brightColor: gray700, log: console.group }), {
    warn: taggedConsoleLogger({ defaultColor: orange, log: console.group }),
  });
  export const groupEnd = console.groupEnd;
  export const divider = () => console.log(gray700('-'.repeat(80)));
  export const blankLine = () => console.log('');

  export const unlabelledLogger: ConsoleLogger = {
    get unlabelled () { return unlabelledLogger; },
    fatal: (message: string, ...args: any[]) => error(null, message, ...args),
    error: (message: string | Error, ...args: any[]) => error(null, message, ...args),
    critical: (message: string, ...args: any[]) => critical(null, message, ...args),
    problem: (message: string, ...args: any[]) => problem(null, message, ...args),
    working: (message: string, ...args: any[]) => working(null, message, ...args),
    good: (message: string, ...args: any[]) => good(null, message, ...args),
    boring: (message: string, ...args: any[]) => boring(null, message, ...args),
    info: (message: string, ...args: any[]) => info(null, message, ...args),
    default: (message: string, ...args: any[]) => log(null, message, ...args),
    verbose: (message: string, ...args: any[]) => verbose(null, message, ...args),
    debug: (message: string, ...args: any[]) => debug(null, message, ...args),
    warn,
    trace,
    todo: (message: string, fields?: SRecord) => todo(null, message, fields),
    object (value) { console.dir(value); },
    group: ConsoleLogger.Group((message: string, ...args: any[]) => group(null, message, ...args), {
      warn: ConsoleLogger.Group.Warn((message: string, ...args: any[]) => group.warn(null, message, ...args), {
        endOnDispose: (message: string, ...args: any[]) => {
          group.warn(null, message, ...args);
          return GROUP_END;
        },
      }),
      endOnDispose: (message: string, ...args: any[]) => {
        group(null, message, ...args);
        return GROUP_END;
      },
    }),
    groupEnd,
    divider,
    blankLine,
  };

  export const logger: ConsoleLogger.Factory = (label?: string | { readonly name: string }): ConsoleLogger => {
    const getLabel = label ? isString(label) ? () => label : () => label.name : () => null;
    const logger: ConsoleLogger = {
      get unlabelled () { return unlabelledLogger; },
      fatal: (message: string, ...args: any[]) => error(getLabel(), message, ...args),
      error: (message: string | Error, ...args: any[]) => error(getLabel(), message, ...args),
      critical: (message: string, ...args: any[]) => critical(getLabel(), message, ...args),
      problem: (message: string, ...args: any[]) => critical(getLabel(), message, ...args),
      working: (message: string, ...args: any[]) => working(getLabel(), message, ...args),
      good: (message: string, ...args: any[]) => good(getLabel(), message, ...args),
      boring: (message: string, ...args: any[]) => boring(getLabel(), message, ...args),
      info: (message: string, ...args: any[]) => info(getLabel(), message, ...args),
      default: (message: string, ...args: any[]) => log(getLabel(), message, ...args),
      verbose: (message: string, ...args: any[]) => verbose(getLabel(), message, ...args),
      debug: (message: string, ...args: any[]) => debug(getLabel(), message, ...args),
      warn: (message: string, ...args: any[]) => warn(getLabel(), message, ...args),
      trace: (message: string, ...args: any[]) => trace(getLabel(), message, ...args),
      todo: (message: string, fields?: SRecord) => todo(getLabel(), message, fields),
      object: (value: any) => console.dir(value, { depth: null }),
      group: ConsoleLogger.Group((message: string, ...args: any[]) => group(getLabel(), message, ...args), {
        warn: ConsoleLogger.Group.Warn((message: string, ...args: any[]) => group.warn(getLabel(), message, ...args), {
          endOnDispose: (message: string, ...args: any[]) => {
            group.warn(getLabel(), message, ...args);
            return GROUP_END;
          },
        }),
        endOnDispose: (message: string, ...args: any[]) => {
          group(getLabel(), message, ...args);
          return GROUP_END;
        },
      }),
      groupEnd,
      divider,
      blankLine,
    };
    return logger;
  };

  const GROUP_END: Disposable = neverRegisterAsDisposed({ [Symbol.dispose]: () => groupEnd() });
}
