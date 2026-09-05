export type ExperimentIsolation = 'host' | 'chromium';

export function parseExperimentIsolation(input: unknown): ExperimentIsolation {
  if (input === undefined) return 'chromium';
  if (input === 'host' || input === 'chromium') return input;
  throw new Error('Experiment isolation must be host or chromium');
}

export function electronIsolationArguments(isolation: ExperimentIsolation): readonly string[] {
  return isolation === 'host' ? ['--no-sandbox'] : [];
}
