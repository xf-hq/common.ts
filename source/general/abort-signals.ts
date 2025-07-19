export function createChildAbortController (upstream: AbortSignal): AbortController {
  const controller = new AbortController();
  if (upstream.aborted) {
    controller.abort();
  }
  else {
    upstream.addEventListener('abort', () => controller.abort(), { once: true, signal: controller.signal });
  }
  return controller;
}

export function combineAbortSignals (...signals: AbortSignal[]): AbortSignal {
  if (signals.length === 1) return signals[0];
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) return signal;
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }
  return controller.signal;
}

export function combineAbortControllers (...controllers: AbortController[]): AbortController {
  if (controllers.length === 1) return controllers[0];
  const combinedSignal = combineAbortSignals(...controllers.map(c => c.signal));
  const combinedController = new AbortController();
  combinedSignal.addEventListener('abort', () => combinedController.abort(), { once: true });
  return combinedController;
}

/**
 * Triggers an abort signal when the last attached signal is detached. When an abort event is received for an attached
 * signal, the internal response is to detach it the same way that it would be detached manually. Regardless of whether
 * detachment is automatic or manual, doing so will trigger an abort event if the signal being detached is the last one
 * in the set. When this happens, the controller's owner should clean up any resources they're maintaining and discard
 * the current controller. A new controller can be created if future demand should arise.
 *
 * How to use this for the management of a shared resource:
 * ```ts
 * const current = this.#current ??= SharedDemandAbortController.initializeSharedResource((abortSignal) => [
 *   initializeAndReturnYourResource(abortSignal),
 *   () => cleanUpYourResource(),
 * ]);
 * current.controller.attach(abortSignal);
 * return current.resource;
 * ```
 */
export class SharedDemandAbortController extends AbortController {
  readonly #signals = new Map<AbortSignal, () => void>();
  attach (signal: AbortSignal) {
    if (this.#signals.has(signal)) return;
    const listener = () => this.detach(signal);
    this.#signals.set(signal, listener);
    signal.addEventListener('abort', listener);
  }
  detach (signal: AbortSignal) {
    const listener = this.#signals.get(signal);
    if (listener) {
      signal.removeEventListener('abort', listener);
      this.#signals.delete(signal);
      if (this.#signals.size === 0) {
        this.abort();
      }
    }
  }
  override abort () {
    for (const [signal, listener] of this.#signals) {
      signal.removeEventListener('abort', listener);
    }
    this.#signals.clear();
    super.abort();
  }

  static initializeSharedResource<T> (init: (abortSignal: AbortSignal) => [resource: T, cleanUp: (resource: T) => void]): SharedDemandAbortController.Current<T> {
    const controller = new SharedDemandAbortController();
    const [resource, cleanUp] = init(controller.signal);
    controller.signal.addEventListener('abort', () => cleanUp(resource));
    return { controller, resource };
  }
}
export namespace SharedDemandAbortController {
  export interface Current<T> {
    readonly controller: SharedDemandAbortController;
    readonly resource: T;
  }
}
