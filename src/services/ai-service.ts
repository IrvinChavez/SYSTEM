import {
  eventCategories,
  missionIcons,
  statInfo,
  statKeys,
  type AgendaEvent,
  type Mission,
  type StatKey,
} from "@/data/system-data";
import { formatDuration, freeBlocks, timeToMinutes } from "@/lib/dates";
import { parseJsonObject, sanitizeActions, sanitizeMission, stripMarkdown, type PlanAction } from "@/lib/plan";
import { ApiError, postWithSession } from "@/services/api-client";

export { describeAction, findConflicts, type PlanAction } from "@/lib/plan";

// La IA se llama a través de nuestra ruta /api/ai (src/app/api/ai+api.ts), que guarda la key de Groq en el
// servidor y exige una sesión de Firebase válida. Así la key nunca viaja dentro de la app ni del sitio web.

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

const eventMinutes = (event: AgendaEvent) => timeToMinutes(event.end) - timeToMinutes(event.start);

// Resumen del día para que la IA pueda platicar de tus actividades: qué está en curso, cuánto dura y qué huecos quedan.
function describeToday(player: PlayerSnapshot) {
  const today = player.events.filter((event) => event.date === player.today);
  const now = player.currentTime;
  const lines: string[] = [];

  const live = today.find((event) => event.start <= now && now < event.end);
  if (live) {
    const elapsed = timeToMinutes(now) - timeToMinutes(live.start);
    lines.push(`Ahora mismo: ${live.title} (${live.start}-${live.end}), lleva ${formatDuration(elapsed)} de ${formatDuration(eventMinutes(live))}; faltan ${formatDuration(eventMinutes(live) - elapsed)}.`);
  } else {
    const next = today.find((event) => event.start > now);
    lines.push(next ? `Ahora no hay evento. El siguiente es ${next.title} a las ${next.start}.` : "Ya no quedan eventos hoy.");
  }

  const busy = today.reduce((total, event) => total + eventMinutes(event), 0);
  lines.push(`Eventos de hoy: ${today.length}, ${formatDuration(busy)} ocupadas en total.`);
  const free = freeBlocks(today, now > "06:00" ? now : "06:00", "23:00");
  lines.push(free.length
    ? `Huecos libres de hoy desde ahora: ${free.map((block) => `${block.start}-${block.end} (${formatDuration(timeToMinutes(block.end) - timeToMinutes(block.start))})`).join(", ")}.`
    : "No quedan huecos libres de más de 30 min hoy.");
  return lines.join("\n");
}

function describePlayer(player: PlayerSnapshot) {
  const stats = statKeys.map((key) => `${key} (${statInfo[key].label}) ${player.stats[key]}`).join(", ");
  const missions = player.missions.length
    ? player.missions.map((mission) => `- id=${mission.id} | ${mission.time} | ${mission.title} | ${mission.stat} | ${mission.xp} EXP | ${mission.completed ? "hecha hoy" : "pendiente"}`).join("\n")
    : "- (sin misiones)";
  const events = player.events.length
    ? player.events.slice(0, 40).map((event) => `- id=${event.id} | ${event.date} ${event.start}-${event.end} (${formatDuration(eventMinutes(event))}) | ${event.title}${event.location ? ` | ${event.location}` : ""}${event.source === "calendar" ? " | calendario externo" : ""}`).join("\n")
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
${events}
Hoy:
${describeToday(player)}`;
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
- Los eventos marcados "calendario externo" vienen de Notion Calendar: nunca uses update_event ni delete_event con ellos;
  acomoda todo alrededor. Si quiere cambiarlos, dile que lo haga en Notion Calendar y que la app se actualiza sola.
- Si describe clases o actividades con horario que se repiten (p. ej. "Cálculo lunes y miércoles de 7 a 9"), crea un
  add_event por cada fecha del calendario de arriba en que caiga.
- Si te cuenta su rutina o actividades diarias, conviértelas en misiones (hábitos con hora) y los compromisos con
  horario fijo en eventos, sin duplicar lo que ya existe.
- Si pregunta qué tiene hoy, cuánto dura algo o cuánto tiempo libre le queda, usa la sección "Hoy" del estado.
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

type AiRequest = {
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  json: boolean;
  maxTokens: number;
  temperature: number;
};

async function callAi(request: AiRequest) {
  const data = await postWithSession("/api/ai", request, 35_000, "La IA");
  if (typeof data.content !== "string" || !data.content.trim()) {
    throw new ApiError("La IA no devolvió respuesta. Inténtalo de nuevo.");
  }
  return data.content.trim();
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
    throw new ApiError("La IA devolvió un formato inesperado. Inténtalo de nuevo.");
  }

  return parsed.missions
    .map((item) => (item && typeof item === "object" ? sanitizeMission({ ...(item as Record<string, unknown>), stat: focus }, focus) : null))
    .filter((mission): mission is Omit<Mission, "id"> => mission !== null)
    .slice(0, 3);
}
