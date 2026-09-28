import type { AgendaEvent } from "@/data/system-data";
import { addDays, fromDateKey, toDateKey } from "@/lib/dates";

// Lector de calendarios iCalendar (.ics), el formato de la "dirección secreta" de Google Calendar, que es donde
// Notion Calendar guarda tus eventos. Lógica pura con pruebas en tests/ics.test.ts.
// Soporta: eventos sueltos, repeticiones DAILY/WEEKLY (clases lunes y miércoles…) y MONTHLY/YEARLY simples,
// UNTIL/COUNT/INTERVAL, EXDATE, instancias movidas (RECURRENCE-ID), eventos cancelados y zonas horarias (TZID).
// Los eventos de todo el día se ignoran: en la agenda chocarían con todo.

export type ImportedEvent = Omit<AgendaEvent, "id"> & { externalId: string };

type Property = { value: string; params: Record<string, string> };
type RawEvent = Map<string, Property[]>;
type WallTime = { y: number; m: number; d: number; hh: number; mm: number };
type DateValue = { wall: WallTime; utc: boolean; allDay: boolean; tzid?: string };

const DAY_MS = 86_400_000;
const WEEKDAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const MAX_EVENTS = 300;

function parseLine(line: string): [string, Property] | null {
  let inQuotes = false;
  let colon = -1;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === "\"") inQuotes = !inQuotes;
    else if (line[i] === ":" && !inQuotes) {
      colon = i;
      break;
    }
  }
  if (colon <= 0) return null;
  const [name, ...rawParams] = line.slice(0, colon).split(";");
  const params: Record<string, string> = {};
  for (const param of rawParams) {
    const eq = param.indexOf("=");
    if (eq > 0) params[param.slice(0, eq).toUpperCase()] = param.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return [name.toUpperCase(), { value: line.slice(colon + 1), params }];
}

function parseVevents(text: string) {
  // Las líneas largas se "doblan" empezando la siguiente con espacio o tab.
  const lines = text.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
  const events: RawEvent[] = [];
  let current: RawEvent | null = null;
  let nested = 0;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      current = new Map();
      nested = 0;
    } else if (line === "END:VEVENT") {
      if (current) events.push(current);
      current = null;
    } else if (current) {
      // Ignora componentes dentro del evento (VALARM, recordatorios).
      if (line.startsWith("BEGIN:")) nested++;
      else if (line.startsWith("END:")) nested--;
      else if (nested === 0) {
        const parsed = parseLine(line);
        if (parsed) current.set(parsed[0], [...(current.get(parsed[0]) ?? []), parsed[1]]);
      }
    }
  }
  return events;
}

const first = (event: RawEvent, name: string) => event.get(name)?.[0];

function unescapeText(value: string) {
  return value.replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1").replace(/\s+/g, " ").trim();
}

function parseDateString(value: string, params: Record<string, string>): DateValue | null {
  const match = value.trim().match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!match) return null;
  const [, y, m, d, hh, mm, , z] = match;
  return {
    wall: { y: Number(y), m: Number(m), d: Number(d), hh: Number(hh ?? 0), mm: Number(mm ?? 0) },
    utc: z === "Z",
    allDay: params.VALUE === "DATE" || hh === undefined,
    tzid: params.TZID,
  };
}

const formatters = new Map<string, Intl.DateTimeFormat | null>();

// Diferencia (ms) entre la hora de pared de `timeZone` y UTC en ese instante; null si la zona no se reconoce.
function zoneOffset(instant: number, timeZone: string) {
  if (!formatters.has(timeZone)) {
    try {
      formatters.set(timeZone, new Intl.DateTimeFormat("en-US", {
        timeZone,
        hourCycle: "h23",
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
      }));
    } catch {
      formatters.set(timeZone, null);
    }
  }
  const formatter = formatters.get(timeZone);
  if (!formatter) return null;
  try {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(instant)).map((part) => [part.type, Number(part.value)]));
    const wallAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour % 24, parts.minute);
    return Number.isNaN(wallAsUtc) ? null : wallAsUtc - Math.floor(instant / 60_000) * 60_000;
  } catch {
    // Motores sin soporte completo de Intl: se usa la hora local del teléfono.
    return null;
  }
}

// Instante real (ms) de una hora de pared. Sin zona reconocible se asume la hora local del teléfono.
function toInstant(wall: WallTime, utc: boolean, tzid?: string) {
  const asUtc = Date.UTC(wall.y, wall.m - 1, wall.d, wall.hh, wall.mm);
  if (utc) return asUtc;
  if (tzid) {
    const offset = zoneOffset(asUtc, tzid);
    if (offset !== null) {
      const guess = asUtc - offset;
      const corrected = zoneOffset(guess, tzid);
      return corrected !== null && corrected !== offset ? asUtc - corrected : guess;
    }
  }
  return new Date(wall.y, wall.m - 1, wall.d, wall.hh, wall.mm).getTime();
}

