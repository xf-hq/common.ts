import * as Immutable from 'immutable';
import { IdGenerator } from '../../general/ids-and-caching';
import { isArray, isDefined, isUndefined } from '../../general/type-checking';
import { CompositionalBlackboxing } from './compositional.blackboxing';

export namespace Compositional {
  const _interfaceType_ = Symbol('Compositional/_interfaceType_');
  const _env_ = Symbol('Compositional/_env_');
  const _dummy_ = Symbol('Compositional/_dummy_');

  export interface InterfaceType<TInterface extends object = object, TEnv extends object = object, TCtorArgs extends any[] = any[]> {
    readonly name: string;
    readonly entityClass: EntityClass<TEnv, TCtorArgs>;
    readonly [_dummy_]: TInterface;
    isExclusivelyExpressedBy (instance: object): instance is TInterface;
    isExpressedBy (instance: object): instance is TInterface;
    includesInterfaceType (type: InterfaceType<any, TEnv, TCtorArgs>): boolean;
    propertyKeys (): IterableIterator<keyof TInterface>;
    propertyDescriptor (key: keyof TInterface): TypedPropertyDescriptor<TInterface[keyof TInterface]>;
    becomeInterfaceOf (instance: object): TInterface;
    expandInterfaceOf<TInstanceInterface extends object> (instance: TInstanceInterface): TInterface & TInstanceInterface;
    excludeFromInterfaceOf<TOtherInterfaces extends object> (instance: TOtherInterfaces & TInterface): TOtherInterfaces;
    construct (...args: TCtorArgs): TInterface;
    extend<TCallback extends Define.Callback<TInterface, TInterface, TEnv, TCtorArgs>> (callback: TCallback): Define.FinalInterfaceType<TInterface, TEnv, TCtorArgs, TCallback>;
    /**
     * - Redundant recompositions are automatically avoided; if this type composes the other, or vice versa, the one
     *   that composes both is returned as is.
     * - New compositions are held in a weak cache so as to make it efficient to perform naive compositions between
     *   types where there is uncertainty regarding whether or not one of those types are already in composition
     *   together.
     */
    composeWith<TInterface2 extends object> (other: InterfaceType<TInterface2, TEnv, TCtorArgs>): InterfaceType<TInterface & TInterface2, TEnv, TCtorArgs>;
    excludeFromOwnComposition<TInterface2 extends object> (typeToExclude: InterfaceType<TInterface2, TEnv, TCtorArgs>): InterfaceType<Exclude<TInterface, TInterface2>, TEnv, TCtorArgs>;
  }
  export namespace InterfaceType {
    export type From<TEntityClass extends EntityClass<any, any>, TInterface extends object = object> = TEntityClass extends EntityClass<infer TEnv, infer TCtorArgs> ? InterfaceType<TInterface, TEnv, TCtorArgs> : never;
  }
  export function isInterfaceType<TInterface extends object, TEnv extends object, TCtorArgs extends any[]> (value: unknown): value is InterfaceType<TInterface, TEnv, TCtorArgs> {
    return isDefined((value as InterfaceType<TInterface, TEnv, TCtorArgs>)?.[_dummy_]);
  }
  export function isInstance<T> (value: unknown): value is T {
    return isDefined(value?.[_interfaceType_]);
  }

  export type InterfaceTypeRef<TInterface extends object, TEnv extends object, TCtorArgs extends any[]> =
    | InterfaceType<TInterface, TEnv, TCtorArgs>
    | InterfaceTypeNS<InterfaceType<TInterface, TEnv, TCtorArgs>>;
  export namespace InterfaceTypeRef {
    export type FromClass<TInterface extends object, TEntityClass extends EntityClass<any, any>> = TEntityClass extends EntityClass<infer TEnv, infer TCtorArgs> ? InterfaceTypeRef<TInterface, TEnv, TCtorArgs> : never;
  }

