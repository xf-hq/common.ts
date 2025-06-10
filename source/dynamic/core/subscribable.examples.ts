import { Subscribable } from './subscribable';

namespace Subscribable_Examples {
  class MyReceiver implements Subscribable.Receiver<[message: string]> {
    constructor (downstream: Subscribable.Receiver<[message: string]>) {
      this.#downstream = downstream;
    }
    readonly #downstream: Subscribable.Receiver<[message: string]>; // We'll assume this is initialised somewhere
    readonly #status = new Subscribable.SignalStatus<[message: string]>();

    hold () {
      // If this is the first time a HOLD state is being established, propagate the HOLD signal downstream
      if (this.#status.initiateHold()) {
        this.#downstream.hold?.();
      }
    }

    release () {
      if (this.#status.releaseHold()) {
        // Process all buffered events as a batch
        let finalText!: string;
        for (const [text] of this.#status.flush()) {
          // ...do something with the text to build up `finalText`...
        }
        this.#downstream.event(finalText); // Send the final text downstream...
        this.#downstream.release?.(); // ...and we're now mostly done.

        if (this.#status.isEnded) this.#downstream.end?.(); // If the upstream source has already ended, signal that downstream as well
        if (this.#status.isUnsubscribed) this.cleanup();
      }
    }

    event (message: string) {
      if (this.#status.isOnHold) {
        this.#status.holdEvent(message);
      }
      else {
        this.processEvent(message);
      }
    }

    end () {
      if (this.#status.isOnHold) {
        this.#status.holdEnd();
      }
      else {
        this.#downstream.end?.();
      }
    }

    unsubscribed () {
      if (this.#status.isOnHold) {
        this.#status.holdUnsubscribed();
      }
      else {
        this.cleanup();
      }
    }

    private processEvent (message: string) {
      // ...
      this.#downstream.event(message.toUpperCase());
    }

    private cleanup () {
      // ...clean up resources, then...
      this.#downstream.unsubscribed?.();
    }
  }

}