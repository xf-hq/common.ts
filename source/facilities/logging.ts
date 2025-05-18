export interface ConsoleLogger {
  /** For when we want to indicate that a process-ending event has occurred that is not necessarily the result of an error having been thrown. */
  fatal: (message: string, ...args: any[]) => void;
  /** Analogous to `console.error`. Prints a stack trace after the message. */
  error: (message: string | Error, ...args: any[]) => void;
  /** For when we want a non-error message to be presented with similar prominence to an error message. */
  critical: (message: string, ...args: any[]) => void;
  /** Alias for `critical`. */
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
  group: {
    (message: string, ...args: any[]): void;
    warn: (message: string, ...args: any[]) => void;
  };
  groupEnd: () => void;
  divider: () => void;
}

export const DEFAULT_CONSOLE_LOGGER = new class DefaultConsoleLogger implements ConsoleLogger {
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
  group = Object.assign((message: string, ...args: any[]) => {
    console.group(message, ...args);
  }, {
    warn: (message: string, ...args: any[]) => {
      console.groupCollapsed(`⚠️ ${message}`, ...args);
    },
  });
  groupEnd = () => {
    console.groupEnd();
  };
  divider = (() => {
    const divider = '─'.repeat(80);
    return () => console.log(divider);
  })();
};

export class TaggedDefaultConsoleLogger implements ConsoleLogger {
  constructor (private readonly tag: string) {}
  private formatMessage (message: string): string {
    return `${this.tag} | ${message}`;
  }

  fatal (message: string, ...args: any[]) { DEFAULT_CONSOLE_LOGGER.fatal(this.formatMessage(message), ...args); }
  error (message: string | Error, ...args: any[]) {
    if (typeof message === 'string') {
      DEFAULT_CONSOLE_LOGGER.error(this.formatMessage(message), ...args);
    }
    else {
      DEFAULT_CONSOLE_LOGGER.error(`${this.tag}:`, message, ...args);
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

  group = Object.assign((message: string, ...args: any[]) => {
    DEFAULT_CONSOLE_LOGGER.group(`[${this.tag}] ${message}`, ...args);
  }, {
    warn: (message: string, ...args: any[]) => {
      DEFAULT_CONSOLE_LOGGER.group.warn(`[${this.tag}] ⚠️ ${message}`, ...args);
    },
  });
  groupEnd = () => DEFAULT_CONSOLE_LOGGER.groupEnd();
  divider = () => DEFAULT_CONSOLE_LOGGER.divider();
}
