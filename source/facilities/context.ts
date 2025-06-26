import * as Immutable from 'immutable';
import type { cmsg } from '../browser/console/console-message';
import { DisposableGroup, dispose } from '../general/disposables';
import { throwError } from '../general/errors';
import { isDefined, isFunction, isNonClassFunction, isNotNull, isNull, isObject, isUndefined } from '../general/type-checking';
import { inls } from '../primitive';
import { Compositional } from './compositional/compositional';

export type Context = Context.Immediate;
/**
 * A base implementation of a context class minus anything specific to any particular graph or system implementation.
 * This implementation is designed to be a self-contained facility with no domain-specific dependencies, its purpose
 * being to make it easy to interoperate with different context-aware subsystems without any of them losing the ability
 * to access contexts originating in other implementation domains, or to freely switch between context implementations
 * when transitioning from one implementation domain to another.
 *
 * The `Context` namespace tries to remain as unopinionated as possible about how data and state in different contexts
 * is interpreted or managed, or what a given context-oriented execution path is expected to return or how it fits into
 * a larger architectural picture. All the base implementation cares about is the idea that an execution stack is by
 * nature a phenomenon that naturally accumulates layers of context (conceptually speaking -- context always exists in
 * reality even if that context is not directly tracked or recorded to make it easy to access later) as one process
 * initiates another process, which in turn initiates a subprocess of its own. Hence, it can be used in contexts
 * involving declaration, staging, immediate effect-producing execution, etc. Furthermore, the `Context` namespace does
 * not enforce any opinion regarding what should be captured during execution of a graph of functions and/or class
 * methods. A function an `Context.Immediate` instance is passed to is free to pass that same instance to multiple
 * subbranches if it makes sense in that context within that implementation domain. It's up to individual subsystem
 * implementations to determine what does and does not make sense, and what safeguards should be implemented as
 * extensions to support their own domain-specific requirements.
 *
 * Most extensibility explicitly provided for is designed around the standard DRIVER + DATA pattern, such that a driver
 * tends to represent a class of things, and data accompanying a driver object is representative of a specific instance
 * of that class of things, and intended to be passed to the driver's methods whenever they are called, but not
 * otherwise interpreted, consumed or modified in any way externally to the driver implementation. Anywhere
 * extensibility support is provided, most extendable features and capabilities will remain optional if at all possible.
 *
 * TODO: The `bind` method should include the ability to specify the purpose of the binding. If we're binding something
 * as part of the current context, this is equivalent to making a contextual statement. Statements are always made for a
 * reason, and with the introduction of the `Goal` namespace as a way of guiding the structure and flow of the
 * implementation, opportunities to link bindings to something explaining their purpose start to reveal themselves.
 */
export namespace Context {
  export type InferBindingData<TDriver> = TDriver extends Driver<infer TBindingData> ? TBindingData : never;

  export interface Driver<TBindingData = unknown> {
    /**
     * A relatively unique, human-understandable identifier, preferably formatted as a namespace-style path/identifier.
     * Used primarily for purposes of logging and diagnostic purposes, especially during debugging, as driver object
     * references logged to the console can be harder to mentally cross-reference when they lack a readable label.
     */
    readonly label: string; // Would be better as `name`, but needs to avoid being treated as type-compatible with function references.
    readonly brief?: string;
    readonly notes?: string;
    /**
     * Allows the driver to explicitly define which types of queries it is able to match and resolve. Queries can be
     * handled either by a context driver, a query driver, or both. When a context driver directly implements support
     * for matching and resolving queries, that implementation will always take precedence over what any corresponding
     * query driver might implement itself. If the context driver does not match a query of a particular type, or it
     * returns a deferential response (opting out of the resolution process partway through after an initial match has
     * been made), then resolution falls back to the associated query driver, assuming it implements its own default
     * support for resolving queries of that type.
     * @see {@link Driver.Queries} — In addition to exporting a type interface, this also exports as a convenient helper
     * function for easily defining query-matching and resolution logic in a type-safe manner.
     * @see {@link Query.Type} — Provides useful information about the nature of the querying subsystem, and how it is designed
     * to work.
     */
    readonly queries?: Driver.Queries<TBindingData>;
  }
  export namespace Driver {
    export type ResolveQuery<A extends any[], Q> = (queryType: Query.Type<A, Q>, binding: ContextBinding, ...args: A) => Query.Result<Q> | null;

    export interface Queries<C> {
      /**
       * Used for testing whether or not a context driver supports queries of a particular type (matched against
       * instances of `Query.Type`). Given that some query types may only be a broad means of categorising queries
       * within a particular domain, and that various subtypes of that query type may exist, the `supportedTypes` field
       * should be considered only as an initial screen/filter for initiating the matching and resolution process. A
       * successful match is followed be a call to `resolve`, which can then perform additional tests as needed. If any
       * of those tests fail, `resolve` can return `null`, indicating that the driver has "opted out" of providing a
       * response (i.e. it has classified itself as being unable or unwilling to attempt finalisation of the resolution
       * process for this particular query instance). When this happens, resolution will fall back to whatever other
       * pathways would have been followed if the initial `supportedTypes` test had failed.
       *
       * Note: Only a `has` member is mandated. In general it is anticipated that a standard `Set` instance will usually
       * be used for this field (more convenient than implementing something manually), but constraining the set of
       * required interface members exclusively to `has` allows for other implementation approaches to be used instead,
       * if desired.
       */
      readonly supportedTypes: Pick<ReadonlySet<Query.Type>, 'has'>;
      /**
       * There are two classes of response that a driver can provide in response to a query it attempts to resolve:
       * 1. DEFINITIVE: A concrete result (where `result.status` is 'success' or 'failure') means that the driver has
       *    provided what it considers to be a definitive response to the query, and that it should be treated as
       *    authoritative and final. No fallback to other contexts or to the query type's own built-in query resolution
       *    logic is required.
       * 2. DEFERENTIAL: A `null` result indicates that the driver either does not support queries of this type, or has
       *    simply opted out of providing a result in this particular instance.
       *
       * @remarks
       * A context driver may return a deferential response (i.e. `null`, aka opting out of a providing a query result)
       * in cases where the query type is defined such that queries of that type take one or more arguments beyond the
       * query type itself. The context driver may only be able to support a subset of argument ranges within those that
       * the query type itself deems valid. For arguments outside of the supported range, those arguments are only
       * invalid in this context, hence a failure response would be inappropriate. Instead, the driver should return
       * `null` to indicate that the query is not supported in _this_ context, but may be supported in other contexts
       * that are candidates for the current query.
       */
      resolve<A extends any[], Q> (binding: ContextBinding<C>, queryType: Query.Type<A, Q>, ...args: A): Query.Result<Q> | null;
    }
    /**
     * @example
     * export const MyDriver: Context.Driver<MyBindingData> = {
     *   label: 'MyDriver',
     *   queries: Context.Driver.Queries((match, when, ok, fail) => match([])),
     */
    export function Queries<C> (
      /**
       * Provides a function (`match`) for defining a list of query types that contexts of this type can match, and a
       * function to use to create each entry in the list (`when`).
       *
       * Four functions are provided to the callback to make it easy to prepare query resolution logic:
       *
       * - `match` — Pass this an array of `Queries.Entry` tuples, each constructed using the `when` function.
       * - `when` — Use this to construct a `Queries.Entry` tuple without having to experience type-related headaches.
       *
       * Inside the body of one of the `resolveQuery` ({@link Queries.ResolveQuery}) functions passed to the `when`
       * function, the following functions are provided to produce explicit query results:
       *
       * - `ok` — Use this when the query was successfully resolved and a result is available.
       * - `fail` — Use this when the query was successfully matched, but no result could be provided for some reason.
       */
      callback: (
        /**
         * Each entry is a tuple of: [<context type (typically a driver reference)>, <query resolver function>]
         *
         * Note that the main purpose of this function is to facilitate type safety, which in this case is difficult to
         * achieve robustly using TypeScript's type system alone. Using the `match` function instead of just directly
         * inlining the array of entries helps TypeScript infer type information everywhere it might be needed, avoiding
         * the need for additional type annotations or type assertions, the need for which may be unclear when actually
         * writing the code and being faced with unwanted TypeScript type errors.
         */
        match: <A extends any[], Q>(entries: Queries.Entry<C, A, Q>[]) => Queries<C>,
        /**
         * Creates a `Queries.Entry` tuple.
         * @param queryType The query type that the context driver is nominating itself as being able to (at least potentially) resolve.
         * @param resolveQuery The function that will be called to resolve the query if its type is equivalent to `queryType`.
         */
        when: <A extends any[], Q>(
          queryType: Query.Type<A, Q>,
          resolveQuery: Queries.ResolveQuery<C, A, Q>
        ) => Queries.Entry<C, A, Q>,
        /**
         * When resolving a call to the `resolveQuery` function (see {@link Queries.ResolveQuery}), a
         * {@link Query.Result} value must be returned. The `ok` function is provided as a convenience for concisely and
         * consistently constructing a successful result in a type-safe manner.
         */
        ok: <Q>(value: Q) => Query.Result.Success<Q>,
        /**
         * When resolving a call to the `resolveQuery` function (see {@link Queries.ResolveQuery}), a
         * {@link Query.Result} value must be returned. The `fail` function is provided as a convenience for concisely
         * and consistently constructing an explicit failure result in a type-safe manner.
         *
         * Note: A failure result indicates that the query type WAS a successful match and was the correct final path to
         * follow for resolving the query in this context, but that the anticipated result could not be made available
         * to the caller for some reason. A failure result is considered the final result of a query resolution process.
         * If some form of fallback is required, this is the responsibility of the caller, not the query subsystem.
         *
         * Note: If the resolution process only wishes to terminate deferentially (opting out of its participation in
         * the resolution process rather than explicitly indicating failure) such that the system will fall back to
         * whatever other resolution pathways are still available, then `null` should be returned instead.
         */
        fail: (queryType: Query.Type, contextType: Driver, reason: string) => Query.Result.Failure
      ) => Queries<C>
    ): Queries<C> {
      return new Proxy({ actual: undefined } as any, {
        get (t, p, r) {
          if (isUndefined(t.actual)) {
            function match<A extends any[], Q> (entries: Queries.Entry<C, A, Q>[]): Queries<C> {
              const map = new Map<Query.Type, Queries.ResolveQuery<C>>(entries);
              return {
                supportedTypes: map,
                resolve<A extends any[], Q> (binding: ContextBinding<C>, queryType: Query.Type<A, Q>, ...args: A): Query.Result<Q> | null {
                  const resolver = map.get(queryType) as undefined | Queries.ResolveQuery<C, A, Q>;
                  if (isUndefined(resolver)) return null;
                  return resolver(binding, ...args);
                },
              };
            }
            function when<A extends any[], Q> (queryType: Query.Type<A, Q>, resolveQuery: Queries.ResolveQuery<C, A, Q>): Queries.Entry<C, A, Q> {
              return [queryType, resolveQuery];
            }
            const ok = <Q>(value: Q): Query.Result.Success<Q> => ({ status: 'success', success: true, value });
            const fail = (queryType: Query.Type, contextType: Driver, reason: string): Query.Result.Failure => ({ status: 'failure', success: false, queryType, contextType, reason });
            t.actual = callback(match, when, ok, fail);
          }
          return Reflect.get(t.actual, p, r);
        },
      });
    }
    export namespace Queries {
      /**
       * A `Queries.Entry` tuple is a pair of a query type and a resolver function.
       *
       * - Element #0 - `queryType` - The query type that the context driver is nominating itself as being able to (at
       *   least potentially) resolve.
       * - Element #1 - `resolveQuery` - The function that will be called to resolve the query if its type is equivalent
       *   to `queryType`.
       */
      export type Entry<C, A extends any[], Q> = [queryType: Query.Type<A, Q>, resolveQuery: ResolveQuery<C, A, Q>];
      /**
       * A `Queries.ResolveQuery` function is responsible for resolving a query of a particular type. The function is
       * passed the context binding for the context that the query is being resolved in, along with any arguments
       * associated with the query.
       *
       * - To return an explicit result and end the resolution process, the function should return a `Query.Result`
       *   object with a `status` of `'success'` or `'failure'`.
       * - To cancel further execution of the implemented resolution logic and instead opt out of the resolution
       *   process, deferring to whatever other resolution pathways are still available as fallbacks beyond this point,
       *   the function should return `null`.
       */
      export type ResolveQuery<C, A extends any[] = any[], Q = any> = (binding: Binding<C>, ...args: A) => Query.Result<Q>;
    }
  }

