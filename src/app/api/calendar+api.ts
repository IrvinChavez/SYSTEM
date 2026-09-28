import { normalizeCalendarUrl } from "@/lib/ics";
import { createRateLimiter, errorResponse, missingProjectId, verifyUser } from "@/server/auth";

// Descarga el calendario .ics del jugador (Google Calendar / Notion Calendar, iCloud u Outlook) y lo devuelve
// tal cual; la app lo interpreta. Hace falta un servidor porque el navegador bloquea (CORS) leer esos .ics
// directamente. Solo acepta hosts de calendario conocidos para que no se use como proxy hacia cualquier sitio.

const MAX_BYTES = 3 * 1024 * 1024;
const isRateLimited = createRateLimiter(10);

// Sigue redirecciones a mano (iCloud manda a otro de sus servidores) y solo si el destino también es permitido.
async function fetchCalendar(url: string) {
  const signal = AbortSignal.timeout(15_000);
  let current = url;
  for (let hop = 0; hop < 3; hop++) {
    const response = await fetch(current, { headers: { Accept: "text/calendar" }, redirect: "manual", signal }).catch(() => null);
    const location = response && response.status >= 300 && response.status < 400 ? response.headers.get("location") : null;
    if (!location) return response;
    const next = normalizeCalendarUrl(new URL(location, current).toString());
    if (!next) return null;
    current = next;
  }
  return null;
}

export async function POST(request: Request) {
  const configError = missingProjectId();
  if (configError) return configError;

  const user = await verifyUser(request);
  if (!user) return errorResponse(401, "Tu sesión expiró. Vuelve a ingresar.");
  if (isRateLimited(user.uid)) return errorResponse(429, "Demasiadas sincronizaciones. Espera un minuto.");

  const body = await request.json().catch(() => null) as { url?: unknown } | null;
  const url = typeof body?.url === "string" ? normalizeCalendarUrl(body.url) : null;
  if (!url) return errorResponse(400, "Ese enlace no es de un calendario compatible (Google, iCloud u Outlook).");

  const response = await fetchCalendar(url);
  if (!response) return errorResponse(502, "No se pudo conectar con tu calendario.");
  if (response.status === 404 || response.status === 403 || response.status === 401) {
    return errorResponse(404, "El calendario no existe o el enlace secreto cambió. Cópialo de nuevo.");
  }
  if (!response.ok) return errorResponse(502, `Tu calendario respondió con un error (HTTP ${response.status}).`);
  if (Number(response.headers.get("content-length") ?? 0) > MAX_BYTES) return errorResponse(413, "El calendario es demasiado grande.");

  const ics = await response.text().catch(() => "");
  if (ics.length > MAX_BYTES) return errorResponse(413, "El calendario es demasiado grande.");
  if (!ics.trimStart().startsWith("BEGIN:VCALENDAR")) {
    return errorResponse(422, "El enlace no devolvió un calendario. Usa la dirección secreta en formato iCal.");
  }

  return Response.json({ ics });
}
