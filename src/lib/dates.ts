function pad(value: number) {
  return value.toString().padStart(2, "0");
}

// Clave YYYY-MM-DD en hora local (toISOString usa UTC y cambia de día antes de medianoche).
export function toDateKey(date: Date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function fromDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function isValidTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function currentTime() {
  const now = new Date();
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

const weekdays = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function formatDateLabel(dateKey: string) {
  const today = toDateKey();
  if (dateKey === today) return "Hoy";
  if (dateKey === toDateKey(addDays(new Date(), 1))) return "Mañana";
  const date = fromDateKey(dateKey);
  return `${weekdays[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`;
}

export function greetingForNow() {
  const hour = new Date().getHours();
  if (hour < 12) return "Buenos días,";
  if (hour < 19) return "Buenas tardes,";
  return "Buenas noches,";
}

export function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(value: number) {
  return `${pad(Math.floor(value / 60))}:${pad(value % 60)}`;
}

// "2 h", "1 h 30 min", "45 min".
export function formatDuration(totalMinutes: number) {
  const minutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

// Cronómetro "HH:MM:SS" (o "MM:SS" si dura menos de una hora).
export function formatClock(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const clock = `${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`;
  return hours > 0 ? `${pad(hours)}:${clock}` : clock;
}

export type EventTiming = {
  status: "upcoming" | "live" | "done";
  totalSeconds: number;
  // Segundos transcurridos desde el inicio: arranca en 0 cuando empieza la clase.
  elapsedSeconds: number;
  // Segundos que faltan para que empiece (solo "upcoming").
  startsInSeconds: number;
};

// En qué punto está un evento con fecha y horas locales respecto a `now`.
export function eventTiming(event: { date: string; start: string; end: string }, now: Date = new Date()): EventTiming {
  const day = fromDateKey(event.date);
  const start = new Date(day);
  start.setMinutes(timeToMinutes(event.start));
  const end = new Date(day);
  end.setMinutes(timeToMinutes(event.end));

  const totalSeconds = Math.max(0, (end.getTime() - start.getTime()) / 1000);
  const sinceStart = (now.getTime() - start.getTime()) / 1000;
  if (sinceStart < 0) return { status: "upcoming", totalSeconds, elapsedSeconds: 0, startsInSeconds: -sinceStart };
  if (sinceStart >= totalSeconds) return { status: "done", totalSeconds, elapsedSeconds: totalSeconds, startsInSeconds: 0 };
  return { status: "live", totalSeconds, elapsedSeconds: sinceStart, startsInSeconds: 0 };
}

// Huecos libres entre `from` y `to` (HH:MM) dado un día de eventos, que pueden encimarse.
export function freeBlocks(events: { start: string; end: string }[], from: string, to: string, minMinutes = 30) {
  const limit = timeToMinutes(to);
  let cursor = timeToMinutes(from);
  const blocks: { start: string; end: string }[] = [];
  const busy = events
    .map((event) => [timeToMinutes(event.start), timeToMinutes(event.end)] as const)
    .sort((a, b) => a[0] - b[0]);

  for (const [start, end] of busy) {
    if (start >= limit) break;
    if (start - cursor >= minMinutes) blocks.push({ start: minutesToTime(cursor), end: minutesToTime(start) });
    cursor = Math.max(cursor, end);
  }
  if (limit - cursor >= minMinutes) blocks.push({ start: minutesToTime(cursor), end: minutesToTime(limit) });
  return blocks;
}
