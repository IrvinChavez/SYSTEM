import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { CalendarSync, useCalendarSync } from "@/context/use-calendar-sync";
import { AgendaEvent, DailyProgress, emptyStats, Mission, PlayerProfile } from "@/data/system-data";
import { addDays, toDateKey } from "@/lib/dates";
import { emailToUsername } from "@/lib/username";
import { currentStreak, levelFromXp, rankForLevel, weeklyCompletion } from "@/lib/leveling";
import {
  completeMission,
  initPlayer,
  uncompleteMission,
  subscribeToEvents,
  subscribeToMissions,
  subscribeToProfile,
  subscribeToProgress,
} from "@/services/player-service";

export type DailyMission = Mission & { completed: boolean };

type PlayerContextValue = {
  uid: string;
  loading: boolean;
  error: string | null;
  profile: PlayerProfile;
  level: number;
  experience: number;
  experienceGoal: number;
  rank: { rank: string; title: string };
  missions: DailyMission[];
  completedCount: number;
  streak: number;
  weeklyProgress: number;
  events: AgendaEvent[];
  todayEvents: AgendaEvent[];
  // Aplica el cambio al instante (caché local de Firestore); la promesa solo avisa si el servidor lo rechaza.
  toggleMission: (missionId: string) => Promise<void>;
  levelUpNotice: number | null;
  dismissLevelUp: () => void;
  // Calendario externo (Notion Calendar vía Google Calendar) importado a la agenda.
  calendar: CalendarSync;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

const HISTORY_DAYS = 60;

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid ?? "";
  const [todayKey, setTodayKey] = useState(toDateKey());
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [missionList, setMissionList] = useState<Mission[] | null>(null);
  const [history, setHistory] = useState<DailyProgress[]>([]);
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [levelUpNotice, setLevelUpNotice] = useState<number | null>(null);

  // Si la app queda abierta pasada la medianoche, las misiones se reinician solas.
  useEffect(() => {
    const interval = setInterval(() => setTodayKey(toDateKey()), 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!user) return;
    const onError = (reason: Error) => {
      console.warn("Error de Firestore", reason);
      setError("No se pudieron sincronizar tus datos. Revisa tu conexión y las reglas de Firestore.");
    };

    const unsubscribers = [
      subscribeToProfile(user.uid, (nextProfile) => {
        // Solo si el perfil no existe (cuenta nueva o borrada a mano) lo creamos; así abrir la app sin
        // internet no dispara una transacción que fallaría.
        if (nextProfile === null) initPlayer(user.uid, emailToUsername(user.email)).catch(onError);
        else setProfile(nextProfile);
      }, onError),
      subscribeToMissions(user.uid, setMissionList, onError),
      subscribeToProgress(user.uid, toDateKey(addDays(new Date(), -HISTORY_DAYS)), setHistory, onError),
      subscribeToEvents(user.uid, todayKey, setEvents, onError),
    ];

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [user, todayKey]);

  const calendar = useCalendarSync(uid, profile?.calendarUrl ?? null, todayKey);

  const value = useMemo<PlayerContextValue>(() => {
    const safeProfile = profile ?? { name: user?.displayName ?? "Player", username: emailToUsername(user?.email), photo: null, calendarUrl: null, totalXp: 0, stats: emptyStats };
    const todayProgress = history.find((entry) => entry.dateKey === todayKey);
    const completedIds = todayProgress?.completedMissionIds ?? [];
    const missions = (missionList ?? []).map((mission) => ({ ...mission, completed: completedIds.includes(mission.id) }));
    const completedCount = missions.filter((mission) => mission.completed).length;
    const { level, experience, experienceGoal } = levelFromXp(safeProfile.totalXp);

    return {
      uid,
      loading: profile === null || missionList === null,
      error,
      profile: safeProfile,
      level,
      experience,
      experienceGoal,
      rank: rankForLevel(level),
      missions,
      completedCount,
      streak: currentStreak(history),
      weeklyProgress: weeklyCompletion(history, completedCount, missions.length),
      events,
      todayEvents: events.filter((event) => event.date === todayKey),
      toggleMission: (missionId) => {
        const mission = missions.find((item) => item.id === missionId);
        if (!mission) return Promise.resolve();

        if (mission.completed) {
          return uncompleteMission(uid, todayKey, mission, todayProgress?.rewards[mission.id] ?? null, missions.length);
        }

        const newLevel = levelFromXp(safeProfile.totalXp + mission.xp).level;
        if (newLevel > level) setLevelUpNotice(newLevel);
        return completeMission(uid, todayKey, mission, missions.length);
      },
      levelUpNotice,
      dismissLevelUp: () => setLevelUpNotice(null),
      calendar,
    };
  }, [uid, user, profile, missionList, history, events, error, todayKey, levelUpNotice, calendar]);

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error("usePlayer debe usarse dentro de <PlayerProvider>");
  }
  return context;
}
