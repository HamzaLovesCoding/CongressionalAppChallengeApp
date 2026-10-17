import type { SimOutcome, SimRecord } from '../feed/progress.ts';
import type { ScenarioCallbacks, ScenarioResult } from './contract.ts';

// Packages call onComplete for safe AND unsafe choices, so the outcome comes from result.success.
export function outcomeOf(result: ScenarioResult): Exclude<SimOutcome, 'retry' | 'exit'> {
  if (result.success) return 'safe';
  return result.chosenAction === 'timeout' ? 'timeout' : 'unsafe';
}

type Recorder = (record: Omit<SimRecord, 'at' | 'id'>) => void;
type HostEvents = { continued(result: ScenarioResult): void; exited(): void };

// Turns package callbacks into progress records. Continue records nothing new; Exit records once.
export function scenarioCallbacks(scenario: { id: string; topicId: string }, record: Recorder, host: HostEvents): ScenarioCallbacks & { leave(): void } {
  let left = false;
  const exit = () => {
    if (left) return;
    left = true;
    record({ scenarioId: scenario.id, topicId: scenario.topicId, outcome: 'exit' });
  };
  return {
    onComplete(result) {
      record({ scenarioId: scenario.id, topicId: scenario.topicId, outcome: outcomeOf(result), chosenAction: result.chosenAction, elapsedSeconds: result.elapsedSeconds });
    },
    onRetry() { record({ scenarioId: scenario.id, topicId: scenario.topicId, outcome: 'retry' }); },
    onExit() { exit(); host.exited(); },
    onContinue(result) { left = true; host.continued(result); },
    // The host's own Back control: the same as the package's Exit, without navigating twice.
    leave: exit,
  };
}
