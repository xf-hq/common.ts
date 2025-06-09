import { isFunction } from '../../../general/type-checking';
import type { ValueSource } from './value-source';

export const ValueSourceTag: unique symbol = Symbol('ValueSource');

export function _initializeValueSourceSubscriber<T, A extends any[]> (
  subscription: ValueSource.Subscription<T>,
  subscriber: ValueSource.SubscribeCallback<T, A> | ValueSource.Receiver<T, A>,
  args: A
): ValueSource.Subscriber<T, A> {
  if (isFunction(subscriber)) {
    return subscriber(subscription, ...args);
  }
  if (subscriber.init) {
    subscriber.init(subscription, ...args);
  }
  return subscriber;
}