  /**
   * Standard unenforced convention for organising code that makes use of the facilities provided by the `Compositional`
   * namespace. This convention is recognised by a subset of these facilities, the intent being to promote conciseness
   * in code that refers to namespaced type interfaces by allowing direct references to namespaces designed to export a
   * single type interface, rather than having to explicitly dereference the type interface as a member of the
   * namespace.
   */
  export interface InterfaceTypeNS<TInterfaceType extends InterfaceType<any, object, any[]> = InterfaceType<any, object, any[]>> {
    readonly InterfaceType: TInterfaceType;
  }
  export namespace InterfaceTypeNS {
    export type ExtractInterface<TInterfaceTypeNS> = TInterfaceTypeNS extends InterfaceTypeNS<infer TInterfaceType> ? Compositional.ExtractInterface<TInterfaceType> : never;
  }
  export function isInterfaceTypeNS<TInterfaceType extends InterfaceType<object, object, any[]>> (value: TInterfaceType | InterfaceTypeNS<TInterfaceType>): value is InterfaceTypeNS<TInterfaceType>;
  export function isInterfaceTypeNS<TInterfaceType extends InterfaceType<object, object, any[]>> (value: unknown): value is InterfaceTypeNS<TInterfaceType>;
  export function isInterfaceTypeNS<TInterfaceType extends InterfaceType<object, object, any[]>> (value: unknown): value is InterfaceTypeNS<TInterfaceType> {
    return isInterfaceType((value as InterfaceTypeNS<TInterfaceType>)?.InterfaceType);
  }

  /**
   * Extracts `TInterface` from `TInterfaceType<TInterface, TEnv, TCtorArgs>`.
   * @remarks
   * `ExtractInterface` is provided mainly as a public helper to facilitate more concise interface definitions.
   * @example
   * ```ts
   * type Foo = Compositional.ExtractInterface<typeof Foo>; // -> FooInterface
   * const Foo = $MyEntityClass.defineInterface((InterfaceType) => class FooInterface extends InterfaceType.BaseClass {
   *   // interface members here...
   * });
   * ```
   */
  export type ExtractInterface<TInterfaceTypeOrNS extends InterfaceTypeRef<any, any, any>> =
    | TInterfaceTypeOrNS extends InterfaceTypeNS<any> ? InterfaceTypeNS.ExtractInterface<TInterfaceTypeOrNS>
    : TInterfaceTypeOrNS extends InterfaceType<infer TInterface extends object, any, any> ? TInterface
    : never;
  export namespace ExtractInterface {
    /**
     * This type extracts the common public interface (if any) shared by all entities of a given entity class. When
     * creating a new `EntityClass` instance, the class constructor passed to the initializer is where the public
     * interface we're extracting here is defined.
     */
    export type FromClass<TEntityClass extends EntityClass<any, any>> = TEntityClass extends EntityClass<infer TEnv, any> ? TEnv : never;
  }
  export type ExtractEnv<TInterfaceType extends InterfaceType<any, any, any>> = TInterfaceType extends InterfaceType<any, infer TEnv, any> ? TEnv : never;
  export type ExtractCtorArgs<TInterfaceType extends InterfaceType<any, any, any>> = TInterfaceType extends InterfaceType<any, any, infer TCtorArgs> ? TCtorArgs : never;
  export type ExtractInterfaces<TInterfaceTypes extends InterfaceTypeRef<any, any, any>[]> = { [i in keyof TInterfaceTypes]: ExtractInterface<TInterfaceTypes[i]> }[number];

  export type ExtendedInterfaceType<TBaseType extends InterfaceType<any, any, any>, TExtensionInterface extends object> =
    InterfaceType<
      ExtractInterface<TBaseType> & TExtensionInterface,
      ExtractEnv<TBaseType>,
      ExtractCtorArgs<TBaseType>
    >;

  export namespace Define {
    export type Callback<
      TBaseInterface extends object,
      TFullInterface extends TBaseInterface,
      TEnv extends object,
      TCtorArgs extends any[]
    > = (
      type: AtomicInterface.Type<TBaseInterface, TFullInterface, TEnv, TCtorArgs>
    ) => AnyConstructor<[], TFullInterface>;
    export namespace Callback {
      export type FromClass<TEntityClass extends EntityClass<any, any>, TRootInterface extends object = EmptyRecord> =
        TEntityClass extends EntityClass<infer TEnv, infer TCtorArgs> ? Callback<TRootInterface, TRootInterface, TEnv, TCtorArgs> : never;
    }

