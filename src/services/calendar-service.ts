import { toDateKey } from "@/lib/dates";
import { normalizeCalendarUrl, parseIcsEvents } from "@/lib/ics";
import { ApiError, postWithSession } from "@/services/api-client";
import { replaceCalendarEvents, updateCalendarUrl } from "@/services/player-service";

// Importa a la agenda tu calendario externo. Notion Calendar no tiene API pública: sus eventos viven en tu
// cuenta de Google Calendar, así que se lee la "dirección secreta en formato iCal" de ese calendario.
// La descarga pasa por /api/calendar (src/app/api/calendar+api.ts); aquí se interpreta y se guarda.

// Días hacia adelante que se copian a la agenda (la IA y el contador ven lo mismo).
export const CALENDAR_DAYS = 14;

export async function syncCalendar(uid: string, url: string) {
  const data = await postWithSession("/api/calendar", { url }, 25_000, "El calendario");
  if (typeof data.ics !== "string") throw new ApiError("El calendario devolvió un formato inesperado.");
  const today = toDateKey();
  const events = parseIcsEvents(data.ics, today, CALENDAR_DAYS);
  await replaceCalendarEvents(uid, events, today);
  return events.length;
}

// Valida y prueba el enlace antes de guardarlo, para no dejar conectado un enlace que no funciona.
export async function connectCalendar(uid: string, rawUrl: string) {
  const url = normalizeCalendarUrl(rawUrl);
  if (!url) throw new ApiError("Pega la dirección secreta en formato iCal (empieza con https://calendar.google.com/…).");
  const count = await syncCalendar(uid, url);
  await updateCalendarUrl(uid, url);
  return count;
}

// Quita el enlace y los eventos importados de hoy en adelante (los pasados se quedan como historial).
export async function disconnectCalendar(uid: string) {
  await updateCalendarUrl(uid, null);
  await replaceCalendarEvents(uid, [], toDateKey());
}
