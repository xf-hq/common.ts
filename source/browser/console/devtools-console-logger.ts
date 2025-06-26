import { ConsoleLogger } from '../../facilities/logging';
import { isString, isUndefined } from '../../general/type-checking';
import { cmsg, ConsoleMessage } from './console-message';

export const DevtoolsLogger: ConsoleLogger.Factory = (label?: string | { readonly name: string }): ConsoleLogger => {
  return new DevtoolsConsoleLabelledLogger(label);
};

class DevtoolsConsoleLabelledLogger implements ConsoleLogger {
  constructor (label: string | { readonly name: string } | undefined) {
    this.#label = isUndefined(label) ? '' : cmsg.std.label.teal(isString(label) ? label : label.name);
  }
  readonly #label: ConsoleMessage | string;

  fatal (message: string, ...args: any[]): void {
    cmsg([this.#label, cmsg.std.mc.red(message)]).args(...args).print();
  }
  error (message: string | Error, ...args: any[]): void {
    if (isString(message)) {
      cmsg([cmsg.std.mc.red(message)]).args(...args).print();
    }
    else {
      cmsg([cmsg.std.mc.red(message.message)]).args(...args).collapseGroup().printGroup(() => {
        console.error(message);
      });
    }
  }
  critical (message: string, ...args: any[]): void {
    cmsg([this.#label, cmsg.std.mc.red(['🛑 ', message])]).args(...args).print();
  }
  problem (message: string, ...args: any[]): void {
    cmsg([this.#label, cmsg.std.mc.deepOrange(['🚨 ', message])]).args(...args).print();
  }
  working (message: string, ...args: any[]): void {
    cmsg([this.#label, cmsg.std.mc.amber(['⚙️ ', message])]).args(...args).print();
  }
  good (message: string, ...args: any[]): void {
    cmsg([this.#label, cmsg.std.mc.green(['✅ ', message])]).args(...args).print();
  }
  boring (message: string, ...args: any[]): void {
    cmsg([this.#label, cmsg.std.mc.brown(message)]).args(...args).print();
  }
  info (message: string, ...args: any[]): void {
    cmsg([this.#label, cmsg.std.mc.blue('🛈').spaceAround(), message]).args(...args).print();
  }
  default (message: string, ...args: any[]): void {
    cmsg([this.#label, message]).args(...args).print();
  }
  verbose (message: string, ...args: any[]): void {
    cmsg([this.#label, cmsg.std.mc.gray[600](message)]).args(...args).print();
  }
  debug (message: string, ...args: any[]): void {
    cmsg([this.#label, cmsg.std.mc.pink(message)]).args(...args).print();
  }
  warn (message: string, ...args: any[]): void {
    cmsg([this.#label, cmsg.std.mc.yellow(['⚠️ ', message])]).args(...args).print();
  }
  trace (message: string, ...args: any[]): void {
    cmsg([this.#label, cmsg.std.mc.blueGray(message)]).args(...args).print();
  }
  todo (message: string, fields?: SRecord): void {
    const msg = cmsg([this.#label, cmsg.std.label.purple('TODO'), message]);
    if (fields) msg.collapseGroup().printGroup(() => console.dir(fields));
    else msg.print();
  }
  object (value: any): void {
    console.dir(value);
  }
  group = ConsoleLogger.Group((message: string, ...args: any[]) => {
    cmsg([this.#label, message]).args(...args).setMode('group').beginPrint();
  }, {
    warn (message, ...args) {
      cmsg([this.#label, cmsg.std.mc.yellow(['⚠️ ', message])]).args(...args).setMode('group').collapseGroup().beginPrint();
    },
    endOnDispose (message, ...args) {
      const msg = cmsg([this.#label, message]).args(...args).setMode('group').beginPrint();
      return {
        [Symbol.dispose]: () => msg.endPrint(),
      };
    },
  });
  groupEnd (): void {
    ConsoleMessage.groupEnd();
  }
  divider (): void {
    cmsg.std.mc.teal([this.#label, '―――――― ―――――― ―――――― ―――――― ―――――― ―――――― ―――――― ――――――']).print();
  }
}