    export type FinalInterfaceType<
      TBaseInterface extends object,
      TEnv extends object,
      TCtorArgs extends any[],
      TCallback extends Callback<TBaseInterface, TBaseInterface, TEnv, TCtorArgs>
    > = InterfaceType<
      TFinalInterface<TCallback>,
      TEnv,
      TCtorArgs
    >;
    export type TFinalInterface<TCallback extends Callback<any, any, any, any>> = InstanceType<ReturnType<TCallback>>;
    export type ExtractEnv<TCallback extends Callback<any, any, any, any>> = TCallback extends Callback<any, any, infer TEnv, any> ? TEnv : never;
    export type ExtractCtorArgs<TCallback extends Callback<any, any, any, any>> = TCallback extends Callback<any, any, any, infer TCtorArgs> ? TCtorArgs : never;
  }

  export type CompositeInterfaceType<TInterfaceTypes extends InterfaceTypeRef<any, TEnv, TCtorArgs>[], TEnv extends object, TCtorArgs extends any[]> =
    InterfaceType<UnionToIntersection<ExtractInterfaces<TInterfaceTypes>, object>, TEnv, TCtorArgs>;

  export class EntityClass<TEnv extends object, TCtorArgs extends any[]> {
    static new<TCtor extends new (...args: any[]) => any> (ctor: TCtor): EntityClass.FromConstructor<TCtor> {
      return new EntityClass(ctor) as EntityClass.FromConstructor<TCtor>;
    }
    constructor (ctor: AnyConstructor<TCtorArgs, TEnv>) { this.#envCtor = ctor; }
    readonly #envCtor: AnyConstructor<TCtorArgs, TEnv>;
    #defaultInterfaceType?: InterfaceType<TEnv, TEnv, TCtorArgs>;

    construct<TInterface extends object> (interfaceType: InterfaceType<TInterface, TEnv, TCtorArgs>, args: TCtorArgs): TInterface {
      const env = new this.#envCtor(...args);
      return new Proxy(interfaceType[_dummy_], new InterfaceProxyHandler(interfaceType, env));
    }

    constructSameAs<TInterface extends object> (other: TInterface, args: TCtorArgs): TInterface {
      return new Proxy(other[_dummy_], new InterfaceProxyHandler(other[_interfaceType_], new this.#envCtor(...args)));
    }

    cast<TInterface extends object, UInterface extends object> (fromInterface: TInterface, toInterfaceType: InterfaceType<UInterface, TEnv, TCtorArgs>): UInterface {
      if (toInterfaceType.isExpressedBy(fromInterface)) return fromInterface;
      const env = fromInterface[_env_];
      if (env.constructor !== this.#envCtor) {
        throw new Error(`Can only cast between interface types whose entity classes have the same entity environment constructor`);
      }
      return new Proxy(toInterfaceType[_dummy_], new InterfaceProxyHandler(toInterfaceType, env));
    }

    define<TCallback extends Define.Callback<EmptyRecord, any, TEnv, TCtorArgs>> (callback: TCallback): Define.FinalInterfaceType<EmptyRecord, TEnv, TCtorArgs, TCallback> {
      const [type, initialize] = AtomicInterface.Type.new<EmptyRecord, Define.TFinalInterface<TCallback>, TEnv, TCtorArgs>(this);
      callback(type);
      initialize(callback(type));
      return type;
    }

    extend<TBaseInterface extends object, XCallback extends (type: AtomicInterface.Type<TBaseInterface, any, TEnv, TCtorArgs>) => AnyConstructor<[], any>> (
      baseType: InterfaceType<TBaseInterface, TEnv, TCtorArgs>,
      callback: XCallback
    ): InterfaceType<TBaseInterface & InstanceType<ReturnType<XCallback>>, TEnv, TCtorArgs> {
      type TFullInterface = TBaseInterface & InstanceType<ReturnType<XCallback>>;
      const [type, initialize] = AtomicInterface.Type.new<TBaseInterface, TFullInterface, TEnv, TCtorArgs>(this);
      initialize(callback(type));
      return CompositeInterface.define<TFullInterface, TEnv, TCtorArgs>(this, [baseType, type]);
    }

    compose<TElements extends InterfaceTypeRef<any, TEnv, TCtorArgs>[]> (elements: TElements): CompositeInterfaceType<TElements, TEnv, TCtorArgs>;
    compose<TElements extends InterfaceTypeRef<any, TEnv, TCtorArgs>[]> (name: string, elements: TElements): CompositeInterfaceType<TElements, TEnv, TCtorArgs>;
    compose<TInterface extends object> (...args: EntityClass.Overloads.DefineComposite<TEnv, TCtorArgs>) {
      return CompositeInterface.define<TInterface, TEnv, TCtorArgs>(this, ...args);
    }
  }
  export namespace EntityClass {
    export namespace Overloads {
      export type DefineComposite<TEnv extends object, TCtorArgs extends any[]> =
        | [name: string, elements: CompositeInterface.Element<TEnv, TCtorArgs>[]]
        | [elements: CompositeInterface.Element<TEnv, TCtorArgs>[]];
    }
    export type FromConstructor<TCtor extends AnyConstructor> = TCtor extends AnyConstructor<infer TCtorArgs, infer TEnv extends object> ? EntityClass<TEnv, TCtorArgs> : never;
    export type ToInterfaceType<TInterface extends object, TClass extends EntityClass<object, any[]>> = TClass extends EntityClass<infer TEnv, infer TCtorArgs> ? InterfaceType<TInterface, TEnv, TCtorArgs> : never;
    export type ExtractEnv<TClass extends EntityClass<any, any[]>> = TClass extends EntityClass<infer TEnv, any[]> ? TEnv : never;
    export type ExtractCtorArgs<TClass extends EntityClass<any, any[]>> = TClass extends EntityClass<any, infer TCtorArgs> ? TCtorArgs : never;
  }

  export namespace AtomicInterface {
    interface Initialize<TFullInterface extends object, TEnv extends object, TCtorArgs extends any[]> {
      (cconstructor: AnyConstructor<[], TFullInterface>): AtomicInterfaceType<EmptyRecord, TFullInterface, TEnv, TCtorArgs>;
    }
    class AtomicInterfaceType<
      TBaseInterface extends object,
      TFullInterface extends object,
      TEnv extends object,
      TCtorArgs extends any[]
    > implements InterfaceType<TFullInterface, TEnv, TCtorArgs> {
      static new<TBaseInterface extends object, TFullInterface extends object, TEnv extends object, TCtorArgs extends any[]> (
        entityClass: EntityClass<TEnv, TCtorArgs>
      ): [
        type: AtomicInterfaceType<TBaseInterface, TFullInterface, TEnv, TCtorArgs>,
        initialize: Initialize<TFullInterface, TEnv, TCtorArgs>,
      ] {
        const type = new AtomicInterfaceType<TBaseInterface, TFullInterface, TEnv, TCtorArgs>(entityClass);
        const initialize: Initialize<TFullInterface, TEnv, TCtorArgs> = (cconstructor) => {
          const descriptorMap = Object.getOwnPropertyDescriptors(cconstructor.prototype);
          type.#name = cconstructor.name;
          type.#descriptorMap = descriptorMap;
          type.#dummyInstance = Object.create(null, descriptorMap);
          return type;
        };
        return [type, initialize];
      }
      #name: string;
      #descriptorMap: PropertyDescriptorMap;
      #dummyInstance: TFullInterface;
      private constructor (entityClass: EntityClass<TEnv, TCtorArgs>) { this.#entityClass = entityClass; }
      readonly #entityClass: EntityClass<TEnv, TCtorArgs>;

      /**
       * This is a dummy class that is provided to make it simple to define composable interfaces that the type system
       * properly acknowledges as having visibility of the properties defined for `TEnv`.
       * @example
       * ```ts
       * // Define our interface-agnostic entity environment:
       * const $MyEntityClass = Compositional.EntityClass.new(class MyEntity {
       *   constructor (protected readonly _bar: string) {}
       * });
       * // Define an interface for it:
       * const Foo = $MyEntityClass.defineInterface((InterfaceType) => class Foo extends InterfaceType.BaseClass {
       *   setBar (value: string) { this._bar = value; } // ✔️ Success! No type errors on access to `_bar`.
       * });
       * ```
       */
      public readonly BaseClass: abstract new () => TBaseInterface & TEnv = class {} as any;

      get name () { return this.#name; }
      get entityClass () { return this.#entityClass; }
      get [_dummy_] () { return this.#dummyInstance; }

      isExclusivelyExpressedBy (target: object): target is TFullInterface {
        return target[_interfaceType_] === this;
      }

      isExpressedBy (target: object): target is TFullInterface {
        const targetInterfaceType = target[_interfaceType_] as InterfaceType<any, TEnv, TCtorArgs> | undefined;
        if (isUndefined(targetInterfaceType)) return false;
        return targetInterfaceType.includesInterfaceType(this);
      }

      includesInterfaceType (type: InterfaceType<any, TEnv, TCtorArgs>): boolean {
        return type === this as any;
      }

      *propertyKeys (): IterableIterator<keyof TFullInterface> {
        for (const key in this.#descriptorMap) {
          yield key as keyof TFullInterface;
        }
        for (const symbol of Object.getOwnPropertySymbols(this.#descriptorMap)) {
          yield symbol as keyof TFullInterface;
        }
      }

      propertyDescriptor (key: keyof TFullInterface): TypedPropertyDescriptor<TFullInterface[keyof TFullInterface]> {
        const desc = this.#descriptorMap[key as string];
        if (isDefined(desc)) return desc;
        throw new Error(`Interface${this.name ? ` '${this.name}'` : ''} does not have a property named '${String(key)}'`);
      }

      becomeInterfaceOf (target: object): TFullInterface {
        return this.entityClass.cast(target, this);
      }

      expandInterfaceOf<TInstanceInterface extends object> (instance: TInstanceInterface): TFullInterface & TInstanceInterface {
        const instanceType = getInterfaceType<TInstanceInterface, TEnv, TCtorArgs>(instance);
        const expandedType = instanceType.composeWith(this);
        return expandedType.becomeInterfaceOf(instance);
      }

      excludeFromInterfaceOf<TOtherInterfaces extends object, TInstance extends TOtherInterfaces & TFullInterface> (instance: TInstance): TOtherInterfaces {
        const instanceType = getInterfaceType<any, TEnv, TCtorArgs>(instance);
        const reducedType = instanceType.excludeFromOwnComposition(this);
        return reducedType.becomeInterfaceOf(instance);
      }

      construct (...args: TCtorArgs): TFullInterface {
        return this.#entityClass.construct(this, args);
      }

      extend<TCallback extends Define.Callback<TFullInterface, TFullInterface, TEnv, TCtorArgs>> (callback: TCallback): Define.FinalInterfaceType<TFullInterface, TEnv, TCtorArgs, TCallback> {
        return this.entityClass.extend(this, callback);
      }

      #compositionsCache: WeakMap<InterfaceType<any, TEnv, TCtorArgs>, InterfaceType<any, TEnv, TCtorArgs>>;
      composeWith<TInterface2 extends object> (other: InterfaceType<TInterface2, TEnv, TCtorArgs>): InterfaceType<TFullInterface & TInterface2, TEnv, TCtorArgs>;
      composeWith (other: InterfaceType<any, TEnv, TCtorArgs>) {
        if (other instanceof CompositeInterface.Type) return other.composeWith(this);
        if (other instanceof AtomicInterfaceType) {
          const otherCached = other.#compositionsCache?.get(this);
          if (isDefined(otherCached)) return otherCached;
        }
        let cache = this.#compositionsCache;
        if (isUndefined(cache)) this.#compositionsCache = cache = new WeakMap();
        else {
          const cached = cache.get(other);
          if (isDefined(cached)) return cached;
        }
        const composed = CompositeInterface.define(this.#entityClass, [this, other]);
        cache.set(other, composed);
        return composed;
      }

      excludeFromOwnComposition (typeToExclude: InterfaceType<any, TEnv, TCtorArgs>): InterfaceType<any, TEnv, TCtorArgs> {
        if (typeToExclude === this as any) {
          throw new Error(`Cannot exclude an interface from itself -- there must be at least one interface remaining in any composition`);
        }
        return this;
      }
    }
    namespace AtomicInterfaceType {}
    export import Type = AtomicInterfaceType;
  }

  export namespace CompositeInterface {
    export class Type<TInterface extends object, TEnv extends object, TCtorArgs extends any[]> implements InterfaceType<TInterface, TEnv, TCtorArgs> {
      constructor (
        name: string,
        /** The class of entities that this composite interface type is intended to offer an interface for. */
        entityClass: EntityClass<TEnv, TCtorArgs>,
        /** A map of interface types that form the composed elements of this composite interface. */
        elements: Immutable.Map<number, InterfaceType<any, TEnv, TCtorArgs>>,
        /** A map of property names to the ids of the composed elements that define them. */
        members: Immutable.Map<keyof TInterface, number>,
        dummyInstance: TInterface,
      ) {
        this.#entityClass = entityClass;
        this.#name = name;
        this.#elements = elements;
        this.#members = members;
        this.#dummyInstance = dummyInstance;
      }
      readonly #entityClass: EntityClass<TEnv, TCtorArgs>;
      readonly #name: string;
      readonly #elements: Immutable.Map<number, InterfaceType<any, TEnv, TCtorArgs>>;
      readonly #members: Immutable.Map<keyof TInterface, number>;
      readonly #dummyInstance: TInterface;

      get name () { return this.#name; }
      get entityClass () { return this.#entityClass; }
      get [_dummy_] () { return this.#dummyInstance; }

      isExclusivelyExpressedBy (target: object): target is TInterface {
        return target[_interfaceType_] === this;
      }

      isExpressedBy (target: object): target is TInterface {
        const targetInterfaceType = target[_interfaceType_] as InterfaceType<any, TEnv, TCtorArgs> | undefined;
        return isUndefined(targetInterfaceType) ? false : targetInterfaceType.includesInterfaceType(this);
      }

      #cachedIncludesInterfaceType = new WeakMap<InterfaceType<any, TEnv, TCtorArgs>, boolean>();
      includesInterfaceType (type: InterfaceType<any, TEnv, TCtorArgs>): boolean {
        const cached = this.#cachedIncludesInterfaceType.get(type);
        if (isDefined(cached)) return cached;
        if (type === this) return true;
        const found = this.#elements.some((element) => element.includesInterfaceType(type));
        this.#cachedIncludesInterfaceType.set(type, found);
        return found;
      }

      *propertyKeys (): IterableIterator<keyof TInterface> {
        yield* this.#members.keys() as IterableIterator<keyof TInterface>;
      }

      propertyDescriptor (key: keyof TInterface): TypedPropertyDescriptor<TInterface[keyof TInterface]> {
        const id = this.#members.get(key);
        if (isDefined(id)) return (this.#elements.get(id) as InterfaceType<any, TEnv, TCtorArgs>).propertyDescriptor(key);
        throw new Error(`Composite interface${this.name ? ` '${this.name}'` : ''} does not have a property named '${String(key)}'`);
      }

      becomeInterfaceOf (target: object): TInterface {
        return this.entityClass.cast(target, this);
      }

      expandInterfaceOf<TInstanceInterface extends object> (instance: TInstanceInterface): TInterface & TInstanceInterface {
        const instanceType = getInterfaceType<TInstanceInterface, TEnv, TCtorArgs>(instance);
        const expandedType = instanceType.composeWith(this);
        return expandedType.becomeInterfaceOf(instance);
      }

      excludeFromInterfaceOf<TOtherInterfaces extends object, TInstance extends TOtherInterfaces & TInterface> (instance: TInstance): TOtherInterfaces {
        const instanceType = getInterfaceType<any, TEnv, TCtorArgs>(instance);
        const reducedType = instanceType.excludeFromOwnComposition(this);
        return reducedType.becomeInterfaceOf(instance);
      }

      construct (...args: TCtorArgs): TInterface {
        return this.#entityClass.construct(this, args);
      }

      extend<TCallback extends Define.Callback<TInterface, TInterface, TEnv, TCtorArgs>> (callback: TCallback): Define.FinalInterfaceType<TInterface, TEnv, TCtorArgs, TCallback> {
        return this.entityClass.extend(this, callback);
      }

      #compositionsCache: WeakMap<InterfaceType<any, TEnv, TCtorArgs>, InterfaceType<any, TEnv, TCtorArgs>>;
      composeWith<TInterface2 extends object> (other: InterfaceType<TInterface2, TEnv, TCtorArgs>): InterfaceType<TInterface & TInterface2, TEnv, TCtorArgs>;
      composeWith (other: InterfaceType<any, TEnv, TCtorArgs>) {
        let cache = this.#compositionsCache;
        if (isUndefined(cache)) this.#compositionsCache = cache = new WeakMap();
        else {
          const cached = cache.get(other);
          if (isDefined(cached)) return cached;
        }
        const composed = other.includesInterfaceType(this) ? other : CompositeInterface.define(this.#entityClass, [this, other]);
        cache.set(other, composed);
        return composed;
      }

      #exclusionsCache: WeakMap<InterfaceType<any, TEnv, TCtorArgs>, InterfaceType<any, TEnv, TCtorArgs>>;
      excludeFromOwnComposition<TInterface2 extends object> (typeToExclude: InterfaceType<TInterface2, TEnv, TCtorArgs>): InterfaceType<Exclude<TInterface, TInterface2>, TEnv, TCtorArgs> {
        let cache = this.#exclusionsCache;
        if (isUndefined(cache)) this.#exclusionsCache = cache = new WeakMap();
        else {
          const cached = cache.get(typeToExclude);
          if (isDefined(cached)) return cached;
        }
        let changed = false;
        const newElementSet: InterfaceType<any, TEnv, TCtorArgs>[] = [];
        for (const elementType of this.#elements.values()) {
          if (elementType === typeToExclude) {
            changed = true;
            continue;
          }
          const updated = elementType.excludeFromOwnComposition(typeToExclude);
          if (updated !== elementType) changed = true;
          newElementSet.push(updated);
        }
        const excluded = (changed ? CompositeInterface.define(this.#entityClass, newElementSet) : this) as InterfaceType<any, TEnv, TCtorArgs>;
        cache.set(typeToExclude, excluded);
        return excluded;
      }
    }

    export type Element<TEnv extends object, TCtorArgs extends any[]> = InterfaceTypeRef<any, TEnv, TCtorArgs> | Element<TEnv, TCtorArgs>[];

    /**
     * Interfaces are processed from left to right, with the leftmost interface having the highest precedence when
     * resolving naming conflicts between members.
     * @param entityClass The class of entities that this composite interface type is intended to offer an interface for.
     * @param [name] The name of the composite interface. Defaults to `null` if omitted.
     * @param elements A nestable array of interface types to compose into a single interface. Any nested array
     *   encountered is first composed in isolation and the resultant interface is then processed as a single element in
     *   the larger composition.
     */
    export function define<TCompositeInterface extends object, TEnv extends object, TCtorArgs extends any[]> (
      entityClass: EntityClass<TEnv, TCtorArgs>,
      ...args: EntityClass.Overloads.DefineComposite<TEnv, TCtorArgs>
    ): InterfaceType<TCompositeInterface, TEnv, TCtorArgs> {
      const state = createState(entityClass);
      let elements: Element<TEnv, TCtorArgs>[];
      switch (args.length) {
        case 1: elements = args[0]; break;
        case 2: state.name = args[0].trim() || null; elements = args[1]; break;
      }
      for (let i = 0; i < elements!.length; i++) {
        addElement(state, elements![i]);
      }
      return finalize(state);
    }
    export interface State<TEnv extends object, TCtorArgs extends any[]> {
      entityClass: EntityClass<TEnv, TCtorArgs>;
      name: string | null;
      names: string[];
      properties: PropertyDescriptorMap;
      elements: Immutable.Map<number, InterfaceType<any, TEnv, TCtorArgs>>;
      members: Immutable.Map<any, number>;
    }
    const createState = <TEnv extends object, TCtorArgs extends any[]>(entityClass: EntityClass<TEnv, TCtorArgs>): State<TEnv, TCtorArgs> => ({
      entityClass,
      name: null,
      names: [],
      properties: {},
      elements: Immutable.Map<number, InterfaceType<any, TEnv, TCtorArgs>>().asMutable(),
      members: Immutable.Map<string, number>().asMutable(),
    });
    function addElement<TEnv extends object, TCtorArgs extends any[]> (state: State<TEnv, TCtorArgs>, element: Element<TEnv, TCtorArgs>): void {
      let type: InterfaceType<any, TEnv, TCtorArgs>;
      if (isArray(element)) {
        switch (element.length) {
          case 0: return;
          case 1: return addElement(state, element[0]);
        }
        const nestedState = createState(state.entityClass);
        for (let i = 0; i < element.length; i++) {
          addElement(nestedState, element[i]);
        }
        type = finalize(nestedState);
      }
      else {
        type = isInterfaceTypeNS(element) ? element.InterfaceType : element;
        if (type.name) {
          state.names.push(type.name);
        }
      }
      const id = IdGenerator.global();
      let added = 0;
      for (const key of type.propertyKeys()) {
        ++added;
        state.members.set(key, id);
        state.properties[key] = type.propertyDescriptor(key);
      }
      if (added > 0) {
        state.elements.set(id, type);
      }
    }
    export function finalize<TInterface extends object, TEnv extends object, TCtorArgs extends any[]> (state: State<TEnv, TCtorArgs>): InterfaceType<TInterface, TEnv, TCtorArgs> {
      const name = (state.name ?? `_${state.names.join('$')}_`) || 'AnonymousInterface';
      return new CompositeInterface.Type(
        name,
        state.entityClass,
        state.elements.asImmutable(),
        state.members.asImmutable(),
        Object.create(null, state.properties) as TInterface,
      );
    }
  }

  export function getInterfaceType<TInterface extends object, TEnv extends object, TCtorArgs extends any[]> (instance: TInterface): InterfaceType<TInterface, TEnv, TCtorArgs> {
    const instanceType = instance[_interfaceType_] as InterfaceType<TInterface, TEnv, TCtorArgs>;
    if (isUndefined(instanceType)) {
      throw new Error(`'instance' object is not a valid entity managed by an InterfaceType`);
    }
    return instanceType;
  }

  export function switchIncludedInterface<TBaseInterface extends object, TInterfaceToRemove extends object, TInterfaceToAdd extends object, TEnv extends object, TCtorArgs extends any[]> (
    typeToRemove: InterfaceType<TInterfaceToRemove, TEnv, TCtorArgs>,
    typeToAdd: InterfaceType<TInterfaceToAdd, TEnv, TCtorArgs>,
    instance: TBaseInterface & TInterfaceToRemove,
  ): TBaseInterface & TInterfaceToAdd {
    const instanceType = getInterfaceType<TBaseInterface & TInterfaceToRemove, TEnv, TCtorArgs>(instance);
    const newType = instanceType.excludeFromOwnComposition(typeToRemove).composeWith(typeToAdd);
    return newType.becomeInterfaceOf(instance);
  }

  const InterfaceProxyHandler = CompositionalBlackboxing.InterfaceProxyHandler({ _interfaceType_, _env_, _dummy_ });
}
