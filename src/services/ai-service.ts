import { firebaseAuth } from "@/config/firebase";
import {
  eventCategories,
  missionIcons,
  statInfo,
  statKeys,
  type AgendaEvent,
  type Mission,
  type StatKey,
} from "@/data/system-data";
import { parseJsonObject, sanitizeActions, sanitizeMission, stripMarkdown, type PlanAction } from "@/lib/plan";

export { describeAction, findConflicts, type PlanAction } from "@/lib/plan";

// La IA se llama a través de nuestra ruta /api/ai (src/app/api/ai+api.ts), que guarda la key de Groq en el
// servidor y exige una sesión de Firebase válida. Así la key nunca viaja dentro de la app ni del sitio web.
// En web y en desarrollo basta la ruta relativa; en la app instalada se usa EXPO_PUBLIC_API_URL (tu dominio).
const API_URL = `${(process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/$/, "")}/api/ai`;

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

// Resumen del jugador que se le pasa a la IA para que sus respuestas sean personalizadas.
export type PlayerSnapshot = {
  name: string;
  level: number;
  rank: string;
  experience: number;
  experienceGoal: number;
  streak: number;
  weeklyProgress: number;
  stats: Record<StatKey, number>;
  missions: (Mission & { completed: boolean })[];
  events: AgendaEvent[];
  today: string;
  currentTime: string;
};

export type SystemReply = {
  reply: string;
  actions: PlanAction[];
};

const weekdayNames = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

function calendarForNextDays(today: string) {
  const [year, month, day] = today.split("-").map(Number);
  return Array.from({ length: 8 }, (_, offset) => {
    const date = new Date(year, month - 1, day + offset);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const label = offset === 0 ? " (hoy)" : offset === 1 ? " (mañana)" : "";
    return `${key} = ${weekdayNames[date.getDay()]}${label}`;
  }).join("\n");
}

function describePlayer(player: PlayerSnapshot) {
  const stats = statKeys.map((key) => `${key} (${statInfo[key].label}) ${player.stats[key]}`).join(", ");
  const missions = player.missions.length
    ? player.missions.map((mission) => `- id=${mission.id} | ${mission.time} | ${mission.title} | ${mission.stat} | ${mission.xp} EXP | ${mission.completed ? "hecha hoy" : "pendiente"}`).join("\n")
    : "- (sin misiones)";
  const events = player.events.length
    ? player.events.slice(0, 30).map((event) => `- id=${event.id} | ${event.date} ${event.start}-${event.end} | ${event.title}${event.location ? ` | ${event.location}` : ""}`).join("\n")
    : "- (sin eventos)";

  return `Jugador: ${player.name}
Nivel ${player.level}, rango ${player.rank}, EXP ${player.experience}/${player.experienceGoal}
Racha de días perfectos: ${player.streak}. Progreso semanal: ${Math.round(player.weeklyProgress * 100)}%
Estadísticas: ${stats}
Fecha y hora actual: ${player.today} ${player.currentTime}
Calendario:
${calendarForNextDays(player.today)}
Misiones diarias (se repiten todos los días):
${missions}
Eventos de agenda (fechas concretas):
${events}`;
}

const PERSONA = `Eres "el Sistema", la interfaz de Solo Leveling que guía al Jugador en una app real de hábitos.
Hablas en español, con tono de ventana del Sistema: directo, motivador y un poco épico, pero con consejos prácticos y realistas.
Las misiones son hábitos de la vida real (ejercicio, estudio, sueño, orden, bienestar), nunca aventuras de fantasía.
No des consejos médicos peligrosos. Si te preguntan algo ajeno a hábitos, productividad o bienestar, redirige con amabilidad.`;

