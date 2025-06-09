import chalk from 'chalk';
import { multiplyHSL } from '../color/color-functions';
import { StaticColor } from '../color/static-color';
import type { ConsoleLogger } from '../facilities/logging';
import { isPlainObject, isString, isUndefined } from '../general/type-checking';
import { amber800, brown, brown700, colorizer, gray, gray400, gray700, gray800, gray900, lightBlue, lightBlue300, lime, orange, orange700, pink200, purple, red, red700, teal, yellow400 } from './colorizers';

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
      return (callerName: string | null, message: string, ...args: any[]) => {
        const callerNamePrefix = callerName ? `${brightColor(callerName)} | ` : '';
        log(subduedColor(`${icon}${_tag} | ${callerNamePrefix}${defaultColor(String(message))}`), ...args);
      };
    }
    else {
      return (callerName: string | null, message: string, ...args: any[]) => {
        const callerNamePrefix = callerName ? `${brightColor(callerName)} | ` : '';
        log(subduedColor(`${icon}${callerNamePrefix}${defaultColor(String(message))}`), ...args);
      };
    }
  };

  const brighten = (colorize: { color: string }) => colorizer(multiplyHSL(1, 1.5, 1.2, colorize.color));
  const subdue = (colorize: { color: string }) => colorizer(multiplyHSL(1, 0.5, 0.5, colorize.color));

  const errorDefault = taggedConsoleLogger({ defaultColor: red });
  const errorGrouped = taggedConsoleLogger({ defaultColor: red, log: console.group });
  export function error (callerName: string | null, message: string | Error, ...args: any[]) {
    if (message instanceof Error) {
      const error = message;
      message = error.message;
      errorGrouped(callerName, message);
      console.error(red700(error.stack));
      console.groupEnd();
      return;
    }
    if (args.length === 1 && args[0] instanceof Error) {
      const error = args[0];
      errorGrouped(callerName, message);
      console.error(red700(error.stack));
      console.groupEnd();
      return;
    }
    errorDefault(callerName, message, ...args);
  }
  export const critical = taggedConsoleLogger({ defaultColor: red, log: console.error });
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
    const defaultColor = purple;
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
    return (callerName: string | null, message: string, fields?: SRecord) => {
      if (!isPlainObject(fields)) return isUndefined(fields) ? log(callerName, message) : log(callerName, message, fields);
      group(callerName, message);
      logPlainObject(fields!);
      groupEnd();
    };
  })();
  export const group = Object.assign(taggedConsoleLogger({ defaultColor: gray700, brightColor: gray700, log: console.group }), {
    warn: taggedConsoleLogger({ defaultColor: orange, log: console.group }),
  });
  export const groupEnd = console.groupEnd;
  export const divider = () => console.log(gray700('------------------------------------------------------------------------------------------------------------------------'));

  export interface LoggerFactory {
    (callerName: string | { readonly name: string }): ConsoleLogger;
    // forModule (importMetaUrl: string): Logger;
  }
  const getCallerName = (caller?: string | { readonly name: string }) => isString(caller) ? caller : caller?.name ?? null;
  export const logger: LoggerFactory = Object.assign((caller?: string | { readonly name: string }): ConsoleLogger => ({
    fatal: (message: string, ...args: any[]) => error(getCallerName(caller), message, ...args),
    error: (message: string | Error, ...args: any[]) => error(getCallerName(caller), message, ...args),
    critical: (message: string, ...args: any[]) => critical(getCallerName(caller), message, ...args),
    problem: (message: string, ...args: any[]) => critical(getCallerName(caller), message, ...args),
    working: (message: string, ...args: any[]) => working(getCallerName(caller), message, ...args),
    good: (message: string, ...args: any[]) => good(getCallerName(caller), message, ...args),
    boring: (message: string, ...args: any[]) => boring(getCallerName(caller), message, ...args),
    info: (message: string, ...args: any[]) => info(getCallerName(caller), message, ...args),
    default: (message: string, ...args: any[]) => log(getCallerName(caller), message, ...args),
    verbose: (message: string, ...args: any[]) => verbose(getCallerName(caller), message, ...args),
    debug: (message: string, ...args: any[]) => debug(getCallerName(caller), message, ...args),
    warn: (message: string, ...args: any[]) => warn(getCallerName(caller), message, ...args),
    trace: (message: string, ...args: any[]) => trace(getCallerName(caller), message, ...args),
    todo: (message: string, fields?: SRecord) => todo(getCallerName(caller), message, fields),
    object: (value: any) => console.dir(value, { depth: null }),
    group: Object.assign((message: string, ...args: any[]) => group(getCallerName(caller), message, ...args), {
      warn: (message: string, ...args: any[]) => group.warn(getCallerName(caller), message, ...args),
    }),
    groupEnd,
    divider,
  }), {
    // forModule (importMetaUrl: string): Logger {
    //   let callerName: string | undefined;

    //   return logger({
    //     get name (): string {
    //       if (isUndefined(callerName)) {
    //         const rootDir = Path.resolve(ProcessEnv.PackageJsonDir, 'source');
    //         const modulePath = Path.relative(rootDir, Url.fileURLToPath(importMetaUrl)).replace('\\', '/');
    //         callerName = modulePath;
    //       }
    //       return callerName;
    //     },
    //   });
    // },
  });
}