  export type Type<TBindingData = unknown> = Driver<TBindingData> | Type.NS<TBindingData>;
  export namespace Type {
    export type NS<TBindingData> = NS.OfDriver<TBindingData> | NS.OfContextDriver<TBindingData>;
    export namespace NS {
      export type OfDriver<TBindingData> = { readonly Driver: Driver<TBindingData>; ContextDriver?: never };
      export type OfContextDriver<TBindingData> = { readonly ContextDriver: Driver<TBindingData>; Driver?: never };
    }
    export type InferBindingData<TType extends Type> = TType extends Type<infer TBindingData> ? TBindingData : never;
    export function unbox<TBindingData, T extends Type<TBindingData> | Driver<TBindingData>> (type: T): T extends Type ? Driver<TBindingData> : T extends Driver ? Driver<TBindingData> : never;
    export function unbox (type: Type) {
      if ('Driver' in type) return type.Driver;
      if ('ContextDriver' in type) return type.ContextDriver;
      return type;
    }
  }

  export function Sentinel (): ContextBinding<Sentinel> {
    const abort = new Abort(new AbortController());
    return ContextBinding.create(null, Sentinel.ContextDriver, { abort });
  }
  export interface Sentinel {
    readonly abort: Abort;
  }
  export namespace Sentinel {
    export const ContextDriver: Driver<Sentinel> = {
      label: 'Context.Sentinel',
      queries: Driver.Queries((match, when, ok) => match([
        when(Abort.QueryType, (binding) => ok(binding.data.abort)),
      ])),
    };
  }

  /**
   * A `ContextBinding` represents a single layer of contextual detail in a stack of contexts that superimpose each
   * other to form an overall view of the context of a given point in a system's execution. Each binding is associated
   * with a specific driver, which is responsible for interpreting the binding data in a way that is meaningful to the
   * system as a whole. The binding data is opaque to the context system itself, and is only ever intended to be
   * interpreted by the driver that the binding is associated with (and in some cases by parts of the implementation
   * domain that the driver belongs to).
   *
   * Note that `ContextBinding` instances provide low-level access to the context graph and should be understood as
   * offering functionality that, if used improperly, could place the context graph into an invalid state. As such, when
   * providing context references to untrusted parts of an implementation, the binding's `view` property should be
   * shared rather than the binding itself. The `view` property (which is an instance of `ContextView`) hides direct
   * access to state-altering aspects of the binding it wraps, and provides additional methods and properties designed
   * to facilitate traversal and navigation of the context graph in a safe and controlled manner.
   */
  class ContextBinding<TBindingData = unknown> {
    static create<TDriver extends Driver> (basis: ContextBinding | null, driver: TDriver, bindingData: InferBindingData<TDriver>): ContextBinding<InferBindingData<TDriver>>;
    static create (basis: ContextBinding | null, driver: Driver<void>): ContextBinding<void>;
    static create (basis: ContextBinding | null, driver: Driver, bindingData?: unknown): ContextBinding {
      return new ContextBinding(basis, driver, bindingData, isNull(basis) ? 0 : basis.depth + 1);
    }
    private constructor (
      public readonly basis: ContextBinding | null,
      public readonly driver: Driver<TBindingData>,
      public readonly data: TBindingData,
      public readonly depth: number,
    ) {}
    #view?: View;
    #indexer?: Indexer;

