export class StagingOperation<TStagingDomain> {
  static create<TStagingDomain, TOpState, TOpArgs extends any[]> (
    domainProvider: StagingOperation.DomainProvider<TStagingDomain, TOpState, TOpArgs>,
    ...args: TOpArgs
  ): [op: StagingOperation<TStagingDomain>, commit: () => void] {
    const state = domainProvider.createState(...args);
    const opDomainInterface = domainProvider.createDomainInterface(state, ...args);
    const controller = new StagingOperationController(domainProvider, state, opDomainInterface);
    return [controller.facade, () => controller.commit()];
  }
  constructor (controller: StagingOperationController<TStagingDomain, any>) {
    this.#controller = controller;
  }
  readonly #controller: StagingOperationController<TStagingDomain, any>;

  /**
   * Incorporates a means of producing changes into the staging operation. The changeset provider may coordinate changes
   * for a single target or multiple targets. The first time it is passed to this method, operation state is updated to
   * initialized inclusion of the changeset provider. Then, for this and subsequent calls, the changeset provider must
   * return an interface to the caller so that they can indicate what changes they want to make. A changeset is
   * cumulatively built up with each successive call to `join`. When the operation is committed, all changes are then
   * applied to their respective targets, and at that time a record of the changes can be captured for persistence in an
   * event log.
   */
  join<TStagingInterface, TSharedState, TArgs extends any[], TStateArgs extends any[], TChangeArgs extends any[]> (
    changesetProvider: StagingOperation.ChangesetProvider<TStagingDomain, TStagingInterface, TSharedState, TArgs, TStateArgs, TChangeArgs>,
    ...args: TArgs
  ): TStagingInterface {
    return this.#controller.join(changesetProvider, ...args);
  }
}
export namespace StagingOperation {
  /**
   * @template TStagingDomain An interface of this type will be made available to all changeset providers to give them
   * access to domain-specific resources that they require in order to stage and commit their changes. If a domain
   * provider intends to be compatible with changeset providers from different domains, `TStagingDomain` should
   * intersect the respective `TStagingDomain` types of each changeset provider domain that the operation provider
   * intends to support. Note that other `ChangesetProvider` domains can be supported as long as their `TStagingDomain`
   * type is unused; i.e. if it is `any`, `unknown`, etc. then it should be technically compatible with any
   * `TStagingDomain` type.
   */
  export interface DomainProvider<TStagingDomain, TOpState, TOpArgs extends any[]> {
    createState (...args: TOpArgs): TOpState;
    /**
     * Passed to participating changeset providers to give them access to any necessary resources specific to the operation.
     */
    createDomainInterface (state: TOpState, ...args: TOpArgs): TStagingDomain;
    finalizeCommit (state: TOpState): void;
  }

  export interface ChangesetProvider<TStagingDomain, TStagingInterface, TSharedState, TArgs extends any[], TStateArgs extends any[], TChangeArgs extends any[]> {
    getStateArgs (args: TArgs): TStateArgs;
    getChangeArgs (args: TArgs): TChangeArgs;
    createSharedState (op: TStagingDomain, ...args: TStateArgs): TSharedState;
    getOrCreateStagingInterface (state: TSharedState, ...args: TChangeArgs): TStagingInterface;
    commitChanges (state: TSharedState): void;
  }
}

class StagingOperationController<TStagingDomain, TOpState> {
  readonly facade = new StagingOperation(this);

  constructor (
    domainProvider: StagingOperation.DomainProvider<TStagingDomain, TOpState, any>,
    state: TOpState,
    opDomainInterface: TStagingDomain,
  ) {
    this.#domainProvider = domainProvider;
    this.#state = state;
    this.#opDomainInterface = opDomainInterface;
  }
  readonly #domainProvider: StagingOperation.DomainProvider<TStagingDomain, TOpState, any>;
  readonly #state: TOpState;
  readonly #opDomainInterface: TStagingDomain;
  readonly #participants = new Map<StagingOperation.ChangesetProvider<TStagingDomain, any, any, any[], any[], any[]>, Participant<TStagingDomain, any, any, any[], any[], any[]>>();

  join<TStagingInterface, TSharedState, TArgs extends any[], TStateArgs extends any[], TChangeArgs extends any[]> (
    changesetProvider: StagingOperation.ChangesetProvider<TStagingDomain, TStagingInterface, TSharedState, TArgs, TStateArgs, TChangeArgs>,
    ...args: TArgs
  ): TStagingInterface {
    let participant = this.#participants.get(changesetProvider);
    if (!participant) {
      const stateArgs = changesetProvider.getStateArgs(args);
      const state = changesetProvider.createSharedState(this.#opDomainInterface, ...stateArgs);
      participant = { changesetProvider, state };
      this.#participants.set(changesetProvider, participant);
    }
    const changeArgs = changesetProvider.getChangeArgs(args);
    return changesetProvider.getOrCreateStagingInterface(participant.state, ...changeArgs);
  }

  commit (): void {
    for (const participant of this.#participants.values()) {
      participant.changesetProvider.commitChanges(participant.state);
    }
    this.#domainProvider.finalizeCommit(this.#state);
  }
}

interface Participant<TStagingDomain, TStagingInterface, TSharedState, TArgs extends any[], TStateArgs extends any[], TChangeArgs extends any[]> {
  readonly changesetProvider: StagingOperation.ChangesetProvider<TStagingDomain, TStagingInterface, TSharedState, TArgs, TStateArgs, TChangeArgs>;
  readonly state: TSharedState;
}
