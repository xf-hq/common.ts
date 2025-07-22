import { neverRegisterAsDisposed, noopDispose } from '../general/disposables';

export interface ConsoleLogger {
  readonly unlabelled: ConsoleLogger;

  /** For when we want to indicate that a process-ending event has occurred that is not necessarily the result of an error having been thrown. */
  fatal: (message: string, ...args: any[]) => void;
  /** Analogous to `console.error`. Prints a stack trace after the message. */
  error: (message: string | Error, ...args: any[]) => void;
  /** For when we want a non-error message to be presented with similar prominence to an error message. */
  critical: (message: string, ...args: any[]) => void;
  /** More severe than `warn` but less severe than `critical` or `error`. If differentiation is not required, treat this as an alias for `critical`. */
  problem: (message: string, ...args: any[]) => void;
  /** For when we want to present a message indicating that significant work is being performed that will most likely have a noteworthy effect on persistent state. */
  working: (message: string, ...args: any[]) => void;
  /** For when we want to present an informational message that indicates a positive outcome of some kind. */
  good: (message: string, ...args: any[]) => void;
  /** Some log level as `info`, but displayed in a subdued style. */
  boring: (message: string, ...args: any[]) => void;
  /** For messages */
  info: (message: string, ...args: any[]) => void;
  /** Equivalent role to `console.log`. In most cases other logger methods should be preferred over this one. */
  default: (message: string, ...args: any[]) => void;
  /** For messages that provide details that typically don't warrant user attention, but which are not merely intended to assist with debugging. */
  verbose: (message: string, ...args: any[]) => void;
  /** For temporary messages intended to assist with debugging. */
  debug: (message: string, ...args: any[]) => void;
  /** Analogous to `console.warn`. */
  warn: (message: string, ...args: any[]) => void;
  /** Analogous to `console.trace`. Prints a stack trace after the message. */
  trace: (message: string, ...args: any[]) => void;
  /** For messages intended to indicate that some part of the implementation is incomplete. */
  todo: (message: string, fields?: SRecord) => void;
  /** For printing an object to the console. */
  object: (value: any) => void;
  group: ConsoleLogger.Group;
  groupEnd: () => void;
  divider: () => void;
  blankLine: () => void;
}
export namespace ConsoleLogger {
  export interface Factory {
    /**
     * @param topic If provided, the returned logger should prefix all messages with the given topic. If a function or
     * other object with a `name` property is provided, the logger should use the value of that property as the topic.
     */
    (topic?: string | { readonly name: string }): ConsoleLogger;
  }

  export function Group (func: Group.Func, props: Group.Props): Group {
    return Object.assign(func, props);
  }
  export interface Group extends Group.Func, Group.Props {}
  export namespace Group {
    export interface Func {
      (message: string, ...args: any[]): void;
    }
    export interface Props {
      warn: (message: string, ...args: any[]) => void;
      endOnDispose: (message: string, ...args: any[]) => Disposable;
    }
  }
}

/**
 * `LogLevel` is not enforced at this level, nor is it mandated that log levels must be respected by any given
 * `ConsoleLogger` implementation. This union of `LogLevel` types is exposed as a convenience for other code to make
 * use of as needed. It is up to the implementer of a given body of code to decide when and where to offer the option
 * to specify a log level, and in doing so, to implement logic to screen logging calls accordingly.
 */
export type ConsoleLogLevel =
  | ConsoleLogLevel.Debug
  | ConsoleLogLevel.Expanded
  | ConsoleLogLevel.Normal
  | ConsoleLogLevel.Reduced
  | ConsoleLogLevel.Silent
;
export namespace ConsoleLogLevel {
  /**
   * Debugging messages. These are not intended to be seen by end users, but rather to assist developers in
   * understanding the flow of execution and the state of the application at various points.
   */
  export const Debug = 'debug';
  export type Debug = typeof Debug;
  /**
   * More extensive logging than we'd want to see normally. Should provide more visibility into what's happening, but
   * only to the extent that the information would make sense to whoever the log message is being presented to.
   */
  export const Expanded = 'expanded';
  export type Expanded = typeof Expanded;

  /**
   * Normal logging. This is the default log level for most log messages that we'd want to see under normal
   * circumstances.
   */
  export const Normal = 'normal';
  export type Normal = typeof Normal;

