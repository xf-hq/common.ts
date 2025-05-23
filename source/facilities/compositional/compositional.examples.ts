import { Compositional } from './compositional';

/**
 * In this example we'll demonstrate:
 * - Defining the concept of a "worker" as a general class of entities.
 * - Defining different possible public interfaces for workers, depending on what role(s) they occupy.
 * - Temporary transfer of a worker from one role to another, then back again.
 * - Expanding a worker's role to include additional responsibilities and/or capabilities.
 */
function OfficeSpace () {
  /**
   * An example of a facility that every employees will always have a dependency on, regardless of the role they
   * happen to occupy in a given context.
   */
  interface WorkLogger {
    log (worker: Worker, details: string): void;
  }

  /**
   * First we define the "class" of entities that all of.
   * - This is where we define the state that is common to all entities of a given class. We should define visibility
   *   modifiers for class members in the same way that we would for any base class.
   * - Only the fields defined using `EntityClass.new` will persist when "casting" an entity (i.e. creating a new
   *   reference to the same entity, but with a different interface).
   */
  type Worker = Compositional.ExtractInterface.FromClass<typeof WorkerClass>;
  const WorkerClass = Compositional.EntityClass.new(class Worker {
    constructor (
      /** Every worker should have a meaningful name, regardless of the role that the  */
      public readonly name: string,
      protected readonly logger: WorkLogger,
    ) {}
  });

  // Our example is based on the movie "Office Space".

  interface Conversation {
    say (message: string, responseCallback?: (conversation: Conversation) => void): void;
    sayNothing (followUpCallback: (conversation: Conversation) => void): void;
  }

  type Programmer = Compositional.ExtractInterface<typeof Programmer>;
  const Programmer = WorkerClass.define(($Programmer) => class Programmer extends $Programmer.EntityInstance {
    get didRememberToFileTPSReport (): boolean { return false; /* placeholder */ }
    get isBusyWorking (): boolean { return false; /* placeholder */ }

    greetCoworker (coworker: Worker, greeting: string) {
      this.logger.log(this, `Greeted ${coworker.name} with: "${greeting}"`);
    }

    beginWritingCode (taskDescription: string) {
      this.logger.log(this, `Beginning writing code for task: ${taskDescription}`);
    }

    endWritingCode (reason: string) {
      this.logger.log(this, `Stopped writing code because: ${reason}`);
    }

    onSupervisorApproaching (distanceMetres: number) {
      this.logger.log(this, `Observed that the supervisor is approaching (distance: ${distanceMetres}m)`);
    }

    beginInterruption (interruptor: Worker, message: string) {
      this.logger.log(this, `Interrupted by "${interruptor.name}", who said "${message}"`);
    }

    endInterruption () {
      this.logger.log(this, `Resuming work...`);
    }
  });

  type Supervisor = Compositional.ExtractInterface<typeof Supervisor>;
  const Supervisor = WorkerClass.define(($Supervisor) => class Supervisor extends $Supervisor.EntityInstance {
    approachProgrammer (programmer: Programmer, distanceMetres: number) {
      this.logger.log(this, `Approaching ${programmer.name} (distance: ${distanceMetres}m)`);
      programmer.onSupervisorApproaching(distanceMetres);
    }
    interruptProgrammer (programmer: Programmer, message: string, callback: (interruptedParty: Conversation) => void) {
      this.logger.log(this, `Interrupting ${programmer.name} with: "${message}"`);
      programmer.beginInterruption(this, message);
      let conversation!: Conversation; // We'll just assume this exists.
      callback(conversation);
      programmer.endInterruption();
    }
  });

  let logger!: WorkLogger; // We'll just assume this exists.

  function runScenario () {
    const peterGibbons = WorkerClass.construct(Programmer, ['Peter Gibbons', logger]);
    const billLumbergh = WorkerClass.construct(Supervisor, ['Bill Lumbergh', logger]);

    peterGibbons.beginWritingCode('Find Y2K bug in payroll system');

    billLumbergh.approachProgrammer(peterGibbons, 5);
    billLumbergh.approachProgrammer(peterGibbons, 2);
    billLumbergh.interruptProgrammer(peterGibbons, `Hey Peter.`, (peter) => {
      peter.say(`Oh, hey Bill.`, (bill) => {
        bill.say(`What's happening?`, (peter) => {
          peter.sayNothing((bill) => {
            bill.say(`I'm going to need you to go ahead and come in on Saturday.`, (peter) => {
              // ...
            });
          });
        });
      });
    });

    // Let's get some justice and promote Peter to supervisor and demote Bill to programmer.
    const peterSupervisor = WorkerClass.cast(peterGibbons, Supervisor);
    const billProgrammer = WorkerClass.cast(billLumbergh, Programmer);
    peterSupervisor.interruptProgrammer(billProgrammer, `Hey Bill, so about those TPS reports...`, (bill) => {
      // ...
    });

    // Peter and Bill both retain their original underlying shared state, and separate instances of them will operate
    // on that same state as though they are the same entity. That is, changes from one entity will affect the state
    // of the other entity.
    //
    // This is all a contrived example of course. The main purpose of this facility is to allow for flexibility
    // regarding the interface that an entity should expose publicly in different contexts. It's the same entity
    // regardless of how many different interface forms we cast it to, and we can mix and match different interfaces
    // as needed. For example, if we want peter to be both a programmer and a supervisor from the start:

    const ProgrammerSupervisor = WorkerClass.compose('ProgrammerSupervisor', [Programmer, Supervisor]);
    const peterGibbonsAlt = ProgrammerSupervisor.construct('Peter Gibbons', logger);
    peterGibbonsAlt.beginWritingCode('Find Y2K bug in payroll system');
    peterGibbonsAlt.interruptProgrammer(billProgrammer, `Hey Bill, I don't wanna write this code. You do it.`, (bill) => {
      bill.say(`Yeah, I guess I'm going to need to go ahead and come in on Saturday.`);
    });

    // The above approach works well when we have a number of independent interfaces we want to merge into a single
    // interface, but sometimes we want to define an interface as an extension of another interface, which means the
    // interface members we're defining will have awareness of the interface being extended.
    const ObstinateProgrammer = Programmer.extend(($ObstinateProgrammer) => class ObstinateProgrammer extends $ObstinateProgrammer.EntityInstance {
      refuseToWriteCode (reason: string) {
        if (this.isBusyWorking) {
          this.endWritingCode(`I refuse to write code because ${reason}`);
        }
      }
    });
    const obstinatePeter = WorkerClass.cast(peterGibbons, ObstinateProgrammer);
    obstinatePeter.refuseToWriteCode(`I don't wanna`);
  }
}
