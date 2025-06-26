import { setLightness } from '../../color/color-functions';
import { Material } from '../../color/material';
import { isArray, isDefined, isFunction, isNonZeroLengthString, isObject, isString, isSymbol, isUndefined } from '../../general/type-checking';
import { defineGetter } from '../../primitive';
import { ConsoleMessage, cmsg } from './console-message';
import { ConsoleNotes } from './console-notes';

const COLLAPSE_RECURRING_TODO_LISTS = false;

let once: string | null = null;
let labelToUse: ConsoleMessage | null = null;
let silent = false;
let deferredToNextTick = false;
let delay: number = -1;
const queueProcessingScheduled = false;
const queue: ConsoleMessage[] = [];
const alreadyLogged = new Set<string>();
const isExpandedOnce = new Map<string, boolean>();

export type TODO = typeof TODO;
export function TODO (message?: string | ConsoleMessage | (ConsoleMessage | string)[], optionalBulletPoints?: ConsoleNotes.ContentItemOrList): boolean;
export function TODO (message?: string | ConsoleMessage | (ConsoleMessage | string)[], ...args: any[]): boolean;
export function TODO (message?: string | ConsoleMessage | (ConsoleMessage | string)[], ...args: any[]) {
  if (silent) {
    silent = false;
    return false;
  }
  if (once) {
    const skip = alreadyLogged.has(once);
    if (!skip) alreadyLogged.add(once);
    once = null;
    if (skip) {
      deferredToNextTick = false;
      delay = -1;
      return false;
    }
  }
  let label: ConsoleMessage;
  if (labelToUse) {
    label = labelToUse;
    labelToUse = null;
  }
  else {
    label = TODO_LABEL;
  }
  const parts: any[] = [label];
  let mustCollapse = false;
  if (isDefined(message)) {
    if (isString(message)) {
      message = ConsoleNotes.createStandaloneMessage(message);
      mustCollapse = message.isCollapsed;
    }
    else if (isArray(message)) {
      const last = message[message.length - 1];
      if (isString(last)) {
        message = message.slice(0, -1);
        const tail = ConsoleNotes.createStandaloneMessage(last);
        mustCollapse = tail.isCollapsed;
        message.push(tail);
      }
    }
    else {
      mustCollapse = message.isCollapsed;
      message = ConsoleMessage(message, ROOT_MESSAGE_STYLE);
    }
    parts.push(message);
  }
  const msg = ConsoleMessage(parts);
  let optionalBulletPoints: ConsoleNotes.ContentList | undefined;
  if (args.length > 0) {
    if (args.length === 1) {
      const arg = args[0];
      if (ConsoleNotes.isContentList(arg)) {
        optionalBulletPoints = arg;
      }
    }
    if (isUndefined(optionalBulletPoints)) {
      msg.args(...args);
    }
    else {
      if (COLLAPSE_RECURRING_TODO_LISTS) {
        const hash = JSON.stringify([message, optionalBulletPoints]);
        if (!isExpandedOnce.has(hash)) {
          isExpandedOnce.set(hash, true);
        }
        else {
          mustCollapse = true;
        }
      }
      ConsoleNotes.appendToExistingMessage(msg, optionalBulletPoints);
    }
  }
  if (mustCollapse) msg.collapseGroup();
  if (deferredToNextTick) {
    deferredToNextTick = false;
    queue.push(msg);
    if (!queueProcessingScheduled) queueMicrotask(() => {
      do {
        const msg = queue.shift()!;
        msg.print();
      }
      while (queue.length > 0);
    });
    return false;
  }
  if (delay >= 0) {
    setTimeout(() => msg.print(), delay);
    delay = -1;
    return false;
  }
  msg.print();
  // if (message || (optionalBulletPoints && optionalBulletPoints.length > 0)) {
  //   DeveloperAssistant.addHardCodedTodoMessage(message ?? '', optionalBulletPoints);
  // }
  return true;
}
export namespace TODO {
  export type Params = [message?: string | ConsoleMessage | (ConsoleMessage | string)[], optionalBulletPoints?: ConsoleNotes.ContentList];

