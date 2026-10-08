export type LeaderboardEntry = { nickname: string; avatar: string; xp: number; rank: number; isYou?: boolean };
export type LeaderboardSnapshot = { entries: LeaderboardEntry[]; yourRank: number | null };
export type LeaderboardRow = Omit<LeaderboardEntry, 'rank'> & { rank: number | null };

export function leaderboardRows(snapshot: LeaderboardSnapshot, you: { avatar: string; xp: number }) {
  const ownEntry = snapshot.entries.find(entry => entry.isYou);
  const own: LeaderboardRow = { nickname: 'You', ...you, rank: ownEntry?.rank ?? snapshot.yourRank, isYou: true };
  const top: LeaderboardRow[] = [...snapshot.entries].sort((a, b) => a.rank - b.rank).slice(0, 5).map(entry => entry.isYou ? own : entry);
  return { top, pinned: top.some(entry => entry.isYou) ? null : own };
}
