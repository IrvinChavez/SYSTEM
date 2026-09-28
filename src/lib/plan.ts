import {
  eventCategories,
  missionIcons,
  statInfo,
  statKeys,
  type AgendaEvent,
  type Mission,
  type StatKey,
} from "@/data/system-data";
import { isValidTime } from "@/lib/dates";

// Lógica pura (sin red ni Firebase) para validar lo que propone la IA. Tiene pruebas en tests/plan.test.ts.

export type PlanSnapshot = {
  missions: Mission[];
  events: AgendaEvent[];
  today: string;
};

// Cambios que la IA propone y que el jugador aprueba antes de aplicarlos.
export type PlanAction =
  | { type: "add_mission"; mission: Omit<Mission, "id"> }
  | { type: "update_mission"; id: string; before: Mission; changes: Partial<Pick<Mission, "title" | "time">> }
  | { type: "delete_mission"; id: string; before: Mission }
  | { type: "add_event"; event: Omit<AgendaEvent, "id"> }
  | { type: "update_event"; id: string; before: AgendaEvent; changes: Partial<Omit<AgendaEvent, "id" | "category">> }
  | { type: "delete_event"; id: string; before: AgendaEvent };

const allowedXp = [10, 20, 35, 50];
const isDateKey = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

export function sanitizeMission(raw: Record<string, unknown>, fallbackStat: StatKey): Omit<Mission, "id"> | null {
  const title = text(raw.title, 40);
  if (!title) return null;
  const stat = statKeys.includes(raw.stat as StatKey) ? (raw.stat as StatKey) : fallbackStat;
  return {
    title,
    time: typeof raw.time === "string" && isValidTime(raw.time) ? raw.time : "08:00",
    xp: allowedXp.includes(Number(raw.xp)) ? Number(raw.xp) : 20,
    stat,
    icon: typeof raw.icon === "string" && missionIcons.includes(raw.icon) ? raw.icon : statInfo[stat].icon,
  };
}

// Todo lo que viene de la IA se valida aquí: ids que existan, horas y fechas válidas, valores permitidos.
export function sanitizeActions(rawActions: unknown, player: PlanSnapshot): PlanAction[] {
  if (!Array.isArray(rawActions)) return [];
  const missionsById = new Map(player.missions.map((mission) => [mission.id, mission]));
  const eventsById = new Map(player.events.map((event) => [event.id, event]));

  return rawActions.slice(0, 12).flatMap((item): PlanAction[] => {
    if (!item || typeof item !== "object") return [];
    const raw = item as Record<string, unknown>;
    const id = typeof raw.id === "string" ? raw.id : "";

    switch (raw.type) {
      case "add_mission": {
        const mission = sanitizeMission(raw, "AGI");
        return mission ? [{ type: "add_mission", mission }] : [];
      }
      case "update_mission": {
        const before = missionsById.get(id);
        if (!before) return [];
        const changes: Partial<Pick<Mission, "title" | "time">> = {};
        if (text(raw.title, 40) && text(raw.title, 40) !== before.title) changes.title = text(raw.title, 40);
        if (typeof raw.time === "string" && isValidTime(raw.time) && raw.time !== before.time) changes.time = raw.time;
        return Object.keys(changes).length ? [{ type: "update_mission", id, before, changes }] : [];
      }
      case "delete_mission": {
        const before = missionsById.get(id);
        return before ? [{ type: "delete_mission", id, before }] : [];
      }
      case "add_event": {
        const title = text(raw.title, 40);
        const start = typeof raw.start === "string" && isValidTime(raw.start) ? raw.start : null;
        const end = typeof raw.end === "string" && isValidTime(raw.end) ? raw.end : null;
        if (!title || !isDateKey(raw.date) || raw.date < player.today || !start || !end || end <= start) return [];
        const category = typeof raw.category === "string" && eventCategories.includes(raw.category) ? raw.category : "OTRO";
        return [{ type: "add_event", event: { title, date: raw.date, start, end, location: text(raw.location, 40), category } }];
      }
      case "update_event": {
        const before = eventsById.get(id);
        if (!before) return [];
        const changes: Partial<Omit<AgendaEvent, "id" | "category">> = {};
        if (text(raw.title, 40) && text(raw.title, 40) !== before.title) changes.title = text(raw.title, 40);
        if (isDateKey(raw.date) && raw.date >= player.today && raw.date !== before.date) changes.date = raw.date;
        if (typeof raw.start === "string" && isValidTime(raw.start) && raw.start !== before.start) changes.start = raw.start;
        if (typeof raw.end === "string" && isValidTime(raw.end) && raw.end !== before.end) changes.end = raw.end;
        if (typeof raw.location === "string" && text(raw.location, 40) !== before.location) changes.location = text(raw.location, 40);
        if ((changes.end ?? before.end) <= (changes.start ?? before.start)) return [];
        return Object.keys(changes).length ? [{ type: "update_event", id, before, changes }] : [];
      }
      case "delete_event": {
        const before = eventsById.get(id);
        return before ? [{ type: "delete_event", id, before }] : [];
      }
      default:
        return [];
    }
  });
}