  export declare const Silent: TODO;
  defineGetter(TODO, 'Silent', () => { silent = true; return TODO; });

  export declare const Once: TODO;
  defineGetter(TODO, 'Once', () => {
    once = new Error().stack!.split('\n')[2];
    once = /\((.*)\)/.exec(once)![1]; // We only want the file location/column/line reference. Other details can vary and therefore need to be stripped out.
    return TODO;
  });

  export declare const WIP: TODO;
  defineGetter(TODO, 'WIP', () => { labelToUse = WIP_LABEL; return TODO; });

  export declare const NotImplemented: TODO;
  defineGetter(TODO, 'NotImplemented', () => { labelToUse = NOT_IMPLEMENTED_LABEL; return TODO; });

  export declare const NextTick: TODO;
  defineGetter(TODO, 'NextTick', () => { deferredToNextTick = true; return TODO; });

  export declare const Delay50: TODO;
  export declare const Delay100: TODO;
  export declare const Delay250: TODO;
  export declare const Delay500: TODO;
  export declare const Delay1000: TODO;
  defineGetter(TODO, 'Delay50', () => { delay = 50; return TODO; });
  defineGetter(TODO, 'Delay100', () => { delay = 100; return TODO; });
  defineGetter(TODO, 'Delay250', () => { delay = 250; return TODO; });
  defineGetter(TODO, 'Delay500', () => { delay = 500; return TODO; });
  defineGetter(TODO, 'Delay1000', () => { delay = 1000; return TODO; });
  export function Delay (delayms: number): TODO {
    if (delayms < 0) delayms = -1;
    delay = delayms;
    return TODO;
  }

  type Subject = string | AnyFunctionOrAbstractConstructor | object;
  const nameOf = (target: Subject) => isFunction(target) ? target.name : isString(target) ? target : target.constructor.name;

  export function Custom (label: string, callback: () => void) {
    cmsg.group([TODO_LABEL, DomainName(nameOf(label), { 'padding-left': PADDING })], callback);
  }

  export function InDomain (name: Subject | [name: Subject, ...subcontext: Subject[]], optionalBulletPoints?: ConsoleNotes.ContentItemOrList): void;
  export function InDomain (name: Subject | [name: Subject, ...subcontext: Subject[]], bulletPoints: string[]): void;
  export function InDomain (name: Subject | [name: Subject, ...subcontext: Subject[]], message: string, optionalBulletPoints?: ConsoleNotes.ContentItemOrList): void;
  export function InDomain (name: Subject | [name: Subject, ...subcontext: Subject[]], message: string | ConsoleNotes.ContentItemOrList | null, ...args: any[]): void;
  export function InDomain (nameOrPath: Subject | [name: Subject, ...subcontext: Subject[]], message?: string | ConsoleNotes.ContentItemOrList | null, ...args: any[]) {
    if (isString(nameOrPath)) nameOrPath = [nameOrPath];
    if (!isArray(nameOrPath)) nameOrPath = nameOf(nameOrPath);
    const content: (ConsoleMessage | string)[] = [];
    const style: any = { 'padding-left': PADDING };
    if (nameOrPath.length === 1) style['padding-right'] = PADDING;
    if (isArray(nameOrPath)) {
      let element = nameOrPath[0];
      let name = nameOf(element);
      content.push(DomainName(name, style));
      if (nameOrPath.length > 1) {
        for (let i = 1; i < nameOrPath.length; i++) {
          const previousElement = element;
          const previousName = name;
          element = nameOrPath[i];
          name = nameOf(element);
          const isMethod = i === nameOrPath.length - 1 && isFunction(element) && isMethodOf(previousElement, element);
          if (isMethod) {
            content.pop();
            content.push(MethodCall(previousName, name));
          }
          else {
            content.push(SUBPATH_SEPARATOR);
            if (i === nameOrPath.length - 1) content.push(SubsectionName(name, { 'padding-right': PADDING }));
            else content.push(SubsectionName(name));
          }
        }
      }
    }
    else {
      content.push(DomainName(nameOrPath, style));
    }
    content.push(' ');

    if (isNonZeroLengthString(message)) {
      content.push(message);
    }
    else if (isArray(message) && message.length > 0) {
      args = [message];
    }
    TODO(content, ...args);
  }