  /**
   * Reduced logging. Typically this means "avoid logging except when there is something of significance to report".
   */
  export const Reduced = 'reduced';
  export type Reduced = typeof Reduced;

  /**
   * No logging at all. When this log level is requested, no log messages should be printed to the console.
   */
  export const Silent = 'silent';
  export type Silent = typeof Silent;

  /**
   *
   */
  export function evaluate (logLevel: ConsoleLogLevel): number {
    switch (logLevel) {
      case ConsoleLogLevel.Silent: return 0;
      case ConsoleLogLevel.Reduced: return 1;
      case ConsoleLogLevel.Normal: return 2;
      case ConsoleLogLevel.Expanded: return 3;
      case ConsoleLogLevel.Debug: return 4;
      default: throw new Error(`Unknown log level: ${logLevel}`);
    }
  }
}

/**
 * @param implementedLogLevel An implementation-defined level of significance that the implementer considers the
 *   prospective logging operation to have.
 * @param requestedLogLevel The requested logging level that the call site is attempting to take into account relative
 *   to the significance it is assigning to a prospective logging operation.
 * @returns `true` if the logging operation should proceed, or `false` if it should be skipped.
 */
export function shouldLog (implementedLogLevel: Exclude<ConsoleLogLevel, ConsoleLogLevel.Silent>, requestedLogLevel: ConsoleLogLevel): boolean {
  return ConsoleLogLevel.evaluate(implementedLogLevel) <= ConsoleLogLevel.evaluate(requestedLogLevel);
}
/**
 * Intended to make it easier to conditionally log messages without worrying about wasting resources on constructing
 * intermediate references that won't actually be used.
 * @param logger The logger to return if the logging operation should proceed.
 * @param minimumLogLevel An implementation-defined level of significance that the implementer considers the
 *   prospective logging operation to have.
 * @param requestedLogLevel The requested logging level that the call site is attempting to take into account relative
 *   to the significance it is assigning to a prospective logging operation.
 * @returns The `logger` argument if logging should proceed, or `undefined` if it should not.
 * @example
 * ```ts
 * // Nullish coalescing ensures that the expensive part of the call is never evaluated unnecessarily.
 * maybeLog(logger, 'debug', 'normal')?.debug('Foo', { 'some object that is expensive': 'to construct' });
 * ```
 */
export function maybeLog (
  logger: ConsoleLogger,
  minimumLogLevel: Exclude<ConsoleLogLevel, ConsoleLogLevel.Silent>,
  requestedLogLevel: ConsoleLogLevel,
): ConsoleLogger | undefined {
  return shouldLog(minimumLogLevel, requestedLogLevel) ? logger : undefined;
}

export function maybeLogWith (
  logger: ConsoleLogger,
  minimumLogLevel: Exclude<ConsoleLogLevel, ConsoleLogLevel.Silent>,
  requestedLogLevel: ConsoleLogLevel,
): undefined | ((doLogging: (logger: ConsoleLogger) => void) => void) {
  if (shouldLog(minimumLogLevel, requestedLogLevel)) {
    return (doLogging: (logger: ConsoleLogger) => void) => {
      doLogging(logger);
    };
  }
}

export const SILENT_CONSOLE_LOGGER: ConsoleLogger = {
  get unlabelled () { return SILENT_CONSOLE_LOGGER; },
  fatal: () => {},
  error: () => {},
  critical: () => {},
  problem: () => {},
  working: () => {},
  good: () => {},
  boring: () => {},
  info: () => {},
  default: () => {},
  verbose: () => {},
  debug: () => {},
  warn: () => {},
  trace: () => {},
  todo: () => {},
  object: () => {},
  group: ConsoleLogger.Group(() => {}, {
    warn: () => {},
    endOnDispose: () => noopDispose,
  }),
  groupEnd: () => {},
  divider: () => {},
  blankLine: () => {},
};

