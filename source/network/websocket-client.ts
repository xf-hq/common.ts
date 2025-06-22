import { PathReader } from '../facilities/path-reader';
import { isString } from '../general/type-checking';
import type { Messaging } from './messaging';

export class WebSocketClient {
  constructor (ws: WebSocket, listener: WebSocketClient.Listener) {
    this.#ws = ws;
    this.#listener = listener;
    ws.addEventListener('message', (event: MessageEvent) => this.#receive(event));
    ws.addEventListener('close', () => {
      console.warn(`The connection to the server was closed. Reconnecting...`);
      listener.disconnectedFromServer?.();
      this.#tryReconnect();
    });
  }
  #ws: WebSocket;
  readonly #listener: WebSocketClient.Listener;

  #receive (event: MessageEvent) {
    const message: Messaging.Message = JSON.parse(event.data);
    this.#listener.receiveMessage(new PathReader(':', message.type), message.data);
  }

  #tryReconnect (wait = 1000) {
    const maxWait = 10000;
    tryConnect(this.#ws.url, {
      ready: (ws: WebSocket) => {
        console.info(`Reconnected to the server.`);
        this.#ws = ws;
        ws.addEventListener('message', (event: MessageEvent) => this.#receive(event));
        ws.addEventListener('close', () => this.#tryReconnect());
        this.#listener.reconnectedToServer?.();
      },
      failed: () => {
        console.error(`Failed to reconnect to the server. Retrying in ${wait}ms.`);
        setTimeout(() => this.#tryReconnect(Math.min(wait * 1.25, maxWait)), wait);
      },
    });
  }

  send (message: Messaging.Message): void;
  send (type: string, data?: unknown): void;
  send (message_or_type: string | Messaging.Message, data: unknown = null) {
    const message: Messaging.Message = isString(message_or_type) ? { type: message_or_type, data } : message_or_type;
    this.#ws.send(JSON.stringify(message));
  }
}
export namespace WebSocketClient {
  export interface Listener {
    receiveMessage (type: PathReader, data: any): void;
    connectedToServer? (client: WebSocketClient): void;
    connectionFailed? (error: any): void;
    disconnectedFromServer? (): void;
    reconnectedToServer? (): void;
  }
  /**
   * @param wssurl e.g. `wss://${window.location.host}${window.location.pathname}`
   * @param listener Will receive all messages from the server.
   */
  export async function initialize (wssurl: string, listener: WebSocketClient.Listener): Promise<WebSocketClient> {
    console.debug(`Connecting to the server...`);
    return new Promise((resolve, reject) => tryConnect(wssurl, {
      ready: (ws: WebSocket) => {
        console.debug(`Connected!`);
        const client = new WebSocketClient(ws, listener);
        listener.connectedToServer?.(client);
        resolve(new WebSocketClient(ws, listener));
      },
      failed: (error: any) => {
        console.error(`Failed to connect to the server.`, error);
        listener.connectionFailed?.(error);
        reject(error);
      },
    }));
  }
}

interface ConnectionCallback {
  ready: (ws: WebSocket) => void;
  failed: (error: any) => void;
}
function tryConnect (wssurl: string, callback: ConnectionCallback) {
  console.debug(`Attempting to connect to WebSocket server at ${wssurl}...`);
  const ws = new WebSocket(wssurl);
  ws.addEventListener('open', () => {
    console.debug(`WebSocket connection established.`);
  });
  ws.addEventListener('message', function initialListener (event: MessageEvent) {
    const message: Messaging.Message = JSON.parse(event.data);
    if (message.type === 'ready') {
      ws.removeEventListener('message', initialListener);
      callback.ready(ws);
    }
  });
  ws.addEventListener('close', function (error) {
    console.warn(`WebSocket connection closed.`);
    console.debug(error.code);
    console.debug(error.reason);
  });
  ws.addEventListener('error', callback.failed);
}