  export function InFunction (fn: AnyFunctionOrAbstractConstructor, optionalBulletPoints?: ConsoleNotes.ContentItemOrList): void;
  export function InFunction (fn: Subject, bulletPoints: string[]): void;
  export function InFunction (fn: Subject, message: string, optionalBulletPoints?: ConsoleNotes.ContentItemOrList): void;
  export function InFunction (fn: Subject, message: string | ConsoleNotes.ContentItemOrList | null, ...args: any[]): void;
  export function InFunction (fn: Subject, message?: string | ConsoleNotes.ContentItemOrList | null, ...args: any[]) {
    const parts: (ConsoleMessage | string)[] = [FunctionCall(nameOf(fn))];
    if (isNonZeroLengthString(message)) {
      parts.push(message);
    }
    else if (isArray(message) && message.length > 0) {
      args = [message];
    }
    TODO(parts, ...args);
  }

  export function InMethod (object: object | Subject, method: AnyFunctionOrAbstractConstructor | symbol | string, optionalBulletPoints?: ConsoleNotes.ContentItemOrList): void;
  export function InMethod (object: object | Subject, method: AnyFunctionOrAbstractConstructor | symbol | string, message?: string, optionalBulletPoints?: ConsoleNotes.ContentItemOrList): void;
  export function InMethod (object: object | Subject, method: AnyFunctionOrAbstractConstructor | symbol | string, message?: string, ...args: any[]): void;
  export function InMethod () {
    const todoArgs = InMethod.toArgsOnly.apply(null, arguments);
    TODO(...todoArgs);
  }
  export namespace InMethod {
    export function toArgsOnly (object: object | Subject, method: AnyFunctionOrAbstractConstructor | symbol | string, optionalBulletPoints?: ConsoleNotes.ContentItemOrList): TODO.Params;
    export function toArgsOnly (object: object | Subject, method: AnyFunctionOrAbstractConstructor | symbol | string, message?: string, optionalBulletPoints?: ConsoleNotes.ContentItemOrList): TODO.Params;
    export function toArgsOnly (object: object | Subject, method: AnyFunctionOrAbstractConstructor | symbol | string, message?: string, ...args: any[]): TODO.Params;
    export function toArgsOnly (object: object | Subject, method: AnyFunctionOrAbstractConstructor | symbol | string, message?: string | ConsoleNotes.ContentItemOrList, ...args: any[]) {
      const parts: (ConsoleMessage | string)[] = [];
      if (isFunction(object)) object = object.name;
      if (isObject(object) && object.constructor === method) {
        // The method is the object's constructor.
        parts.push(ObjectName(method.name), RIGHT_ARROW, CONSTRUCTOR, PARENTHESES);
      }
      else {
        const objectName = isString(object) ? object : object.constructor.name;
        parts.push(ObjectName(objectName));
        if (isSymbol(method)) {
          parts.push(Punctuated(['[', MethodName(method.description ?? 'Symbol'), ']']));
        }
        else {
          const methodName = isString(method) ? method : method.name;
          parts.push(PERIOD, MethodName(methodName));
        }
        parts.push(PARENTHESES);
      }
      if (message) {
        // If it's an array, then it's a bullet list or an array of tail args, so we need to move it to the args array and try again.
        if (isArray(message)) args.unshift(message);
        else parts.push(message);
      }
      else if (arguments.length === 2) {
        args.unshift(`Requires implementation.`);
      }
      return [parts, ...args];
    }
  }

