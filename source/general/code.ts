import { ModuleKind, ScriptTarget, transpileModule } from 'typescript';
import * as VM from 'node:vm';
import { isNothing } from './type-checking';

export type ReservedWord = 'await' | 'break' | 'case' | 'catch' | 'class' | 'const' | 'continue' | 'debugger' | 'default' | 'delete' | 'do' | 'else' | 'enum' | 'export' | 'extends' | 'false' | 'finally' | 'for' | 'function' | 'if' | 'implements' | 'import' | 'in' | 'instanceof' | 'interface' | 'let' | 'new' | 'null' | 'package' | 'private' | 'protected' | 'public' | 'return' | 'super' | 'switch' | 'static' | 'this' | 'throw' | 'try' | 'True' | 'typeof' | 'var' | 'void' | 'while' | 'with' | 'yield';
export type NonReservedWordString = Exclude<string, ReservedWord>;

const _reservedWords = new Set([
  'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger',
  'default', 'delete', 'do', 'else', 'enum', 'export', 'extends', 'false',
  'finally', 'for', 'function', 'if', 'implements', 'import', 'in',
  'instanceof', 'interface', 'let', 'new', 'null', 'package', 'private',
  'protected', 'public', 'return', 'super', 'switch', 'static', 'this',
  'throw', 'try', 'True', 'typeof', 'var', 'void', 'while', 'with', 'yield',
]);

const rxIdentifier = /^[A-Za-z$_][A-Za-z0-9$_]*$/;
export const isWellFormedIdentifier = (name: string) => rxIdentifier.test(name);
export const isValidIdentifier = (name: string): name is NonReservedWordString => isWellFormedIdentifier(name) && !isReservedWord(name);
export const isReservedWord = (word: string): word is ReservedWord => _reservedWords.has(word);

export function encodeAsStringLiteral (string: string) {
  string = string
    .replaceAll(`\\`, `\\\\`)
    .replaceAll(`\r`, `\\r`)
    .replaceAll(`\n`, `\\n`)
    .replaceAll(`\t`, `\\t`);
  if (string.indexOf("'") === -1) return `'${string}'`;
  if (string.indexOf('"') === -1) return `"${string}"`;
  return `'${string.replaceAll(`'`, `\\'`)}'`;
}

export function formatMemberKey (key: any) {
  let string: string, declaration: string, accessor: string;
  if (isWellFormedIdentifier(key)) {
    declaration = key;
    accessor = `.${key}`;
    string = `'${key}'`;
  }
  else {
    declaration = encodeAsStringLiteral(key);
    accessor = `[${declaration}]`;
    string = declaration;
  }
  return { string, declaration, accessor };
}

export function formatMemberExpressionAccessor (key: string) {
  return isWellFormedIdentifier(key) ? `.${key}` : `[${encodeAsStringLiteral(key)}]`;
}
export function formatMemberDeclarationKey (key: string) {
  return isWellFormedIdentifier(key) ? `${key}` : encodeAsStringLiteral(key);
}

export function sanitizeStringAsWellFormedIdentifier (string: string | Nothing, defaultIfEmpty = '_'): string {
  return isNothing(string) || string.length === 0
    ? defaultIfEmpty
    : string.replaceAll(/^[0-9]|[^A-Za-z$0-9_]+/g, '_');
}

const CAMELCASE_LEADING_CHAR = 'abcdefghijklmnopqrstuvwxyz';
const CAMELCASE_TAIL_CHAR = `${CAMELCASE_LEADING_CHAR}${CAMELCASE_LEADING_CHAR.toUpperCase()}0123456789`;
export function randomCamelCaseIdentifier (maxLength = 12): string {
  const s: string[] = [];
  for (let i = 0; i < maxLength; ++i) {
    if (i === 0) {
      s.push(CAMELCASE_LEADING_CHAR[Math.floor(Math.random() * CAMELCASE_LEADING_CHAR.length)]);
    }
    else {
      s.push(CAMELCASE_TAIL_CHAR[Math.floor(Math.random() * CAMELCASE_TAIL_CHAR.length)]);
    }
  }
  return s.join('');
}

export function transpileTypeScriptCode (code: string): string {
  const result = transpileModule(code, {
    compilerOptions: {
      module: ModuleKind.CommonJS,
      target: ScriptTarget.ESNext,
      removeComments: true,
    },
  });
  return result.outputText;
}

export function compileTS<T extends Record<string, any>> (ts: string, env?: Record<string, any>): T {
  const js = transpileTypeScriptCode(ts);
  return compileJS(js, env);
}
export function compileTSWithVM<T extends Record<string, any>> (ts: string, env?: Record<string, any>): T {
  const js = transpileTypeScriptCode(ts);
  return compileJSWithVM(js, env);
}

/**
 * Compile JavaScript code with environment bindings using the Function constructor.
 * This approach is less secure than using Node.js VM, but it is simpler and may be sufficient for some use cases.
 * @returns The exports object containing the compiled code's exports.
 */
export function compileJS<T extends Record<string, any>> (js: string, env?: Record<string, any>): T {
  const exports = {} as T;
  try {
    if (env) {
      // Extract environment variable names and values
      const envKeys = Object.keys(env);
      const envValues = envKeys.map(key => env[key]);

      // Create function with env variables as parameters
      new Function('exports', ...envKeys, js)(exports, ...envValues);
    }
    else {
      new Function('exports', js)(exports);
    }
    return exports;
  }
  catch (e) {
    console.error(`Error compiling script`, e);
    return exports;
  }
}

/**
 * Compile JavaScript code with environment bindings using Node.js VM for better isolation.
 * Provides better security and isolation compared to the Function constructor approach.
 * @returns The exports object containing the compiled code's exports.
 */
export function compileJSWithVM<T extends Record<string, any>> (js: string, env?: Record<string, any>): T {
  const exports = {} as T;

  try {
    const context = VM.createContext({
      ...env,
      exports,
    });

    VM.runInContext(js, context);
    return exports;
  }
  catch (e) {
    console.error(`Error compiling script with VM`, e);
    return exports;
  }
}
