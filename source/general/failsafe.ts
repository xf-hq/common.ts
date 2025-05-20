export namespace FailSafe {
  export async function emit<F extends (...args: A) => any, A extends any[]> (emit: F, ...args: A) {
    try {
      await emit(...args);
    }
    catch (e) {
      console.error((e as Error)?.stack ?? e);
    }
  }

  export function queueMicrotask (callback: () => void): void {
    globalThis.queueMicrotask(function safeMicrotask () {
      emit(callback);
    });
  }

  export function setTimeout<TArgs extends any[]> (callback: (...args: TArgs) => void, ms?: number, ...args: TArgs) {
    return globalThis.setTimeout((...args) => emit(callback, ...args), ms, ...args);
  }

  export function setInterval<TArgs extends any[]> (callback: (...args: TArgs) => void, ms?: number, ...args: TArgs) {
    return globalThis.setInterval((...args) => emit(callback, ...args), ms, ...args);
  }

  export function execute (callback: () => void, suppressError = false) {
    try {
      callback();
    }
    catch (e) {
      if (!suppressError) console.error((e as Error)?.stack ?? e);
    }
  }
}
