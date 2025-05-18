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
