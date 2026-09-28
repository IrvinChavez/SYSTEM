import { useEffect, useRef, useState } from "react";
import { connectCalendar, disconnectCalendar, syncCalendar } from "@/services/calendar-service";

const AUTO_SYNC_MS = 15 * 60_000;

export type CalendarSync = {
  connected: boolean;
  syncing: boolean;
  lastSync: Date | null;
  lastCount: number | null;
  error: string | null;
  // Devuelven el mensaje de error, o null si salió bien.
  sync: () => Promise<string | null>;
  connect: (url: string) => Promise<string | null>;
  disconnect: () => Promise<string | null>;
};

// Mantiene la agenda al día con el calendario externo: sincroniza al abrir la app, cada 15 minutos mientras
// está abierta y al cambiar de día (para que la ventana de 14 días avance).
export function useCalendarSync(uid: string, url: string | null, todayKey: string): CalendarSync {
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [lastCount, setLastCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const lastAttempt = useRef(0);
  const syncedDay = useRef("");

  const run = async (task: () => Promise<number | null>) => {
    if (inFlight.current) return "Ya se está sincronizando.";
    inFlight.current = true;
    lastAttempt.current = Date.now();
    setSyncing(true);
    setError(null);
    try {
      const count = await task();
      setLastSync(count === null ? null : new Date());
      setLastCount(count);
      return null;
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "No se pudo sincronizar el calendario.";
      setError(message);
      return message;
    } finally {
      inFlight.current = false;
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (!uid || !url) return;
    const tick = () => {
      if (syncedDay.current === todayKey && Date.now() - lastAttempt.current < AUTO_SYNC_MS) return;
      syncedDay.current = todayKey;
      void run(() => syncCalendar(uid, url));
    };
    tick();
    const interval = setInterval(tick, 60_000);
    return () => clearInterval(interval);
  }, [uid, url, todayKey]);

  return {
    connected: !!url,
    syncing,
    lastSync,
    lastCount,
    error,
    sync: () => (url ? run(() => syncCalendar(uid, url)) : Promise.resolve("No hay calendario conectado.")),
    connect: (nextUrl) => run(async () => {
      const count = await connectCalendar(uid, nextUrl);
      syncedDay.current = todayKey;
      return count;
    }),
    disconnect: () => run(async () => {
      await disconnectCalendar(uid);
      return null;
    }),
  };
}
