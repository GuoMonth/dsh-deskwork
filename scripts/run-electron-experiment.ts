import { parseExperimentIsolation } from '../experiments/electron-session-control/experiment-isolation.ts';
import { runCheck } from './check-process.ts';

const isolation = parseExperimentIsolation(process.argv[2]);
if (process.argv.length > 3) throw new Error('Expected only an experiment isolation mode');
const build = await runCheck({
  name: 'build',
  arguments: ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.experiments.json'],
});
if (!build.passed) {
  console.error(build.output);
  process.exitCode = 1;
} else {
  const experiment = await runCheck({
    name: 'electron-session',
    arguments: ['--test', 'experiments/electron-session-control/session-control.integration.ts'],
    environment: { DESKWORK_EXPERIMENT_ISOLATION: isolation },
  });
  console.log(`Experiment isolation: ${isolation}`);
  console.log(experiment.output);
  if (!experiment.passed) process.exitCode = 1;
}
