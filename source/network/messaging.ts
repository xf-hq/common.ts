import type { ConsoleLogger } from '../facilities/logging';
import { PathLens } from '../facilities/path-lens';
import { isFunction, isString } from '../general/type-checking.ts';

export namespace Messaging {
  export interface Message<T extends string = string, D = any> {
    readonly type: T;
    readonly data: D;
  }
  export function Message<T extends string> (type: T): Message<T, null>;
  export function Message<T extends string, D> (type: T, data: D): Message<T, D>;
  export function Message (type: string, data: unknown = null) { return { type, data }; }
  export namespace Message {
    export interface Request<TRef = unknown> extends Message<typeof Request.Type, Request.Data<TRef>> {}
    export function Request<TRef> (ref: TRef, message: Message): Request<TRef> {
      return { type: Request.Type, data: { ref, message } };
    }
    export namespace Request {
      export const Type = '@@messaging:request';

      export interface Data<TRef = any> {
        readonly ref: TRef;
        readonly message: Message;
      }

      export interface Cancel<TRef = unknown> extends Message<typeof Cancel.Type, unknown> {}
      export function Cancel<TRef> (ref: unknown): Cancel {
        return { type: Cancel.Type, data: { ref } };
      }
      export namespace Cancel {
        export const Type = '@@messaging:cancel';
      }
    }

    export interface Response<TRef = unknown> extends Message<typeof Response.Type, Response.Data<TRef>> {}
    export function Response<TRef> (ref: TRef, persistent: boolean, message: Message): Response<TRef> {
      return { type: Response.Type, data: { ref, persistent, message } };
    }
    export namespace Response {
      export const Type = '@@messaging:response';

      export interface Data<TRef = any> {
        /**
         * The unique reference identifier for this request/response pair. The server does not interpret the value in
         * any way, and uses it only to accompany the response and (if a persistent channel is opened) any further
         * updates it dispatches for this request while the channel remains open. It is up to the client to match the
         * `ref` value to the message's intended recipient and to dispatch the accompanying `message` to them.
         */
        readonly ref: TRef;
        /**
         * `true` if a channel remains open for this request, with potential future updates to be dispatched for this
         * `ref`. If persistent, the client should send a cancellatiion message (see {@link Messaging.Cancel}) when they
         * are done with the request and no longer want to receive updates. Persistent channels are closed automatically
         * if the client becomes disconnected from the server.
         */
        readonly persistent: boolean;
        readonly message: Message;
      }
    }

    export interface Update<TRef = unknown> extends Message<typeof Update.Type, Update.Data<TRef>> {}
    export function Update<TRef> (ref: TRef, message: Message): Update<TRef> { return { type: Update.Type, data: { ref, message } }; }
    export namespace Update {
      export const Type = '@@messaging:update';

      export interface Data<TRef = any> {
        readonly ref: TRef;
        readonly message: Message;
      }
    }
  }

  export interface InboundMessageContext<TData = unknown> {
    readonly messageType: PathLens;
    readonly messageData: TData;
    withMessageType (messageType: PathLens, current: this): this;
  }
  export function InboundMessageContext<TData> (messageType: string | PathLens, messageData: TData): InboundMessageContext<TData> {
    if (isString(messageType)) messageType = PathLens.from(':', messageType);
    return new DefaultInboundMessageContext(messageType, messageData);
  }
  class DefaultInboundMessageContext<TData = unknown> implements InboundMessageContext<TData> {
    constructor (
      public readonly messageType: PathLens,
      public readonly messageData: TData,
    ) {}
    withMessageType (messageType: PathLens, current: this): this {
      return new DefaultInboundMessageContext(messageType, current.messageData) as this;
    }
  }

  export interface InboundRequestMessageContext<TData = unknown> extends InboundMessageContext<TData> {
    readonly response: ResponseInterface;
  }

  export interface Sink {
    send (message: Message): void;
  }

  export interface ResponseInterface extends Sink {
    /**
     * This should be called exactly once. Even if `openPersistentChannel` is called, this should be called to
     * acknowledge that the channel is now open, and to provide the persistent channel's reference value so that the
     * client can match inbound websocket messages to the original request and, if applicable, to be able to dispatch
     * follow-up messages to the channel.
     */
    send (responseMessage: Message): void;
    openPersistentChannel (abortSignal: AbortSignal, handler: MessageHandler): PersistentChannel;
  }

  export interface PersistentChannel extends Sink {
    readonly abortSignal: AbortSignal;
  }

  export interface MessageHandler<TContext extends InboundMessageContext = InboundMessageContext> {
    handleMessage (context: TContext): void;
  }

  export type HandlersArg<TContext extends InboundMessageContext = InboundMessageContext> = Record<string, MessageHandler<TContext> | MessageHandler<TContext>['handleMessage']>;

  export const MessageRouterFactory = (createLogger: ConsoleLogger.Factory) => ({
    MessageRouter<TContext extends InboundMessageContext> (label: string, handlers: HandlersArg<TContext>): MessageHandler<TContext> {
      const log = createLogger(label);
      return MessageRouter(label, log, handlers);
    },
    RequestRouter<TContext extends InboundMessageContext, UContext extends InboundRequestMessageContext>(label: string, props: RequestRouterConfig<TContext, UContext>): MessageHandler<TContext> {
      const log = createLogger(label);
      return RequestRouter(label, log, props);
    },
  });

  export function MessageRouter<TContext extends InboundMessageContext> (label: string, log: ConsoleLogger, handlers: Record<string, MessageHandler<TContext> | MessageHandler<TContext>['handleMessage']>): MessageHandler<TContext> {
    const _handlers: Record<string, MessageHandler<TContext>> = {};
    for (const key in handlers) {
      const handler = handlers[key];
      _handlers[key] = isFunction(handler) ? { handleMessage: handler } : handler;
    }
    return {
      handleMessage: (context) => _handleMessage(label, log, context, _handlers),
    };
  }

  function _handleMessage<TContext extends InboundMessageContext> (routerLabel: string, log: ConsoleLogger, context: TContext, handlers: Record<string, MessageHandler<TContext>>): void {
    // using _ = log.group.endOnDispose(`Incoming message: ${context.messageType}`, context.messageType.pathFromSegmentEnd);
    const messageType = context.messageType;
    const destinationRouteName = messageType.segmentValue;
    const handler = handlers[destinationRouteName];
    if (handler) {
      context = context.withMessageType(messageType.nextSegment, context);
      return handler.handleMessage(context);
    }
    else log.warn(`Unhandled message type "${messageType.segmentValue}" in path "${messageType.fullPath}".`);
  }

  export function RequestRouter<TContext extends InboundMessageContext, UContext extends InboundRequestMessageContext> (label: string, log: ConsoleLogger, config: RequestRouterConfig<TContext, UContext>): MessageHandler<TContext> {
    const router = MessageRouter(label, log, config.routes);
    return {
      handleMessage: (context) => {
        const request = context.messageData as Messaging.Message.Request.Data;
        const requestType = PathLens.from(':', request.message.type);
        const requestContext = config.createRequestContext(context, requestType, request.message.data, request.ref);
        return router.handleMessage(requestContext);
      },
    };
  }
  export interface RequestRouterConfig<TContext extends InboundMessageContext, UContext extends InboundRequestMessageContext> {
    createRequestContext: (context: TContext, requestType: PathLens, requestData: any, ref: unknown) => UContext;
    routes: Record<string, MessageHandler<UContext> | MessageHandler<UContext>['handleMessage']>;
  }
}
