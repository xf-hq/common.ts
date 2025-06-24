import type { PathLens } from '../facilities/path-lens';
import { isFunction } from '../general/type-checking.ts';

export namespace Messaging {
  export interface Message<T extends string = string, D = any> {
    readonly type: T;
    readonly data: D;
  }
  export namespace Message {
    export interface Request<TRef = unknown> extends Message<typeof Request.Type, Request.Data<TRef>> {}
    export function Request<TRef> (ref: TRef, message: Message): Request<TRef> { return { type: Request.Type, data: { ref, message } }; }
    export namespace Request {
      export const Type = '@@messaging:request';

      export interface Data<TRef = any> {
        readonly ref: TRef;
        readonly message: Message;
      }

      export interface Cancel<TRef = unknown> extends Message<typeof Cancel.Type, unknown> {}
      export function Cancel<TRef> (ref: unknown): Cancel { return { type: Cancel.Type, data: { ref } }; }
      export namespace Cancel {
        export const Type = '@@messaging:cancel';
      }
    }

    export interface Response<TRef = unknown> extends Message<typeof Response.Type, Response.Data<TRef>> {}
    export function Response<TRef> (ref: TRef, message: Message): Response<TRef> { return { type: Response.Type, data: { ref, message } }; }
    export namespace Response {
      export const Type = '@@messaging:response';

      export interface Data<TRef = any> {
        readonly ref: TRef;
        readonly message: Message;
      }
    }
  }

  export interface InboundMessageContext<TData = unknown> {
    readonly messageType: PathLens;
    readonly messageData: TData;
  }

  export interface InboundRequestMessageContext<TData = unknown> extends InboundMessageContext<TData> {
    readonly messageType: PathLens;
    readonly messageData: TData;
    readonly response: ResponseInterface;
  }

  export interface ResponseInterface {
    /**
     * This should be called exactly once. Even if `openPersistentChannel` is called, this should be called to
     * acknowledge that the channel is now open, and to provide the persistent channel's reference value so that the
     * client can match inbound websocket messages to the original request and, if applicable, to be able to dispatch
     * follow-up messages to the channel.
     */
    send (responseMessage: Message): void;
    openPersistentChannel (abortSignal: AbortSignal, ref: any, handler: MessageHandler): PersistentChannel;
  }

  export interface PersistentChannel {
    readonly abortSignal: AbortSignal;
    send (message: Message): void;
  }

  export interface MessageHandler<TContext extends InboundMessageContext = InboundMessageContext> {
    handleMessage (context: TContext): void;
  }

  export type HandlersArg<TContext extends InboundMessageContext = InboundMessageContext> = Record<string, MessageHandler<TContext> | MessageHandler<TContext>['handleMessage']>;

  export function MessageRouter<TContext extends InboundMessageContext> (label: string, handlers: Record<string, MessageHandler<TContext> | MessageHandler<TContext>['handleMessage']>): MessageHandler<TContext> {
    const _handlers: Record<string, MessageHandler<TContext>> = {};
    for (const key in handlers) {
      const handler = handlers[key];
      _handlers[key] = isFunction(handler) ? { handleMessage: handler } : handler;
    }
    return {
      handleMessage: (context) => _handleMessage(label, context, _handlers),
    };
  }

  function _handleMessage<TContext extends InboundMessageContext> (routerLabel: string, context: TContext, handlers: Record<string, MessageHandler<TContext>>): void {
    const messageType = context.messageType;
    const destinationRouteName = messageType.segmentValue;
    const handler = handlers[destinationRouteName];
    if (handler) {
      context = { ...context, messageType: messageType.nextSegment };
      return handler.handleMessage(context);
    }
    else console.warn(`[${routerLabel}] Unhandled message type "${messageType.segmentValue}" in path "${messageType.fullPath}".`);
  }

  export function RequestRouter<TContext extends InboundMessageContext, UContext extends InboundRequestMessageContext> (label: string, props: RequestRouterProps<TContext, UContext>): MessageHandler<TContext> {
    const router = MessageRouter(label, props.routes);
    let createRequestContext: (context: TContext, request: Messaging.Message.Request.Data) => UContext;
    if ('createResponseInterface' in props) {
      createRequestContext = (context, request) => {
        const responseInterface = props.createResponseInterface(context, request.ref);
        return {
          messageType: context.messageType,
          messageData: request.message,
          response: responseInterface,
        } as UContext;
      };
    }
    else {
      createRequestContext = props.createRequestContext;
    }
    return {
      handleMessage: (context) => {
        const requestContext = createRequestContext(context, context.messageData as Messaging.Message.Request.Data);
        return router.handleMessage(requestContext);
      },
    };
  }
  export type RequestRouterProps<TContext extends InboundMessageContext, UContext extends InboundRequestMessageContext> =
    | RequestRouterProps.Basic<TContext, UContext>
    | RequestRouterProps.Extensible<TContext, UContext>
  ;
  export namespace RequestRouterProps {
    export interface Basic<TContext extends InboundMessageContext, UContext extends InboundRequestMessageContext> {
      createResponseInterface: (context: TContext, ref: unknown) => ResponseInterface;
      routes: Record<string, MessageHandler<UContext> | MessageHandler<UContext>['handleMessage']>;
    }
    export interface Extensible<TContext extends InboundMessageContext, UContext extends InboundRequestMessageContext> {
      createRequestContext: (context: TContext, request: Messaging.Message.Request.Data) => UContext;
      routes: Record<string, MessageHandler<UContext> | MessageHandler<UContext>['handleMessage']>;
    }
  }
}