  function isMethodOf (object: string | object, method: string | symbol | AnyFunctionOrAbstractConstructor) {
    if (isString(object)) return false;
    if (isFunction(method)) {
      return isFunction(object[method.name]);
    }
    // TypeScript isn't properly narrowing here, so we need to be explicit
    const methodKey = method as string | symbol;
    return isFunction(object[methodKey]);
  }

  const PADDING = '5px';
  const BGCOLOR = '#00000066';
  const OBJECT_COLOR = Material.amber[300];
  const METHOD_COLOR = Material.red[300];
  const CONSTRUCTOR_COLOR = Material.blueGray[500];
  const PUNCTUATION_COLOR = Material.blueGray[700];

  const PUNCTUATION_STYLE: Record<string, any> = {
    'font-weight': 'bold',
    'color': PUNCTUATION_COLOR,
    'background-color': BGCOLOR,
  };
  const Punctuated = cmsg.factory(PUNCTUATION_STYLE);

  const ObjectName = cmsg.factory({
    'padding-left': PADDING,
    'font-weight': 'bold',
    'color': OBJECT_COLOR,
    'background-color': BGCOLOR,
  });
  const PERIOD = Punctuated('.');
  const RIGHT_ARROW = Punctuated(' → ', { 'font-weight': 'normal' });
  const CONSTRUCTOR = cmsg('constructor', {
    'font-weight': 'normal',
    'color': CONSTRUCTOR_COLOR,
    'background-color': BGCOLOR,
  });
  const MethodName = cmsg.factory({
    'font-weight': 'bold',
    'color': METHOD_COLOR,
    'background-color': BGCOLOR,
  });
  const FunctionName = cmsg.factory({
    'padding-left': PADDING,
    'font-weight': 'bold',
    'color': METHOD_COLOR,
    'background-color': BGCOLOR,
  });
  const FunctionCall = (name: string) => ConsoleMessage([FunctionName(name), PARENTHESES]);
  const MethodCall = (objectName: string, methodName: string) => ConsoleMessage([ObjectName(objectName), PERIOD, MethodName(methodName), PARENTHESES]);
  const DomainName = cmsg.factory({
    'font-weight': 'bold',
    'color': OBJECT_COLOR,
    'background-color': BGCOLOR,
  });
  const SubsectionName = cmsg.factory({
    'font-weight': 'bold',
    'color': METHOD_COLOR,
    'background-color': BGCOLOR,
  });
  const SUBPATH_SEPARATOR = Punctuated(' / ');
  const PARENTHESES = Punctuated('()').spaceRight();

  let wordWrapWidth = 0;
  export function getWordWrapWidth () {
    return wordWrapWidth;
  }
  export function configureWordWrap (widthInChars: number) {
    wordWrapWidth = widthInChars;
  }
}

const BASE_LABEL_STYLES = {
  'font-weight': 'bold',
  'padding': '0 5px',
  'margin-right': '5px',
};
const TODO_LABEL = ConsoleMessage(`TODO`, {
  ...BASE_LABEL_STYLES,
  'color': Material.red,
  'background-color': '#00000099',
});
const CONSTRUCTION_SIGN_CHAR = '\u{1F6A7}';
const WIP_LABEL = ConsoleMessage([CONSTRUCTION_SIGN_CHAR, ConsoleMessage(`WIP`, {
  ...BASE_LABEL_STYLES,
  'font-size': '18px',
  'color': Material.amber,
  'background-color': setLightness(0.11, Material.red[500]),
})], {
  'font-size': '18px',
  'padding': '0 2px',
  'background-color': '#000000',
});
const NOT_IMPLEMENTED_LABEL = ConsoleMessage(`Not Implemented`, {
  ...BASE_LABEL_STYLES,
  'color': Material.red,
  'background-color': '#00000099',
});

const ROOT_MESSAGE_STYLE: Record<string, any> = {
  'color': Material.yellow[100],
  'font-weight': 'bold',
};
