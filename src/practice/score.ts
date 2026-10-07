export type PermitQuestion = {
  id: string;
  topicId: string;
  // Variants of one rule share a concept so repeats don't dominate a topic's score.
  conceptId: string;
  sourcePage: number;
  prompt: string;
  image?: { src: string; alt: string };
  choices: { id: string; text: string }[];
  correctChoiceId: string;
};

export type PermitBank = {
  title: string;
  // Fraction of questions (0–1) needed to reach the practice target.
  target: number;
  topics: Record<string, string>;
  questions: PermitQuestion[];
};

export type TopicResult = { id: string; label: string; concepts: number; accuracy: number; status: 'limited' | 'review' | 'on-track' };
export type PermitResult = { correct: number; total: number; percentage: number; target: number; meetsTarget: boolean; topics: TopicResult[] };

// A topic needs this many distinct concepts before its accuracy is treated as evidence.
const MIN_CONCEPTS = 3;

export function summarize(bank: PermitBank, responses: boolean[]): PermitResult {
  const { questions, target, topics: labels } = bank;
  const correct = responses.filter(Boolean).length;
  const groups = new Map<string, Map<string, { correct: number; total: number }>>();
  questions.forEach((q, i) => {
    const concepts = groups.get(q.topicId) ?? new Map<string, { correct: number; total: number }>();
    const tally = concepts.get(q.conceptId) ?? { correct: 0, total: 0 };
    tally.total++;
    if (responses[i]) tally.correct++;
    concepts.set(q.conceptId, tally);
    groups.set(q.topicId, concepts);
  });
  const topics = [...groups].map(([id, concepts]): TopicResult => {
    // Equal concept weights keep duplicate questions from inflating topic evidence.
    const accuracy = [...concepts.values()].reduce((sum, c) => sum + c.correct / c.total, 0) / concepts.size;
    const status = concepts.size < MIN_CONCEPTS ? 'limited' : accuracy < target ? 'review' : 'on-track';
    return { id, label: labels[id] ?? id, concepts: concepts.size, accuracy, status };
  }).sort((a, b) => a.accuracy - b.accuracy);
  // The raw fraction decides the target; the displayed percentage is only rounded for reading.
  return { correct, total: questions.length, percentage: Math.round(correct / questions.length * 100), target, meetsTarget: correct / questions.length >= target, topics };
}
