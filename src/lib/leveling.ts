import { statKeys, type DailyProgress, type PlayerStats, type StatKey } from "@/data/system-data";
import { addDays, toDateKey } from "@/lib/dates";

// Subir del nivel n al n+1 cuesta n * 100 EXP.
export function experienceForLevel(level: number) {
  return level * 100;
}

export function levelFromXp(totalXp: number) {
  let level = 1;
  let remaining = Math.max(0, totalXp);

  while (remaining >= experienceForLevel(level)) {
    remaining -= experienceForLevel(level);
    level += 1;
  }

  return { level, experience: remaining, experienceGoal: experienceForLevel(level) };
}

const ranks = [
  { minLevel: 50, rank: "S", title: "Monarca" },
  { minLevel: 35, rank: "A", title: "Cazador de élite" },
  { minLevel: 20, rank: "B", title: "Cazador veterano" },
  { minLevel: 10, rank: "C", title: "Cazador" },
  { minLevel: 5, rank: "D", title: "Aprendiz" },
  { minLevel: 1, rank: "E", title: "Despertado" },
];

export function rankForLevel(level: number) {
  return ranks.find((item) => level >= item.minLevel) ?? ranks[ranks.length - 1];
}

export function weakestStat(stats: PlayerStats): StatKey {
  return statKeys.reduce((weakest, key) => (stats[key] < stats[weakest] ? key : weakest), statKeys[0]);
}

function isPerfectDay(progress: DailyProgress | undefined) {
  return !!progress && progress.totalMissions > 0 && progress.completedMissionIds.length >= progress.totalMissions;
}

// Días consecutivos con todas las misiones completas. Hoy cuenta solo si ya está completo.
export function currentStreak(history: DailyProgress[]) {
  const byDate = new Map(history.map((entry) => [entry.dateKey, entry]));
  let cursor = new Date();

  if (!isPerfectDay(byDate.get(toDateKey(cursor)))) {
    cursor = addDays(cursor, -1);
  }

  let streak = 0;
  while (isPerfectDay(byDate.get(toDateKey(cursor)))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  return streak;
}

export function weeklyCompletion(history: DailyProgress[], todayCompleted: number, todayTotal: number) {
  const todayKey = toDateKey();
  const weekStart = toDateKey(addDays(new Date(), -6));
  let completed = todayCompleted;
  let total = todayTotal;

  for (const entry of history) {
    if (entry.dateKey >= weekStart && entry.dateKey < todayKey) {
      completed += Math.min(entry.completedMissionIds.length, entry.totalMissions);
      total += entry.totalMissions;
    }
  }

  return total === 0 ? 0 : completed / total;
}