function dateInstant(value: DateValue) {
  return toInstant(value.wall, value.utc, value.tzid);
}

// "PT1H30M", "P1D", "PT45M" → ms.
function parseDuration(value: string) {
  const match = value.match(/^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!match) return null;
  const [, sign, w, d, h, m, s] = match;
  const ms = ((Number(w ?? 0) * 7 + Number(d ?? 0)) * 86_400 + Number(h ?? 0) * 3600 + Number(m ?? 0) * 60 + Number(s ?? 0)) * 1000;
  return sign === "-" ? -ms : ms;
}

const dayNumber = (wall: WallTime) => Math.floor(Date.UTC(wall.y, wall.m - 1, wall.d) / DAY_MS);
const weekday = (day: number) => new Date(day * DAY_MS).getUTCDay();

function wallFromDay(day: number, hh: number, mm: number): WallTime {
  const date = new Date(day * DAY_MS);
  return { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate(), hh, mm };
}

type Rule = { matches: (day: number) => boolean; until: number | null; count: number | null };

function parseRule(value: string, start: DateValue): Rule | null {
  const parts = Object.fromEntries(value.split(";").map((part) => {
    const [key, ...rest] = part.split("=");
    return [key.toUpperCase(), rest.join("=")];
  }));
  const interval = Math.max(1, Number(parts.INTERVAL) || 1);
  const startDay = dayNumber(start.wall);
  const untilValue = parts.UNTIL ? parseDateString(parts.UNTIL, {}) : null;
  // UNTIL sin "Z" usa la misma zona que el inicio; si es solo fecha, incluye todo ese día.
  const until = untilValue
    ? toInstant(untilValue.allDay ? { ...untilValue.wall, hh: 23, mm: 59 } : untilValue.wall, untilValue.utc, start.tzid)
    : null;
  const count = parts.COUNT ? Number(parts.COUNT) : null;
  const unsupported = ["BYMONTHDAY", "BYSETPOS", "BYYEARDAY", "BYWEEKNO", "BYHOUR", "BYMINUTE", "BYMONTH"].some((key) => key in parts);
  if (unsupported) return null;

  switch (parts.FREQ) {
    case "DAILY":
      if (parts.BYDAY) return null;
      return { until, count, matches: (day) => (day - startDay) % interval === 0 };
    case "WEEKLY": {
      const days = new Set((parts.BYDAY ? parts.BYDAY.split(",") : [WEEKDAYS[weekday(startDay)]])
        .map((code: string) => WEEKDAYS.indexOf(code.replace(/^[+-]?\d+/, "")))
        .filter((index: number) => index >= 0));
      const weekStartIndex = Math.max(0, WEEKDAYS.indexOf(parts.WKST ?? "MO"));
      const weekStart = (day: number) => day - ((weekday(day) - weekStartIndex + 7) % 7);
      return {
        until,
        count,
        matches: (day) => days.has(weekday(day)) && ((weekStart(day) - weekStart(startDay)) / 7) % interval === 0,
      };
    }
    case "MONTHLY":
      if (parts.BYDAY) return null;
      return {
        until,
        count,
        matches: (day) => {
          const wall = wallFromDay(day, 0, 0);
          const months = (wall.y - start.wall.y) * 12 + (wall.m - start.wall.m);
          return wall.d === start.wall.d && months % interval === 0;
        },
      };
    case "YEARLY":
      if (parts.BYDAY) return null;
      return {
        until,
        count,
        matches: (day) => {
          const wall = wallFromDay(day, 0, 0);
          return wall.m === start.wall.m && wall.d === start.wall.d && (wall.y - start.wall.y) % interval === 0;
        },
      };
    default:
      return null;
  }
}

function guessCategory(title: string) {
  if (/examen|parcial|quiz|evaluaci[oó]n/i.test(title)) return "EXAMEN";
  if (/trabajo|turno|junta|reuni[oó]n|meeting/i.test(title)) return "TRABAJO";
  if (/clase|materia|laboratorio|taller|c[aá]lculo|f[ií]sica|qu[ií]mica|programaci[oó]n/i.test(title)) return "CLASE";
  return "OTRO";
}

const pad = (value: number) => value.toString().padStart(2, "0");
const localTime = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