    get view (): View { return this.#view ??= new ContextView(this); }
    get indexer (): Indexer { return this.#indexer ??= new Indexer(this); }
    get bindingTypeName (): string { return this.driver.label; }

    is<TDriver extends Driver> (driver: TDriver): this is ContextBinding<InferBindingData<TDriver>> {
      return this.driver === driver;
    }

    bind (driver: Driver<void>): ContextBinding;
    bind<TDriver extends Driver> (driver: TDriver, bindingData: InferBindingData<TDriver>): ContextBinding;
    bind (driver: Driver, bindingData?: unknown): ContextBinding {
      return ContextBinding.create(this, driver, bindingData);
    }

    locate<TDriver extends Driver> (driver: TDriver): ContextBinding<InferBindingData<TDriver>> {
      const facet = BindingsIndex.resolve(this, driver);
      return facet.current;
    }
    tryLocate<TDriver extends Driver> (driver: TDriver): ContextBinding<InferBindingData<TDriver>> | undefined {
      const facet = BindingsIndex.resolve(this, driver);
      if (!facet.isEmpty) return facet.current;
    }

    unbind<TDriver extends Driver> (driver: TDriver): InferBindingData<TDriver> {
      const facet = BindingsIndex.resolve(this, driver);
      return facet.current.data;
    }
    tryUnbind<TDriver extends Driver> (driver: TDriver): InferBindingData<TDriver> | undefined {
      const facet = BindingsIndex.resolve(this, driver);
      if (!facet.isEmpty) return facet.current.data;
    }

    // query<A extends any[], Q> (type: Query.Type<A, Q>, ...args: A): Q {
    //   // if (isDefined(this.driver.query)) return this.driver.query(this, type, ...args);
    //   // if (isDefined(type.supports)) {}
    //   const index = this.indexer.get(QueryabilityIndex.IndexerDriver);
    //   throw new Error(`Not Implemented`);
    // }

    #interfaceCache?: WeakMap<object, object>;
    useInterface<TContext extends ImmediateContext> (contextInterfaceType: Compositional.EntityClass.ToInterfaceType<TContext, ImmediateContext.Class>): TContext;
    useInterface (contextInterfaceType: Compositional.InterfaceType) {
      const interfaceCache = this.#interfaceCache ??= new WeakMap();
      let instance = interfaceCache.get(contextInterfaceType);
      if (isUndefined(instance)) {
        instance = contextInterfaceType.construct(this);
        interfaceCache.set(contextInterfaceType, instance);
      }
      return instance;
    }
  }
  namespace ContextBinding {}
  export import Binding = ContextBinding;

  const _binding_ = Symbol('ContextView/_binding_');
  /**
   * A `ContextView` is a read-only reference view of the context graph from the point of view of a specific context
   * binding. See the documentation for {@link ContextBinding `ContextBinding`} for further information.
   */
  class ContextView {
    constructor (binding: ContextBinding) { this.#binding = binding; }
    readonly #binding: ContextBinding;

    get [_binding_] (): ContextBinding { return this.#binding; }

    get bindingTypeName (): string { return this.#binding.driver.label; }
    get depth (): number { return this.#binding.depth; }
    protected get indexer (): Indexer { return this.#binding.indexer; }

    locate<TDriver extends Driver> (driver: TDriver): ContextBinding<InferBindingData<TDriver>> {
      return this.#binding.locate(driver);
    }
    tryLocate<TDriver extends Driver> (driver: TDriver): ContextBinding<InferBindingData<TDriver>> | undefined {
      return this.#binding.tryLocate(driver);
    }

    unbind<TDriver extends Driver> (driver: TDriver): InferBindingData<TDriver> {
      return this.#binding.unbind(driver);
    }
    tryUnbind<TDriver extends Driver> (driver: TDriver): InferBindingData<TDriver> | undefined {
      return this.#binding.tryUnbind(driver);
    }

    // query<A extends any[], Q> (type: Query.Type<A, Q>, ...args: A): Q {
    //   return this.#binding.query(type, ...args);
    // }

    useInterface<TContext extends ImmediateContext> (contextInterfaceType: Compositional.EntityClass.ToInterfaceType<TContext, ImmediateContext.Class>): TContext {
      return this.#binding.useInterface(contextInterfaceType);
    }
  }
  namespace ContextView {
    export const __unsafe_access_to_binding = (context: ContextView): ContextBinding => context[_binding_];
  }
  export import View = ContextView;

  export function getInterfaceType<TContext extends Context> (context: TContext): ImmediateContext.InterfaceType.Of<TContext> {
    return Compositional.getInterfaceType(context);
  }
  export function unboxInterfaceType<TContext extends Context> (target: ImmediateContext.InterfaceType.OrNS<TContext>): ImmediateContext.InterfaceType.Of<TContext> {
    return 'InterfaceType' in target ? target.InterfaceType : target;
  }

  /**
   * @example
   * export interface MyContext extends Compositional.ExtractInterface<typeof MyContext> {}
   * export const MyContext = Context.defineInterface(($Context) => (
   *  class MyContext extends $Context.EntityInstance {
   *   // ...
   *  }
   * )
   */
  export function defineInterface<TCallback extends Compositional.Define.Callback.FromClass<ImmediateContext.Class, ImmediateContext>> (callback: TCallback) {
    return ImmediateContext.InterfaceType.extend(callback);
  }

  /**
   * @example
   * const FooBarBazContext = Context.compose(FooContext, BarContext, BazContext);
   */
  export function compose<A extends Compositional.InterfaceTypeRef.FromClass<any, ImmediateContext.Class>[]> (...targets: A) {
    const type = ImmediateContext.Class.compose(targets);
    type TInterface = Compositional.ExtractInterface<typeof type>;
    type TInterfaceType = Compositional.EntityClass.ToInterfaceType<TInterface, Context.Immediate.Class>;
    return type as TInterfaceType;
  }

  /**
   * `ImmediateContext` is the base implementation of an API layer designed to allow execution pathways to query and
   * extend the context graph so as to make sure that subcontextual processes have visibility of the full context of
   * their execution, and can extend it themselves in the same way.
   */
  type ImmediateContext = Compositional.ExtractInterface<typeof ImmediateContext.InterfaceType>;
  namespace ImmediateContext {
    export const test = (value: unknown): value is ImmediateContext => isObject(value) && InterfaceType.isExpressedBy(value);

    export type Callback<TContext extends ImmediateContext, A extends unknown[], B> = (context: TContext, ...args: A) => B;
    export type ExtendedType<T extends ImmediateContext> = Compositional.InterfaceType<T, Class.Env, Class.CtorArgs>;

    export function create (binding: ContextBinding): ImmediateContext {
      return Class.construct(InterfaceType, [binding]);
    }
    export function createSentinel (): ImmediateContext;
    export function createSentinel<TContext extends ImmediateContext> (interfaceType: Compositional.InterfaceType.From<Class, TContext>): TContext;
    export function createSentinel (interfaceType: Compositional.EntityClass.ToInterfaceType<any, typeof Class> = InterfaceType) {
      return interfaceType.construct(Sentinel());
    }

    export type Class = typeof Class;
    export const Class = Compositional.EntityClass.new(class ContextEnv {
      constructor (protected readonly _binding: ContextBinding) {}

      protected facet<TBindingData> (driver: Context.Driver<TBindingData>): BindingsIndex.Facet<TBindingData> {
        return BindingsIndex.resolve(this._binding, driver);
      }
    });
    export namespace Class {
      export type Env = Compositional.EntityClass.ExtractEnv<Class>;
      export type CtorArgs = Compositional.EntityClass.ExtractCtorArgs<Class>;
    }

    export type BindPair<T> = [Driver<T>, T];
    export type BindPairs<B extends readonly BindPair<unknown>[]> = { [I in keyof B]: B[I] extends BindPair<infer T> ? BindPair<T> extends B[I] ? B[I] : [any, InvalidPairMessage, never] : [InvalidPairMessage, any, never] };
    type InvalidPairMessage = `The first element must be a context driver and the second element must match the driver\'s binding data type.`;

    const _queryResultCache_ = Symbol('ImmediateContext[_queryResultCache_]');
    const _abort_ = Symbol('ImmediateContext.abort');
    const _locked_ = Symbol('ImmediateContext.locked');
    const _uniqueCount_ = Symbol('ImmediateContext.uniqueCount');

    export type InterfaceType = typeof InterfaceType;
    export const InterfaceType = Class.define((type) => class _ImmediateContext extends type.EntityInstance {
      [_abort_]?: Abort;
      [_locked_] = false;
      [_uniqueCount_]: number;

      get view (): View { return this._binding.view; }
      get abort (): Abort { return this[_abort_] ??= this.query(Abort.QueryType); }
      get disposables (): DisposableGroup { return this.abort.disposables; }

      abortable<TContext extends ImmediateContext> (this: TContext, controller: AbortController): TContext {
        this._assertNotLocked();
        return this.abort.forkToContext(this, controller);
      }

      onAbort (callback: () => void): this {
        this.abort.addListener(callback);
        return this;
      }

      /**
       * Shortcut to `this.abort.disposables.add(disposable)`
       */
      disposeOnAbort (...disposable: LooseDisposable[]): this {
        this.disposables.add(disposable);
        return this;
      }

      /**
       * Use this when passing a client context to a provider that will be doing work on behalf of the client. Locking
       * the context prevents the agent providing the service from inadvertently extending the client context as though
       * it were its own context. Any attempt to bind to a locked context will throw an error, which means that a
       * provider is free to query and traverse the locked context, but any subcontexts they generate must be extensions
       * of their own context - not the client's.
       *
       * Note that calling the `lock` method is simply a failsafe to facilitate defensive programming. Forgetting to
       * lock a client context before passing it to a provider should not be detrimental to the execution of a
       * well-behaving provider implementation.
       */
      lock (): this {
        if (this[_locked_]) {
          throw new Error(`Context is already locked. There should never be cause to lock a context more than once. If this happens it's likely a bug or a design flaw in the calling implementation.`);
        }
        this[_locked_] = true;
        return this;
      }

      private _assertNotLocked () {
        if (this[_locked_]) throw new Error(`Cannot bind to a locked context. Are you sure you're binding against the correct context instance?`);
      }
      bind<TContext extends ImmediateContext> (this: TContext, driver: Driver<void>): TContext;
      bind<TContext extends ImmediateContext, TDriver extends Driver> (this: TContext, driver: TDriver, bindingData: InferBindingData<TDriver>): TContext;
      bind<TContext extends ImmediateContext, TType extends Type> (this: TContext, type: TType, bindingData: Type.InferBindingData<TType>): TContext;
      bind<TContext extends D, D extends ImmediateContext, A extends any[]> (this: TContext, bind: (context: D, ...args: A) => D, ...args: A): TContext;
      bind<TContext extends D, D extends ImmediateContext, A extends any[]> (this: TContext, bind: { bindContext: (context: D, ...args: A) => D }, ...args: A): TContext;
      bind<TContext extends ImmediateContext, RContext extends ImmediateContext, TBind extends BindUsing.Bind.OrNS<TContext, any, RContext>> (this: TContext, bind: TBind, ...args: BindUsing.Bind.InferArgs<TBind>): RContext;
      bind<TBind extends BindUsing.Bind.OrNS<this>> (this: BindUsing.Bind.InferTContext<TBind>, bind: TBind, ...args: BindUsing.Bind.InferArgs<TBind>): BindUsing.Bind.InferRContext<TBind>;
      bind (arg0: Driver | Type | BindUsing.Bind.OrNS, ...rest: any[]) {
        this._assertNotLocked();
        if (isNonClassFunction(arg0)) return arg0(this, ...rest);
        if ('bindContext' in arg0) return arg0.bindContext(this, ...rest);
        const driver = Type.unbox(arg0);
        const binding = ContextBinding.create(this._binding, driver, rest.length === 0 ? undefined : rest[0]);
        return type.entityClass.constructSameAs(this, [binding]);
      }
      bindAs<TContext extends ImmediateContext> (contextInterfaceType: Compositional.EntityClass.ToInterfaceType<TContext, Class>, driver: Driver<void>): TContext;
      bindAs<TContext extends ImmediateContext, TDriver extends Driver> (contextInterfaceType: Compositional.EntityClass.ToInterfaceType<TContext, Class>, driver: TDriver, bindingData: InferBindingData<TDriver>): TContext;
      bindAs<TContext extends ImmediateContext, TType extends Type> (contextInterfaceType: Compositional.EntityClass.ToInterfaceType<TContext, Class>, type: TType, bindingData: Type.InferBindingData<TType>): TContext;
      bindAs<TContext extends ImmediateContext> (contextInterfaceType: { InterfaceType: Compositional.EntityClass.ToInterfaceType<TContext, Class> }, driver: Driver<void>): TContext;
      bindAs<TContext extends ImmediateContext, TDriver extends Driver> (contextInterfaceType: { InterfaceType: Compositional.EntityClass.ToInterfaceType<TContext, Class> }, driver: TDriver, bindingData: InferBindingData<TDriver>): TContext;
      bindAs<TContext extends ImmediateContext, TType extends Type> (contextInterfaceType: { InterfaceType: Compositional.EntityClass.ToInterfaceType<TContext, Class> }, type: TType, bindingData: Type.InferBindingData<TType>): TContext;
      bindAs<TContext extends ImmediateContext> (
        contextInterfaceType: Compositional.EntityClass.ToInterfaceType<TContext, Class> | { InterfaceType: Compositional.EntityClass.ToInterfaceType<TContext, Class> },
        arg1: Driver | Type,
        bindingData?: unknown
      ): TContext {
        this._assertNotLocked();
        if ('InterfaceType' in contextInterfaceType) contextInterfaceType = contextInterfaceType.InterfaceType;
        const driver = Type.unbox(arg1);
        const binding = ContextBinding.create(this._binding, driver, bindingData);
        if (contextInterfaceType.isExpressedBy(this)) return type.entityClass.constructSameAs(this, [binding]);
        return contextInterfaceType.construct(binding);
      }

      bindAll<B extends readonly BindPair<unknown>[]> (bindings: BindPairs<B>): this {
        const binding = this._bindAll(bindings);
        return type.entityClass.constructSameAs(this, [binding]);
      }
      bindAllAs<TContext extends ImmediateContext, B extends readonly BindPair<unknown>[]> (contextInterfaceType: InterfaceType.OrNS<TContext>, bindings: BindPairs<B>): TContext {
        const binding = this._bindAll(bindings);
        if ('InterfaceType' in contextInterfaceType) contextInterfaceType = contextInterfaceType.InterfaceType;
        return contextInterfaceType.construct(binding);
      }
      private _bindAll (bindings: BindPairs<readonly BindPair<unknown>[]>): ContextBinding<any> {
        this._assertNotLocked();
        let binding = this._binding;
        for (let i = 0; i < bindings.length; i++) {
          const [driver, bindingData] = bindings[i];
          binding = binding.bind(driver, bindingData);
        }
        return binding;
      }

      /**
       * Generally intended for use as a placeholder where a unique subcontextual branch is required and no other more
       * specific form of establishing a branch has been implemented. To retrieve the annotation value, use
       * {@link unbind}, passing {@link Context.Annotation} as an argument.
       */
      a (...annotation: any): this;
      a (...args: any): this {
        let annotation: any;
        switch (args.length) {
          case 0: annotation = null; break;
          case 1: annotation = args[0]; break;
          default: annotation = args; break;
        }
        return this.bind(Annotation, annotation);
      }
      /**
       * `uq` returns a new, unique subcontext whenever it is accessed. The returned context is made unique by
       * annotating it automatically (via an internal call to the {@link a} method) with an integer indicating
       * the number of times this property has already been accessed against this specific context instance prior to the
       * current access. The bound annotation could be used diagnostically to easily determine which bit of code was the
       * origin of a given subcontextual branch when multiple subcontextual branches are originating from the same
       * branch point. To retrieve the annotation value, use {@link unbind}, passing {@link Context.Annotation} as an
       * argument.
       */
      get uq (): this {
        const count = (this[_uniqueCount_] ??= 0);
        this[_uniqueCount_] = count + 1;
        return this.a(count);
      }

      getClosestContextBoundTo<TDriver extends Driver> (driver: TDriver): this {
        const context = this.tryGetClosestContextBoundTo(driver);
        if (isUndefined(context)) {
          throw new Error(`There is no binding of type "${driver.label}" in this context`);
        }
        return context;
      }
      tryGetClosestContextBoundTo<TDriver extends Driver> (driver: TDriver): this | undefined {
        const binding = this._binding.view.tryLocate(driver);
        if (isUndefined(binding)) return;
        const type = getInterfaceType(this);
        return binding.useInterface(type);
      }

      /**
       * Returns the data for the closest visible binding associated with the specified driver. If there are no bindings
       * for the specified driver in this context, an error will be thrown. `unbind` should therefore only be called in
       * contexts where it can be safely assumed that a binding of the expected type will exist.
       *
       * Note that this method is generally intended for use only by implementation domains that the driver belongs to.
       * Functionality implemented in those domains may reasonably claim to understand how to interpret and work with
       * the data associated with the driver being passed to this method. Except where that driver's governing
       * implementation domain explicitly allows for mutation of the bound data (and such cases should be rare and
       * unusual), the returned data should be treated as read-only.
       */
      unbind<TDriver extends Driver> (driver: TDriver): InferBindingData<TDriver>;
      unbind<TType extends Type> (type: TType): Type.InferBindingData<TType>;
      unbind (arg: Driver | Type) {
        const driver = Type.unbox(arg);
        return this._binding.view.unbind(driver);
      }
      tryUnbind<TDriver extends Driver> (driver: TDriver): InferBindingData<TDriver> | undefined;
      tryUnbind<TType extends Type> (type: TType): Type.InferBindingData<TType> | undefined;
      tryUnbind (arg: Driver | Type) {
        const driver = Type.unbox(arg);
        return this._binding.view.tryUnbind(driver);
      }

      private [_queryResultCache_]?: WeakMap<Query.Type, Query.Result<any>>;
      query<A extends any[], Q> (type: Query.Type<A, Q>, ...args: A): Q {
        const result = this.tryQuery(type, ...args);
        if (isDefined(result)) {
          if (result.success) return result.value;
          console.error(result.reason);
        }
        throw new Error(`The index in this context does not include a match for queries of type "${type.label}"`);
      }
      tryQuery<A extends any[], Q> (type: Query.Type<A, Q>, ...args: A): Query.Result.Final<Q> | undefined {
        const isCacheable = args.length === 0;
        let result: Query.Result<Q> | undefined;
        if (isCacheable) {
          result = this[_queryResultCache_]?.get(type);
          if (isDefined(result) && result.success) return result;
        }
        if (isUndefined(result)) {
          const mainIndex = this._binding.indexer.get(QueryabilityIndex.IndexerDriver);
          const subindex = mainIndex.lookupQueryType(type);
          result = subindex.tryQuery(...args);
        }
        if (isDefined(result)) {
          if (result.success) {
            if (isCacheable) (this[_queryResultCache_] ??= new WeakMap()).set(type, result);
            return result;
          }
        }
      }

      /**
       * A helper method that reconstructs this context instance to present with a more domain-appropriate API.
       */
      switch<TContext extends ImmediateContext> (contextInterfaceType: Compositional.EntityClass.ToInterfaceType<TContext, Class>): TContext;
      switch<TContext extends ImmediateContext> (contextInterfaceType: Compositional.EntityClass.ToInterfaceType<TContext, Class>, callback: (context: TContext) => ImmediateContext): this;
      switch<TContext extends ImmediateContext> (contextInterfaceType: { InterfaceType: Compositional.EntityClass.ToInterfaceType<TContext, Class> }): TContext;
      switch<TContext extends ImmediateContext> (contextInterfaceType: { InterfaceType: Compositional.EntityClass.ToInterfaceType<TContext, Class> }, callback: (context: TContext) => ImmediateContext): this;
      switch<TContext extends ImmediateContext> (contextInterfaceType: InterfaceType.OrNS<TContext>): TContext;
      switch<TContext extends ImmediateContext> (contextInterfaceType: InterfaceType.OrNS<TContext>, callback: (context: TContext) => ImmediateContext): this;
      switch<TContext extends ImmediateContext> (
        contextInterfaceType: Compositional.EntityClass.ToInterfaceType<TContext, Class> | { InterfaceType: Compositional.EntityClass.ToInterfaceType<TContext, Class> },
        callback?: (context: TContext) => ImmediateContext
      ) {
        if ('InterfaceType' in contextInterfaceType) contextInterfaceType = contextInterfaceType.InterfaceType;
        const context = Class.cast(this, contextInterfaceType);
        if (isUndefined(callback)) return context;
        const subcontext = callback(context);
        return Class.cast(subcontext, getInterfaceType(this));
      }

      switchSecondary<TInterfaceToRemove extends Immediate, TInterfaceToAdd extends Immediate, TFinalInterface extends Immediate & TInterfaceToAdd> (
        typeToSwitchOut: Compositional.InterfaceType<TInterfaceToRemove, Class.Env, Class.CtorArgs>,
        typeToSwitchTo: Compositional.InterfaceType<TInterfaceToAdd, Class.Env, Class.CtorArgs>
      ): Immediate & TInterfaceToAdd;
      switchSecondary<TFinalInterface extends Immediate> (typeToSwitchOut: Compositional.InterfaceType<any>, typeToSwitchTo: Compositional.InterfaceType<any>): TFinalInterface;
      switchSecondary (typeToSwitchOut: Compositional.InterfaceType, typeToSwitchTo: Compositional.InterfaceType) {
        return Compositional.switchIncludedInterface(typeToSwitchOut, typeToSwitchTo, this as any) as any;
      }

      switchToSameAs<TContext extends ImmediateContext> (contextOfDesiredType: TContext): TContext {
        const type = getInterfaceType(contextOfDesiredType);
        return Class.cast(this, type);
      }

      extendInterface<TContext extends ImmediateContext, TOtherContext extends ImmediateContext> (this: TContext, other: InterfaceType.OrNS<TOtherContext>): TOtherContext extends TContext ? TOtherContext : TContext & TOtherContext;
      extendInterface<TContext extends ImmediateContext, TOtherContext extends ImmediateContext> (this: TContext, other: InterfaceType.OrNS<TOtherContext>) {
        if ('InterfaceType' in other) other = other.InterfaceType;
        const type = getInterfaceType(this).composeWith(other);
        return this.switch(type);
      }
    });
    export namespace InterfaceType {
      export type Of<TContext extends ImmediateContext> = Compositional.EntityClass.ToInterfaceType<TContext, Class>;
      export interface NS<TContext extends ImmediateContext = ImmediateContext> {
        readonly InterfaceType: Of<TContext>;
      }
      export type OrNS<TContext extends ImmediateContext = ImmediateContext> = Of<TContext> | NS<TContext>;
    }

    export type Composite<TContext extends ImmediateContext, TOtherContext extends ImmediateContext> = TOtherContext extends TContext ? TOtherContext : TContext & TOtherContext;
  }

  export namespace BindUsing {
    export type Bind<TContext extends ImmediateContext = ImmediateContext, A extends any[] = any[], RContext extends ImmediateContext = ImmediateContext> = (context: TContext, ...args: A) => RContext;
    export namespace Bind {
      export interface NS<TContext extends ImmediateContext = ImmediateContext, A extends any[] = any[], RContext extends ImmediateContext = ImmediateContext> { bindContext: Bind<TContext, A, RContext> }
      export type OrNS<TContext extends ImmediateContext = ImmediateContext, A extends any[] = any[], RContext extends ImmediateContext = ImmediateContext> = Bind<TContext, A, RContext> | NS<TContext, A, RContext>;

      export type InferTContext<TBind extends Bind.OrNS> = TBind extends Bind.OrNS<infer C extends ImmediateContext> ? C : never;
      export type InferArgs<TBind extends Bind.OrNS> = TBind extends Bind.OrNS<any, infer A> ? A : never;
      export type InferRContext<TBind extends Bind.OrNS> = TBind extends Bind.OrNS<any, any, infer R extends ImmediateContext> ? R : never;
    }
  }

  export namespace Annotation {
    export const ContextDriver: Driver<any> = {
      label: 'Context.Annotation',
    };
  }

  export import Immediate = ImmediateContext;

  /**
   * `Indexer` is a super-index facility that provides extensible access to indexes representing various aspects of
   * data, resources and graph structures within the larger graph that the context graph is designed to facilitate
   * access to. By default a single standard index is provided that allows for quick access to all bindings of a given
   * driver type relative to the contextual point of view that the indexer is associated with. See `BindingsIndex` for
   * further information.
   */
  export class Indexer implements Iterable<[Indexer.Driver, unknown]> {
    constructor (binding: ContextBinding) { this.#binding = binding; }
    readonly #binding: ContextBinding;
    #indexes: Map<Indexer.Driver, unknown>;

    get<TIndex> (driver: Indexer.Driver<TIndex>): TIndex {
      let index: TIndex | undefined;
      if (isUndefined(this.#indexes)) this.#indexes = new Map();
      else {
        index = this.#indexes.get(driver) as TIndex | undefined;
        if (isDefined(index)) return index;
      }
      if (isNull(this.#binding.basis)) {
        index = driver.createRootIndex(this.#binding);
      }
      else {
        const baseIndex = this.#binding.basis.indexer.get(driver);
        index = driver.extendIndex(this.#binding, baseIndex);
      }
      this.#indexes.set(driver, index);
      return index;
    }

    *[Symbol.iterator] () {
      yield* this.#indexes;
    }
  }
  export namespace Indexer {
    export interface Driver<TIndex = unknown> {
      readonly label: string; // Would be better as `name`, but needs to avoid being treated as type-compatible with function references.
      /**
       * Returns a new index structure to serve as the rootmost index of this type in the context graph.
       */
      createRootIndex (binding: ContextBinding): TIndex;
      /**
       * @param binding The binding for the context instance whose details the index is to be amended to include.
       * @param index The index structure that represents the context graph at the point of the binding's basis context.
       * @returns An updated copy of `index` amended to include details extracted from `binding`. If `binding` does not
       *   have anything of relevance to contribute to the index at this point in the context graph, an unmodified
       *   reference to `index` is returned as is.
       */
      extendIndex (binding: ContextBinding, index: TIndex): TIndex;
    }
  }

  /**
   * `BindingsIndex` is the only standard index that is provided by default. It is designed to facilitate quick access
   * to all bindings of a given driver type relative to the contextual point of view that the corresponding indexer is
   * associated with. A view of all bindings of a given driver type is referred to as a "facet" (implemented via the
   * `Facet` class). Each binding in the stack of bindings held by a facet represent different respective assertions of
   * about the same subject, with each being valid only in contiguous subsets of context layers up to the next point
   * where a new binding using the same driver is encountered. In the new context, the new binding then becomes a
   * representation of that which holds in true in that context, as opposed to that which it supersedes. Ergo, it can be
   * seen that the topmost binding in a facet is the only binding that should be treated as correlating with that which
   * is considered to be true in the context with which the facet is associated. Other bindings in the stack should be
   * interpreted only with respect to the layers of context visible up to, but not including, the first successive layer
   * where a new binding of the same driver type is encountered.
   */
  export namespace BindingsIndex {
    export function resolve<TDriver extends Context.Driver> (binding: ContextBinding, driver: TDriver): Facet<InferBindingData<TDriver>> {
      const index = binding.indexer.get<Immutable.Map<Driver, Facet>>(Driver);
      return (index.get(driver) ?? new Facet(driver, Immutable.Stack())) as Facet<InferBindingData<TDriver>>;
    }

    export const Driver: Indexer.Driver<Immutable.Map<Driver, Facet>> = {
      label: 'Context.BindingsIndex',
      createRootIndex: (binding) => Immutable.Map([[binding.driver, new Facet(binding.driver, Immutable.Stack([binding]))]]),
      extendIndex: (binding, facets) => facets.update(binding.driver, (facet) => {
        return isDefined(facet) ? facet.push(binding) : new Facet(binding.driver, Immutable.Stack([binding]));
      }),
    };

    /**
     * A `Facet` is a stack containing all of the bindings associated with a specific driver at a given point in a
     * context graph. The closest (topmost) binding in the stack is the authoritative binding for whatever the
     * associated driver instance represents through its implementation.
     */
    export class Facet<TBindingData = unknown> implements Iterable<ContextBinding<TBindingData>> {
      constructor (driver: Context.Driver<TBindingData>, stack: Immutable.Stack<ContextBinding<TBindingData>>) {
        if (isUndefined(driver)) {
          throw new Error(`A driver must be provided to create a Facet`);
        }
        this.#driver = driver;
        this.#stack = stack;
      }
      readonly #driver: Context.Driver<TBindingData>;
      readonly #stack: Immutable.Stack<ContextBinding<TBindingData>>;

      get isEmpty () { return this.#stack.isEmpty(); }
      get current () {
        return this.#stack.peek() ?? throwError(`There are no directly accessible bindings for driver "${this.#driver.label}" in this context`);
      }

      push (binding: ContextBinding<TBindingData>): Facet<TBindingData> {
        return new Facet(this.#driver, this.#stack.push(binding));
      }

      // Order of iteration should be from the top of the stack to the bottom:
      *[Symbol.iterator] () {
        if (this.#stack.size === 0) return;
        yield* this.#stack.valueSeq().reverse();
      }
    }
  }

  export namespace Query {
    export type Result<Q> = Result.Success<Q> | Result.Failure;
    export namespace Result {
      export type Final<Q> = Success<Q> | Failure;

      interface Base<TStatus extends 'success' | 'failure'> {
        readonly status: TStatus;
        readonly success: TStatus extends 'success' ? true : false;
      }
      export interface Success<Q> extends Base<'success'> {
        readonly value: Q;
      }
      export interface Failure extends Base<'failure'> {
        readonly queryType: Query.Type;
        readonly contextType: Context.Driver;
        readonly reason: string;
      }
    }

    /**
     * Represents a specific type of query that can be performed against a context.
     * @remarks
     * The query system supports two modes of query resolution: one where the context driver itself provides the
     * resolution logic, and another where the query type implements resolution logic. Both can be true at the same
     * time. When the context driver provides explicit support for queries of this type, it always takes precedence over
     * any built-in query resolution logic that the query type may implement. If the context driver returns a result
     * with status "declined" for a given query, the query type's built-in query resolver, if it exists, will be called
     * as a fallback.
     *
     * The point of having two modes of query resolution is to make it possible (a) for a query type to support multiple
     * context types without affecting the implementations of those context types, (b) for a context driver to support
     * multiple query types, and (c) to allow for flexibility regarding where query resolution logic belongs with
     * respect context types and query types.
     */
    export interface Type<A extends any[] = any[], Q = unknown> {
      readonly label: string;
      /**
       * Note that this field exists purely for purposes of indexing contexts according to the types of queries they
       * support. There is no automatic inheritance of functionality of a query type by a query type that extends it. If
       * any reuse of the functionality of a base query type is desired in a query type that extends from it, the
       * responsibility for doing so is left up to the extending type's implementation.
       */
      readonly extends?: Type | Iterable<Type>;
      /**
       * `pretest` provides a way of indicating whether or not the query type will ever have a chance of returning a
       * successful query result for this contexts of this type. If not defined, then default behaviour is:
       * - `pretest` is primarily intended for use when `query` is defined as a function on the query type.
       * - `pretest` is not used if the context driver explicitly expresses support for queries of this type.
       * - In most cases `pretest` is unnecessary if `query` is defined as an instance of `Type.EntryMap`. When this is
       *   the case and `pretest` is not defined, default behaviour is to test whether the context type exists in the
       *   entry map.
       * -  equivalent to a pretest function that always returns `true`.
       */
      pretest?: (driver: Context.Driver) => boolean;
      /**
       * Called for queries of this type when the queried context's bound driver either does not implement its own
       * support for queries, or has indicated that it does not support this specific query type. Note that this means
       * that a query type's own `query` implementation always has lower precedence than its counterpart on the context
       * driver (assuming it is defined there also). If the context driver indicates that it supports queries of this
       * type, that implementation will always supersede this one.
       */
      query?: ((subindex: Context.QueryabilityIndex.IndexOfQueryableContextsForASpecificQueryType<A, Q>, ...args: A) => Query.Result<Q>) | Type.EntryMap<A, Q>;
    }
    export function Type<A extends any[], Q> (
      /** Provides a function (`match`) for defining a list of context types that queries of this type can match, and a
       * function to use to create each entry in the list (`when`). */
      callback: (
        /** Each entry is a tuple of: [<context type (typically a driver reference)>, <query resolver function>] */
        match: (entries: Type.Entry<A, Q>[]) => Type.EntryMap<A, Q>,
        /** Creates a `Type.Entry` tuple. */
        when: <C extends Context.Type>(
          contextType: C,
          resolveQuery: Type.ResolveQuery<A, Q, Context.Type.InferBindingData<C>>
        ) => Type.Entry<A, Q>
      ) => Type<A, Q>
    ): Type<A, Q> {
      return new Proxy({ actual: undefined } as any, {
        get (t, p, r) {
          if (isUndefined(t.actual)) t.actual = callback((entries) => new Type.EntryMap(new Map(entries)), (contextType, resolveQuery) => [Context.Type.unbox(contextType), resolveQuery]);
          return Reflect.get(t.actual, p, r);
        },
      });
    }
    export namespace Type {
      export type ResolveQuery<A extends any[], Q, C = unknown> = (subindex: QueryabilityIndex.IndexOfQueryableContextsForASpecificQueryType<A, Q, C>, ...args: A) => Query.Result<Q>;
      export type Entry<A extends any[], Q> = [contextType: Context.Driver, resolveQuery: ResolveQuery<A, Q>];
      export class EntryMap<A extends any[], Q> {
        constructor (map: Map<Context.Driver, ResolveQuery<A, Q>>) { this._map = map; }
        private readonly _map: Map<Context.Driver, ResolveQuery<A, Q>>;
        canMatchContextType (contextDriver: Context.Driver): boolean { return this._map.has(contextDriver); }
        getResolverForContextType<C> (contextDriver: Context.Driver<C>): undefined | ResolveQuery<A, Q> { return this._map.get(contextDriver) as undefined | ResolveQuery<A, Q>; }
      }
    }
  }
  /**
   * This is an index that links contexts to the types of queries that can be resolved for those contexts.
   *
   * @todo Query resolvers may attach and maintain child indexes of their own on the entries in this index.
   */
  export class QueryabilityIndex<C = unknown> {
    constructor (basis: QueryabilityIndex, binding: ContextBinding, state: QueryabilityIndex.Data);
    constructor (basis: QueryabilityIndex | null, binding: ContextBinding, state: QueryabilityIndex.Data) {
      this.#basis = basis;
      this.#binding = binding;
      this.#state = state;
    }
    readonly #basis: QueryabilityIndex | null;
    readonly #binding: ContextBinding;
    readonly #state: QueryabilityIndex.Data;

    /**
     * Returns the subindex specific to the specified query type. The subindex could be thought of as a subset of the
     * overall queryability index filtered to only include visible contexts whose types (i.e. where context "type" is
     * really just a reference to a context driver) that are known to be valid targets for queries of `queryType`.
     */
    lookupQueryType<A extends any[], Q> (queryType: Query.Type<A, Q>): QueryabilityIndex.IndexOfQueryableContextsForASpecificQueryType<A, Q> {
      const data = this.#state;
      // Get the subindex for the specified query type in the context that this specific queryability index is
      // associated with.
      let index = data.indexesByQueryType.get(queryType) as QueryabilityIndex.IndexOfQueryableContextsForASpecificQueryType<A, Q> | undefined;
      // If `queryType` isn't in the main index, we'll need to perform the same lookup on the main queryability index of
      // our basis context, then extend that index so that it also represents the context we're in now, storing it in
      // our own main queryability index so that it's available for future lookups performed on this index.
      if (isUndefined(index)) {
        const pretestPassed =
          isDefined(this.#binding.driver.queries) && this.#binding.driver.queries.supportedTypes.has(queryType)
            ? true
            : isDefined(queryType.pretest)
              ? queryType.pretest(this.#binding.driver)
              : isDefined(queryType.query) && !isFunction(queryType.query)
                ? queryType.query.canMatchContextType(this.#binding.driver)
                : true;
        // A subindex for the specified query type is not in the main index at this point, so we'll now need to prepare
        // a subindex that extends from a subindex of the same query type in the basis index. Our internal map will then
        // need to be updated to include the new subindex.
        if (isNull(this.#basis)) {
          index = new QueryabilityIndex.IndexOfQueryableContextsForASpecificQueryType(queryType, this.#binding, null);
        }
        else {
          // The basis index is the index as it looks at that point in the context chain.
          const basisIndex = this.#basis.lookupQueryType(queryType);
          // No need to waste resources extending the basis index if it will never return a successful result for this
          // specific context binding. If that is the case, we'll just reference the basis index as is.

          index = pretestPassed ? basisIndex.extendTail(queryType, this.#binding) : basisIndex;
        }

        data.indexesByQueryType.set(queryType, index);
      }
      return index;
    }
  }
  export namespace QueryabilityIndex {
    export interface Data {
      indexesByQueryType: Map<Query.Type, QueryabilityIndex.IndexOfQueryableContextsForASpecificQueryType<any[], any>>;
    }

    export const IndexerDriver: Indexer.Driver<QueryabilityIndex> = {
      label: 'Context.QueryabilityIndex',
      createRootIndex: (binding) => new QueryabilityIndex(null!, binding, { indexesByQueryType: new Map() }),
      extendIndex: (binding, index) => new QueryabilityIndex(index, binding, { indexesByQueryType: new Map() }),
    };

    export class IndexOfQueryableContextsForASpecificQueryType<A extends any[], Q, TBindingData = unknown> {
      constructor (
        queryType: Query.Type<A, Q>,
        binding: ContextBinding<TBindingData>,
        basis: IndexOfQueryableContextsForASpecificQueryType<A, Q> | null,
      ) {
        this.#queryType = queryType;
        this.#binding = binding;
        this.#basis = basis;
      }
      readonly #queryType: Query.Type<A, Q>;
      readonly #binding: ContextBinding<TBindingData>;
      readonly #basis: IndexOfQueryableContextsForASpecificQueryType<A, Q> | null;
      #basisIndexWithSupportByContextDriver?: IndexOfQueryableContextsForASpecificQueryType<A, Q> | null;
      #contextDriverSupportsQueriesOfThisType?: boolean;
      #queryTypeCanMatchContextsOfThisType?: boolean;

      /**
       * This `IndexOfQueryableContextsForASpecificQueryType` index instance represents the tail of the larger index
       * spanning the chain of contexts starting at the root and ending at `tailContext`. The `tailContext` property
       * returns the context with which this index instance is associated. The index may extend deeper into the context
       * graph, but in this context we consider this index instance the tail of the overall index.
       */
      get tailContext (): ContextBinding<TBindingData> { return this.#binding; }
      /**
       * The index of the same query type associated with the basis of `tailContext`.
       */
      get basisIndex (): IndexOfQueryableContextsForASpecificQueryType<A, Q> | null { return this.#basis; }
      /**
       * Provides direct access to the closest supercontextual index where the context driver for that context
       * implements explicit support for queries of this type. The context driver's `queries` property will need to be
       * defined with a `supportedTypes` property that `has` an entry for `this.#queryType`.
       */
      get basisIndexWithSupportByContextDriver (): IndexOfQueryableContextsForASpecificQueryType<A, Q> | null {
        if (isDefined(this.#basisIndexWithSupportByContextDriver)) return this.#basisIndexWithSupportByContextDriver;
        return this.#basisIndexWithSupportByContextDriver = isNull(this.#basis)
          ? null
          : this.#basis.doesContextDriverSupportQueriesOfThisType
            ? this.#basis
            : this.#basis.basisIndexWithSupportByContextDriver;
      }

      private get doesContextDriverSupportQueriesOfThisType (): boolean {
        return this.#contextDriverSupportsQueriesOfThisType ??= this.#binding.driver.queries?.supportedTypes.has(this.#queryType) ?? false;
      }
      private get canQueryTypeMatchContextsOfThisType (): boolean {
        if (isDefined(this.#queryTypeCanMatchContextsOfThisType)) return this.#queryTypeCanMatchContextsOfThisType;
        const type = this.#queryType;
        return this.#queryTypeCanMatchContextsOfThisType = isDefined(type.query) && (isFunction(type.query) || type.query.canMatchContextType(this.#binding.driver));
      }

      query (...args: A): Query.Result.Final<Q> {
        const result = this.tryQuery(...args);
        if (isDefined(result)) return result;

        // No query result means that nobody has any idea how to resolve the query in this overall context.
        return this.createFailureResponse(inls`
          The query could not be resolved in this context. Either (a) no support for the query type was offered by any
          of the context drivers in the context chain, (b) the query type itself does not provide any query resolution
          logic, or (c) arguments to the query were outside any range supported by participating context drivers or by
          the query type's own implementation.
        `);
      }
      tryQuery (...args: A): Query.Result.Final<Q> | undefined {
        // First we give precedence to the context driver to resolve the query, if it offers support for it:
        if (this.doesContextDriverSupportQueriesOfThisType) {
          const result = this.#binding.driver.queries!.resolve<A, Q>(this.#binding, this.#queryType, ...args);
          if (isNotNull(result)) return result;
        }

        // If the query type itself provides query resolution logic, we'll try that next:
        if (this.canQueryTypeMatchContextsOfThisType) {
          const type = this.#queryType;
          const query = isFunction(type.query) ? type.query : type.query!.getResolverForContextType(this.#binding.driver)!;
          const result = query(this, ...args);
          if (isNotNull(result)) return result;
        }

        // If there is no query result for this specific context, we'll widen our search to the basis context:
        if (isNotNull(this.#basis)) {
          return this.#basis.tryQuery(...args);
        }
      }

      createSuccessfulResponse (value: Q): Query.Result.Success<Q> {
        return { status: 'success', success: true, value };
      }
      createFailureResponse (reason: string): Query.Result.Failure {
        return {
          status: 'failure',
          success: false,
          queryType: this.#queryType,
          contextType: this.#binding.driver,
          reason,
        };
      }

      /**
       * @internal
       * Just as the context chain is immutable and append-only, so too is the queryability index chain. The
       * `extendTail` method is called when the basis index for a particular query type is to have a new entry added to
       * it. The returned index is a clone of the basis index with the specified query type added as a new entry.
      */
      extendTail (queryType: Query.Type<A, Q>, binding: ContextBinding): IndexOfQueryableContextsForASpecificQueryType<A, Q> {
        return new IndexOfQueryableContextsForASpecificQueryType<A, Q>(queryType, binding, this);
      }
    }
  }

  export class Abort {
    constructor (private readonly abort: AbortController) {}
    #disposables?: DisposableGroup;
    #attachedControllers?: Set<AbortController>;

    get signal (): AbortSignal { return this.abort.signal; }
    /**
     * A `DisposableGroup` instance that will be disposed when the abort signal is triggered.
     */
    get disposables (): DisposableGroup {
      if (isUndefined(this.#disposables)) {
        const disposables = this.#disposables = new DisposableGroup();
        this.addListener(() => dispose(disposables));
      }
      return this.#disposables;
    }

    fork (controller: AbortController): Abort {
      this.signal.addEventListener('abort', () => controller.abort(), { signal: controller.signal });
      return new Abort(controller);
    }

    forkToContext<TContext extends ImmediateContext> (context: TContext, controller: AbortController): TContext {
      const abort = this.fork(controller);
      return context.bind(Abort.ContextDriver, abort);
    }

    bindToContext<TContext extends ImmediateContext> (context: TContext): TContext {
      return context.bind(Abort.ContextDriver, this);
    }

    addListener (listener: () => void): void {
      this.signal.addEventListener('abort', listener);
    }

    /**
     * Intended primarily for use in client-service context scenarios whereby an agent method is called passing in the
     * client's context governing the request that the method represents. The agent will be doing the work, not the
     * client, but the agent will need to know when the client request has been terminated. The agent can call
     * `clientContext.abort.spawnAbortController()` to get a controller that will auto-abort when the client terminates
     * their request. The abort controller can then be bound to the agent's own internal subcontext that it creates to
     * represent the work it is initiating on the client's behalf.
     */
    spawnAbortController (): AbortController {
      const controller = new AbortController();
      const attachedControllers = this.#attachedControllers ??= new Set();
      attachedControllers.add(controller);
      this.addListener(() => controller.abort());
      controller.signal.addEventListener('abort', () => attachedControllers.delete(controller));
      return controller;
    }
  }
  export namespace Abort {
    export const ContextDriver: Driver<Abort> = {
      label: 'Context.Abort',
      queries: Driver.Queries((match, when, ok) => match([
        when(QueryType, (binding) => ({ status: 'success', success: true, value: binding.data })),
      ])),
    };
    export const QueryType = Context.Query.Type<[], Abort>((match, when) => ({
      label: 'Context.Abort',
      query: match([
        when(Sentinel, (index) => index.createSuccessfulResponse(index.tailContext.data.abort)),
      ]),
    }));
  }

  export function adapt<TContext extends ImmediateContext, A extends any[], R> (interfaceType: ImmediateContext.InterfaceType.OrNS<TContext>): Adapter<TContext>;
  export function adapt<TContext extends ImmediateContext, A extends any[], R> (interfaceType: ImmediateContext.InterfaceType.OrNS<TContext>, execute: ImmediateContext.Callback<TContext, A, R>, thisArg?: any): ImmediateContext.Callback<ImmediateContext, A, R>;
  export function adapt<TContext extends ImmediateContext, A extends any[], R> (interfaceType: ImmediateContext.InterfaceType.OrNS<TContext>, execute?: ImmediateContext.Callback<TContext, A, R>, thisArg?: any): Adapter<TContext> | ImmediateContext.Callback<ImmediateContext, A, R> {
    return execute
      ? thisArg
        ? (context, ...args) => execute.call(thisArg, context.switch(interfaceType), ...args)
        : (context, ...args) => execute(context.switch(interfaceType), ...args)
      : new Adapter(unboxInterfaceType(interfaceType));
  }
  export class Adapter<TContext extends ImmediateContext = ImmediateContext> {
    constructor (interfaceType: ImmediateContext.InterfaceType.Of<TContext>) {
      this.#contextType = interfaceType;
    }
    readonly #contextType: ImmediateContext.InterfaceType.Of<TContext>;

    bind<A extends any[], R> (execute: ImmediateContext.Callback<TContext, A, R>, thisArg?: any): ImmediateContext.Callback<ImmediateContext, A, R> {
      return thisArg
        ? (context, ...args) => execute.call(thisArg, context.switch(this.#contextType), ...args)
        : (context, ...args) => execute(context.switch(this.#contextType), ...args);
    }
    call<A extends any[], R> (execute: ImmediateContext.Callback<TContext, A, R>, context: ImmediateContext, ...args: A): R {
      const switchedContext = context.switch(this.#contextType);
      return execute(switchedContext, ...args);
    }
    invoke<A extends any[], R> (thisArg: object, method: ImmediateContext.Callback<TContext, A, R>, context: ImmediateContext, ...args: A): R {
      const switchedContext = context.switch(this.#contextType);
      return method.call(thisArg, switchedContext, ...args);
    }
  }
}

export import ImmediateContext = Context.Immediate;
export import ContextDriver = Context.Driver;
export import ContextQuery = Context.Query;

/**
 * Just for reference in case I want to do something similar in the future. All that `cmsg` formatting is time
 * consuming. I'd rather avoid wasting that time in the future. In any case, a VERY hand-wavy performance estimate that
 * I got from these tests is that context switching is cheap enough that I shouldn't need to think about it. Even a
 * first switch to a given interface type, which will tend to involve `Compositional` having to do some reflection and
 * initial caching, is still something that can be done at least several times in under a millisecond. After that, I'm
 * estimating that anywhere from 10-100 switches per millisecond - AT WORST - should be treated as the norm in typical
 * use cases. As long as context switching is not being done in tight loops, most execution paths would only warrant a
 * handful of switches at most, and the kinds of paths where switching is done are generally only going to be first-run
 * scenarios or responses to inbound events. Nevertheless, even if I found myself in a situation where I was doing more
 * context switching than anticipated in areas of the code that are running extremely frequently to the extent that a
 * minor performance hit could be noticeable (something I very much doubt will happen), I suspect there are numerous
 * optimisation possibilities I haven't explored that could be used to mitigate any such issues, so again - context
 * switching performance should largely be treated as cheap enough to be a non-issue in normal use cases.
 */
async function AdHocPerformanceGauging (cmsg: cmsg, DOMContext: any, ClientContext: any, rootContext: any, delay: any) {
  performance.mark('1.switch(DOMContext):start');
  let testContext = rootContext.switch(DOMContext).switch(ClientContext).switch(DOMContext);
  performance.mark('1.switch(DOMContext):end');

  await delay(200);

  performance.mark('2.switch(DOMContext):start');
  testContext = rootContext.switch(DOMContext).switch(ClientContext).switch(DOMContext);
  performance.mark('2.switch(DOMContext):end');

  await delay(200);

  performance.mark('3.switch(DOMContext):start');
  testContext = rootContext.switch(DOMContext).switch(ClientContext).switch(DOMContext);
  performance.mark('3.switch(DOMContext):end');

  await delay(200);

  performance.mark('4.switch(DOMContext):start');
  testContext = rootContext.switch(DOMContext).switch(ClientContext).switch(DOMContext);
  performance.mark('4.switch(DOMContext):end');

  const measure = performance.measure('1.switch(DOMContext)', '1.switch(DOMContext):start', '1.switch(DOMContext):end');
  cmsg.print(cmsg.std.labelled.bg('amber').black(`PERF TEST`, [cmsg.std.numeric.index.asPrefix(1), cmsg.std.punctuated([cmsg.std.functionName('switch'), '(', cmsg.std.typeName('DOMContext'), ')'])]).args(measure.duration));
  const measure_2_switch = performance.measure('2.switch(DOMContext)', '2.switch(DOMContext):start', '2.switch(DOMContext):end');
  cmsg.print(cmsg.std.labelled.bg('amber').black(`PERF TEST`, [cmsg.std.numeric.index.asPrefix(2), cmsg.std.punctuated([cmsg.std.functionName('switch'), '(', cmsg.std.typeName('DOMContext'), ')'])]).args(measure_2_switch.duration));
  const measure_3_switch = performance.measure('3.switch(DOMContext)', '3.switch(DOMContext):start', '3.switch(DOMContext):end');
  cmsg.print(cmsg.std.labelled.bg('amber').black(`PERF TEST`, [cmsg.std.numeric.index.asPrefix(3), cmsg.std.punctuated([cmsg.std.functionName('switch'), '(', cmsg.std.typeName('DOMContext'), ')'])]).args(measure_3_switch.duration));
  const measure_4_switch = performance.measure('4.switch(DOMContext)', '4.switch(DOMContext):start', '4.switch(DOMContext):end');
  cmsg.print(cmsg.std.labelled.bg('amber').black(`PERF TEST`, [cmsg.std.numeric.index.asPrefix(4), cmsg.std.punctuated([cmsg.std.functionName('switch'), '(', cmsg.std.typeName('DOMContext'), ')'])]).args(measure_4_switch.duration));
}
