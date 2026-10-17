// The V4 package contract (vendor/lane-simulations/*/src/index.ts). Packages own their scene,
// timers and choices; Lane owns navigation, progress and Review Later.
export type ScenarioResult = { scenarioId: string; topicId: string; success: boolean; chosenAction: string; elapsedSeconds: number };
export type ScenarioCallbacks = {
  onComplete(result: ScenarioResult): void;
  onRetry(): void;
  onExit(): void;
  onContinue?(result: ScenarioResult): void;
};
export type ScenarioHandle = { destroy(): void };
export type ScenarioModule = { startScenario(container: HTMLElement, callbacks: ScenarioCallbacks): ScenarioHandle };