const PLANNER_RULES = `Puedes modificar la app del Jugador proponiendo acciones. Úsalas cuando el Jugador cuente qué quiere hacer,
describa su horario o pida organizar/acomodar su día o semana:
- Las MISIONES son hábitos diarios repetitivos con una hora. Los EVENTOS son compromisos con fecha y rango de horas (clases, trabajo, citas).
- Acomoda todo sin choques: una misión no debe caer dentro del horario de un evento de ese día; deja tiempo para traslados y descanso.
- Nunca pongas dos misiones a la misma hora: sepáralas al menos 30 minutos.
- Si lo que pide ya existe como misión aunque con otro nombre (gym = Entrenamiento, leer = Lectura, estudiar = Estudio),
  MUEVE esa misión (update) en lugar de crear otra.
- Usa exactamente los id que aparecen en el estado. Nunca inventes id.
- Si lo que cuenta choca con un evento que ya existe, dilo en "reply" y pregunta qué prefiere, sin borrar nada por tu cuenta.
- Si el Jugador solo conversa o pregunta algo, responde con "actions": [].
- En "reply" explica en pocas frases qué propones y por qué (máximo 120 palabras, texto plano sin markdown ni asteriscos).
  Si hay acciones, termina diciendo que puede revisarlas y tocar "Aplicar cambios".

Responde SIEMPRE solo con un objeto JSON con esta forma:
{"reply": "texto", "actions": [ ...acciones ]}
Acciones posibles (horas en formato HH:MM de 24 h, fechas YYYY-MM-DD):
{"type":"add_mission","title":"máx. 40 caracteres","time":"HH:MM","xp":10|20|35|50,"stat":"STR|INT|VIT|AGI|PER","icon":"uno de ${missionIcons.join(" ")}"}
{"type":"update_mission","id":"...","title":"opcional","time":"opcional"}
{"type":"delete_mission","id":"..."}
{"type":"add_event","title":"...","date":"YYYY-MM-DD","start":"HH:MM","end":"HH:MM","location":"opcional","category":"${eventCategories.join("|")}"}
{"type":"update_event","id":"...","title":"opcional","date":"opcional","start":"opcional","end":"opcional","location":"opcional"}
{"type":"delete_event","id":"..."}`;

export class AiError extends Error {}

type AiRequest = {
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  json: boolean;
  maxTokens: number;
  temperature: number;
};

async function callAi(request: AiRequest) {
  const user = firebaseAuth.currentUser;
  if (!user) throw new AiError("Tu sesión expiró. Vuelve a ingresar.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 35_000);

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${await user.getIdToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    const data = await response.json().catch(() => null) as { content?: unknown; error?: unknown } | null;
    if (!response.ok) {
      throw new AiError(typeof data?.error === "string" ? data.error : `La IA respondió con un error (HTTP ${response.status}).`);
    }
    if (typeof data?.content !== "string" || !data.content.trim()) {
      throw new AiError("La IA no devolvió respuesta. Inténtalo de nuevo.");
    }
    return data.content.trim();
  } catch (error) {
    if (error instanceof AiError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new AiError("La IA tardó demasiado en responder.");
    }
    throw new AiError("No se pudo conectar con la IA. Revisa tu conexión.");
  } finally {
    clearTimeout(timeout);
  }
}

export async function askSystem(history: ChatMessage[], player: PlayerSnapshot): Promise<SystemReply> {
  const content = await callAi({
    json: true,
    maxTokens: 2048,
    temperature: 0.5,
    messages: [
      {
        role: "system",
        content: `${PERSONA}

${PLANNER_RULES}

Estado actual del Jugador:
${describePlayer(player)}`,
      },
      // Solo las últimas vueltas de la conversación, para no gastar tokens de más.
      ...history.slice(-12),
    ],
  });

  const parsed = parseJsonObject(content);
  if (!parsed) {
    // Si el modelo no respetó el JSON, al menos mostramos su texto (sin acciones).
    return { reply: stripMarkdown(content), actions: [] };
  }

  const reply = typeof parsed.reply === "string" && parsed.reply.trim() ? stripMarkdown(parsed.reply.trim()) : "Entendido, Jugador.";
  return { reply, actions: sanitizeActions(parsed.actions, player) };
}

export async function generateMissions(player: PlayerSnapshot, focus: StatKey): Promise<Omit<Mission, "id">[]> {
  const content = await callAi({
    json: true,
    maxTokens: 1200,
    temperature: 0.8,
    messages: [
      {
        role: "system",
        content: `${PERSONA}
Genera 3 misiones diarias nuevas para entrenar la estadística ${focus} (${statInfo[focus].label}: ${statInfo[focus].description}).
Deben ser hábitos concretos, medibles y alcanzables en un día, distintos a las misiones que ya tiene y en horas que no choquen con sus eventos de hoy.
Responde SOLO con JSON con esta forma exacta:
{"missions":[{"title":"máx. 40 caracteres","time":"HH:MM","xp":10|20|35|50,"stat":"${focus}","icon":"uno de ${missionIcons.join(" ")}"}]}`,
      },
      { role: "user", content: describePlayer(player) },
    ],
  });

  const parsed = parseJsonObject(content);
  if (!parsed || !Array.isArray(parsed.missions)) {
    throw new AiError("La IA devolvió un formato inesperado. Inténtalo de nuevo.");
  }

  return parsed.missions
    .map((item) => (item && typeof item === "object" ? sanitizeMission({ ...(item as Record<string, unknown>), stat: focus }, focus) : null))
    .filter((mission): mission is Omit<Mission, "id"> => mission !== null)
    .slice(0, 3);
}