const DEFAULT_GROUP_END: Disposable = neverRegisterAsDisposed({
  [Symbol.dispose] () { console.groupEnd(); },
});
export const DEFAULT_CONSOLE_LOGGER = new class DefaultConsoleLogger implements ConsoleLogger {
  get unlabelled () { return this; }
  fatal = console.error;
  error = console.error;
  critical = console.error;
  problem = console.error;
  working = console.info;
  good = console.info;
  boring = console.info;
  info = console.info;
  default = console.log;
  verbose = console.debug;
  debug = console.debug;
  warn = console.warn;
  trace = console.trace;
  todo = (message: string, fields?: SRecord) => {
    console.warn(`TODO: ${message}`, ...fields ? [fields] : []);
  };
  object = (value: any) => {
    console.dir(value, { depth: null, colors: true, compact: true });
  };
  group = ConsoleLogger.Group((message: string, ...args: any[]) => {
    console.group(message, ...args);
  }, {
    warn: (message: string, ...args: any[]) => {
      console.groupCollapsed(`⚠️ ${message}`, ...args);
    },
    endOnDispose: (message: string, ...args: any[]) => {
      console.group(message, ...args);
      return DEFAULT_GROUP_END;
    },
  });
  groupEnd = () => {
    console.groupEnd();
  };
  divider = (() => {
    const divider = '─'.repeat(80);
    return () => console.log(divider);
  })();
  blankLine = () => console.log('');
};

export class LabelledDefaultConsoleLogger implements ConsoleLogger {
  constructor (private readonly label: string) {}
  private formatMessage (message: string): string {
    return `${this.label} | ${message}`;
  }

  get unlabelled () { return DEFAULT_CONSOLE_LOGGER; }

  fatal (message: string, ...args: any[]) { DEFAULT_CONSOLE_LOGGER.fatal(this.formatMessage(message), ...args); }
  error (message: string | Error, ...args: any[]) {
    if (typeof message === 'string') {
      DEFAULT_CONSOLE_LOGGER.error(this.formatMessage(message), ...args);
    }
    else {
      DEFAULT_CONSOLE_LOGGER.error(`${this.label}:`, message, ...args);
    }
  }
  critical (message: string, ...args: any[]) { DEFAULT_CONSOLE_LOGGER.critical(this.formatMessage(message), ...args); }
  problem (message: string, ...args: any[]) { DEFAULT_CONSOLE_LOGGER.problem(this.formatMessage(message), ...args); }
  working (message: string, ...args: any[]) { DEFAULT_CONSOLE_LOGGER.working(this.formatMessage(message), ...args); }
  good (message: string, ...args: any[]) { DEFAULT_CONSOLE_LOGGER.good(this.formatMessage(message), ...args); }
  boring (message: string, ...args: any[]) { DEFAULT_CONSOLE_LOGGER.boring(this.formatMessage(message), ...args); }
  info (message: string, ...args: any[]) { DEFAULT_CONSOLE_LOGGER.info(this.formatMessage(message), ...args); }
  default (message: string, ...args: any[]) { DEFAULT_CONSOLE_LOGGER.default(this.formatMessage(message), ...args); }
  verbose (message: string, ...args: any[]) { DEFAULT_CONSOLE_LOGGER.verbose(this.formatMessage(message), ...args); }
  debug (message: string, ...args: any[]) { DEFAULT_CONSOLE_LOGGER.debug(this.formatMessage(message), ...args); }
  warn (message: string, ...args: any[]) { DEFAULT_CONSOLE_LOGGER.warn(this.formatMessage(message), ...args); }
  trace (message: string, ...args: any[]) { DEFAULT_CONSOLE_LOGGER.trace(this.formatMessage(message), ...args); }
  todo (message: string, fields?: SRecord) { DEFAULT_CONSOLE_LOGGER.todo(this.formatMessage(message), fields); }
  object = (value: any) => DEFAULT_CONSOLE_LOGGER.object(value);

  group = ConsoleLogger.Group((message: string, ...args: any[]) => {
    DEFAULT_CONSOLE_LOGGER.group(`[${this.label}] ${message}`, ...args);
  }, {
    warn: (message: string, ...args: any[]) => {
      DEFAULT_CONSOLE_LOGGER.group.warn(`[${this.label}] ⚠️ ${message}`, ...args);
    },
    endOnDispose: (message: string, ...args: any[]) => {
      return DEFAULT_CONSOLE_LOGGER.group.endOnDispose(`[${this.label}] ${message}`, ...args);
    },
  });
  groupEnd = () => DEFAULT_CONSOLE_LOGGER.groupEnd();
  divider = () => DEFAULT_CONSOLE_LOGGER.divider();
  blankLine = () => DEFAULT_CONSOLE_LOGGER.blankLine();
}
