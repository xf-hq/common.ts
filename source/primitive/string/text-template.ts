export interface TextTemplate<T extends Record<string, any>> {
  render (data: T): string;
}
export function TextTemplate<T extends Record<string, any>> (params: TextTemplate.Params<T>): TextTemplate<T> {
  return new Template(params);
}
export namespace TextTemplate {
  export interface Params<T extends Record<string, any>> {
    readonly source: string;
    transform?: {
      [K in keyof T]?: (value: T[K]) => any
    };
  }
}

import _TextTemplate = TextTemplate;
const Template = class TextTemplate<T extends Record<string, any>> implements _TextTemplate<T> {
  constructor (params: _TextTemplate.Params<T>) {
    this.#params = params;
  }
  readonly #params: _TextTemplate.Params<T>;
  #array: string[] = [];
  #placeholders: Record<string, number>;
  #transform: { [K in keyof T]: (value: T[K]) => any };
  #initialized = false;

  private _ensureInitialized () {
    if (this.#initialized) return;
    const { source, transform = {} as Exclude<_TextTemplate.Params<T>['transform'], undefined> } = this.#params;
    const array = source.split(/\{\{([a-z][A-Za-z]*?)\}\}/g);
    const placeholders: Record<string, number> = {};
    const _transform: any = {};
    for (let i = 0; i < array.length; i += 2) {
      const name = array[i + 1];
      placeholders[name] = i + 1;
      array[i + 1] = '';
      _transform[name] = name in transform ? transform[name]! : (value: any) => value;
    }
    this.#placeholders = placeholders;
    this.#transform = _transform;
  }

  render (data: T): string {
    this._ensureInitialized();
    const placeholders = this.#placeholders;
    const segments = [...this.#array];
    for (const name in data) {
      if (name in placeholders) {
        const index = placeholders[name];
        const rawValue = data[name];
        const transformedValue = this.#transform[name](rawValue);
        segments[index] = String(transformedValue);
      }
    }
    return segments.join('');
  }
};
