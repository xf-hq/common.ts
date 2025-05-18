import chalk from 'chalk';

export namespace ansi {
  export function underline (text: any): string {
    return chalk.underline(text);
  }
}