// Convierte el texto .ics en eventos de agenda (hora local del teléfono) entre `today` y `today + days`.
export function parseIcsEvents(text: string, today: string, days = 14): ImportedEvent[] {
  const windowStart = fromDateKey(today).getTime();
  const windowEnd = addDays(fromDateKey(today), days).getTime();
  const raw = parseVevents(text);

  // Instancias de una serie que se movieron o cancelaron: la serie original no debe generarlas.
  const overridden = new Map<string, Set<number>>();
  for (const event of raw) {
    const uid = first(event, "UID")?.value;
    const recurrence = first(event, "RECURRENCE-ID");
    const parsed = recurrence && parseDateString(recurrence.value, recurrence.params);
    if (uid && parsed) overridden.set(uid, (overridden.get(uid) ?? new Set()).add(dateInstant(parsed)));
  }

  const result: ImportedEvent[] = [];
  const push = (uid: string, title: string, location: string, startMs: number, durationMs: number) => {
    if (startMs < windowStart || startMs >= windowEnd) return;
    const start = new Date(startMs);
    const end = new Date(startMs + durationMs);
    const date = toDateKey(start);
    // Si cruza la medianoche se recorta al final del día (la agenda trabaja por día).
    const endTime = toDateKey(end) === date ? localTime(end) : "23:59";
    const startTime = localTime(start);
    if (endTime <= startTime) return;
    result.push({ title, date, start: startTime, end: endTime, location, category: guessCategory(title), source: "calendar", externalId: `${uid}@${startMs}` });
  };

  for (const event of raw) {
    if (first(event, "STATUS")?.value.toUpperCase() === "CANCELLED") continue;
    const startProp = first(event, "DTSTART");
    const start = startProp && parseDateString(startProp.value, startProp.params);
    if (!start || start.allDay) continue;

    const startMs = dateInstant(start);
    const endProp = first(event, "DTEND");
    const end = endProp && parseDateString(endProp.value, endProp.params);
    const durationProp = first(event, "DURATION");
    const durationMs = end ? dateInstant(end) - startMs : durationProp ? parseDuration(durationProp.value) : null;
    if (!durationMs || durationMs <= 0) continue;

    const uid = first(event, "UID")?.value ?? `${startMs}`;
    const title = unescapeText(first(event, "SUMMARY")?.value ?? "").slice(0, 60) || "(Sin título)";
    const location = unescapeText(first(event, "LOCATION")?.value ?? "").slice(0, 60);
    const ruleProp = first(event, "RRULE");
    const rule = ruleProp && !first(event, "RECURRENCE-ID") ? parseRule(ruleProp.value, start) : null;

    if (!rule) {
      push(uid, title, location, startMs, durationMs);
      continue;
    }

    const excluded = new Set(overridden.get(uid));
    for (const exdate of event.get("EXDATE") ?? []) {
      for (const value of exdate.value.split(",")) {
        const parsed = parseDateString(value, { ...exdate.params, TZID: exdate.params.TZID ?? start.tzid ?? "" });
        if (parsed) excluded.add(dateInstant(parsed));
      }
    }

    const startDay = dayNumber(start.wall);
    let occurrences = 0;
    // Se recorre día por día desde el inicio de la serie (COUNT cuenta desde ahí), con un tope de ~30 años.
    for (let day = startDay; day < startDay + 11_000; day++) {
      if (!rule.matches(day)) continue;
      const occurrence = toInstant(wallFromDay(day, start.wall.hh, start.wall.mm), start.utc, start.tzid);
      if (occurrence >= windowEnd || (rule.until !== null && occurrence > rule.until)) break;
      occurrences++;
      if (rule.count !== null && occurrences > rule.count) break;
      if (!excluded.has(occurrence)) push(uid, title, location, occurrence, durationMs);
    }
  }

  return result
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
    .slice(0, MAX_EVENTS);
}

// Id de documento estable por instancia, para que sincronizar dos veces (o desde dos teléfonos) no duplique.
export function calendarDocId(externalId: string) {
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < externalId.length; i++) {
    const code = externalId.charCodeAt(i);
    a = Math.imul(a ^ code, 0x01000193) >>> 0;
    b = Math.imul(b ^ code, 0x5bd1e995) >>> 0;
  }
  return `cal-${a.toString(16).padStart(8, "0")}${b.toString(16).padStart(8, "0")}`;
}

// Convierte "webcal://" en https y solo acepta los servicios de calendario conocidos.
const allowedHosts = [/^calendar\.google\.com$/, /(^|\.)icloud\.com$/, /^outlook\.(office365|live)\.com$/, /^outlook\.office\.com$/];

export function normalizeCalendarUrl(value: string) {
  const trimmed = value.trim().replace(/^webcals?:\/\//i, "https://");
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" || !allowedHosts.some((host) => host.test(url.hostname))) return null;
    return url.toString();
  } catch {
    return null;
  }
}
