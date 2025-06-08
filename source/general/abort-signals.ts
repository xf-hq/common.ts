/**
 * Triggers an abort signal when the last attached signal is detached. When an abort event is received for an attached
 * signal, the internal response is to detach it the same way that it would be detached manually. Regardless of whether
 * detachment is automatic or manual, doing so will trigger an abort event if the signal being detached is the last one
 * in the set. When this happens, the controller's owner should clean up any resources they're maintaining and discard
 * the current controller. A new controller can be created if future demand should arise.
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

  static initializeSharedResource<T> (init: (signal: AbortSignal) => [resource: T, cleanUp: () => void]): SharedDemandAbortController.Current<T> {
    const controller = new SharedDemandAbortController();
    const [resource, cleanUp] = init(controller.signal);
    controller.signal.addEventListener('abort', cleanUp);
    return { controller, resource };
  }
}
export namespace SharedDemandAbortController {
  export interface Current<T> {
    readonly controller: SharedDemandAbortController;
    readonly resource: T;
  }
}