export function describeAction(action: PlanAction) {
  switch (action.type) {
    case "add_mission":
      return `Nueva misión: ${action.mission.title} a las ${action.mission.time} (+${action.mission.xp} EXP)`;
    case "update_mission": {
      const parts = [];
      if (action.changes.time) parts.push(`${action.before.time} → ${action.changes.time}`);
      if (action.changes.title) parts.push(`renombrar a "${action.changes.title}"`);
      return `Mover misión ${action.before.title}: ${parts.join(", ")}`;
    }
    case "delete_mission":
      return `Eliminar misión: ${action.before.title}`;
    case "add_event":
      return `Nuevo evento: ${action.event.title}, ${action.event.date} ${action.event.start}–${action.event.end}`;
    case "update_event": {
      const next = { ...action.before, ...action.changes };
      return `Cambiar evento ${action.before.title}: ${next.date} ${next.start}–${next.end}${action.changes.title ? ` ("${action.changes.title}")` : ""}`;
    }
    case "delete_event":
      return `Eliminar evento: ${action.before.title} (${action.before.date})`;
  }
}

// Revisa, sin depender de la IA, si los eventos resultantes del plan se enciman entre sí o con los existentes.
export function findConflicts(actions: PlanAction[], events: AgendaEvent[]) {
  const removed = new Set(actions.flatMap((action) => (action.type === "delete_event" ? [action.id] : [])));
  const updated = new Map(actions.flatMap((action) => (action.type === "update_event" ? [[action.id, action.changes] as const] : [])));
  const result = events
    .filter((event) => !removed.has(event.id))
    .map((event) => ({ ...event, ...updated.get(event.id), isNew: updated.has(event.id) }));
  for (const action of actions) {
    if (action.type === "add_event") result.push({ ...action.event, id: "", isNew: true });
  }

  const warnings: string[] = [];
  result.forEach((a, i) => {
    result.slice(i + 1).forEach((b) => {
      if ((a.isNew || b.isNew) && a.date === b.date && a.start < b.end && b.start < a.end) {
        warnings.push(`${a.title} (${a.start}–${a.end}) choca con ${b.title} (${b.start}–${b.end}) el ${a.date}.`);
      }
    });
  });
  return warnings;
}

// Los modelos a veces devuelven texto alrededor del JSON o JSON roto: nunca dejamos que eso llegue al usuario como excepción.
export function parseJsonObject(content: string): Record<string, unknown> | null {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const value: unknown = JSON.parse(content.slice(start, end + 1));
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

// Los Text de React Native no interpretan markdown; quitamos lo que el modelo agregue de todos modos.
export function stripMarkdown(value: string) {
  return value
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[*•]\s+/gm, "- ");
}
