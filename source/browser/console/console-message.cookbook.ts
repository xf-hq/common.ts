import { cmsg } from './console-message';

const Examples = {
  'Measuring performance' () {
    function runExamplePerformanceTest () {
      performance.mark('run(Example):start');
      // ... do some work ...
      performance.mark('run(Example):end');
      return performance.measure('run(Example)', 'run(Example):start', 'run(Example):end');
    }

    const measure = runExamplePerformanceTest();
    cmsg.std.labelled.bg('amber').black(`PERF TEST`, [
      cmsg.std.numeric.index.asPrefix(1),
      cmsg.std.punctuated([
        cmsg.std.functionName('run'), '(', cmsg.std.typeName('Example'), ')',
      ]),
    ]).addTailArgs(measure.duration);
  },
};
