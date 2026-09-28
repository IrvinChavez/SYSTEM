import { createRemoteJWKSet, jwtVerify } from "jose";

// Proxy del servidor hacia Groq. Corre solo en el servidor (Vercel / EAS Hosting / `expo start`), por eso puede
// leer GROQ_API_KEY sin el prefijo EXPO_PUBLIC_: esa key nunca llega al teléfono ni al navegador.

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";
const PROJECT_ID = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? "";

// Llaves públicas con las que Google firma los ID tokens de Firebase Auth.
const firebaseKeys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);

// Uso personal: lista opcional de usuarios (separados por coma) que pueden usar la IA, p. ej. "irvin".
// Vacía = cualquier usuario con sesión válida.
const ALLOWED_USERS = (process.env.AI_ALLOWED_USERS ?? "")
  .split(",")
  .map((name) => name.trim().toLowerCase())
  .filter(Boolean);

const MAX_MESSAGES = 20;
const MAX_CHARS = 24_000;
const MAX_TOKENS = 2048;

// Límite simple por usuario: 20 peticiones por minuto en cada instancia del servidor.
const RATE_LIMIT = 20;
const recentRequests = new Map<string, number[]>();

function isRateLimited(uid: string) {
  const now = Date.now();
  const recent = (recentRequests.get(uid) ?? []).filter((time) => now - time < 60_000);
  recent.push(now);
  recentRequests.set(uid, recent);
  return recent.length > RATE_LIMIT;
}

const errorResponse = (status: number, error: string) => Response.json({ error }, { status });

async function verifyUser(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, firebaseKeys, {
      issuer: `https://securetoken.google.com/${PROJECT_ID}`,
      audience: PROJECT_ID,
    });
    if (typeof payload.sub !== "string" || !payload.sub) return null;
    // Las cuentas usan el correo interno "<usuario>@jugadores.system-app.com" (ver src/lib/username.ts).
    const username = typeof payload.email === "string" ? payload.email.split("@")[0].toLowerCase() : "";
    return { uid: payload.sub, username };
  } catch {
    return null;
  }
}

type IncomingMessage = { role: string; content: string };

function readBody(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const { messages, json, maxTokens, temperature } = body as Record<string, unknown>;
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) return null;

  const valid = messages.every((message): message is IncomingMessage => (
    !!message
    && typeof message === "object"
    && ["system", "user", "assistant"].includes((message as IncomingMessage).role)
    && typeof (message as IncomingMessage).content === "string"
  ));
  if (!valid) return null;

  const totalChars = (messages as IncomingMessage[]).reduce((sum, message) => sum + message.content.length, 0);
  if (totalChars > MAX_CHARS) return null;

  return {
    messages: (messages as IncomingMessage[]).map(({ role, content }) => ({ role, content })),
    json: json === true,
    maxTokens: Math.min(MAX_TOKENS, Math.max(64, Number(maxTokens) || 1024)),
    temperature: Math.min(1, Math.max(0, Number(temperature) || 0.5)),
  };
}

export async function POST(request: Request) {
  // Errores de configuración del servidor con mensaje explícito, para no confundirlos con una sesión inválida.
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return errorResponse(503, "La IA no está configurada en el servidor (falta GROQ_API_KEY).");
  if (!PROJECT_ID) return errorResponse(503, "Falta EXPO_PUBLIC_FIREBASE_PROJECT_ID en las variables del servidor.");

  const user = await verifyUser(request);
  if (!user) return errorResponse(401, "Tu sesión expiró. Vuelve a ingresar.");
  if (ALLOWED_USERS.length > 0 && !ALLOWED_USERS.includes(user.username)) {
    return errorResponse(403, "Esta cuenta no tiene acceso a la IA del Sistema.");
  }
  if (isRateLimited(user.uid)) return errorResponse(429, "Demasiadas peticiones a la IA. Espera un minuto.");

  const body = readBody(await request.json().catch(() => null));
  if (!body) return errorResponse(400, "Petición inválida.");

  const groqResponse = await fetch(GROQ_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: body.messages,
      max_completion_tokens: body.maxTokens,
      temperature: body.temperature,
      // gpt-oss es un modelo de razonamiento: poco razonamiento y sin incluirlo en la respuesta.
      reasoning_effort: "low",
      include_reasoning: false,
      ...(body.json ? { response_format: { type: "json_object" } } : {}),
    }),
  }).catch(() => null);

  if (!groqResponse) return errorResponse(502, "No se pudo conectar con la IA.");
  if (groqResponse.status === 429) return errorResponse(429, "Límite de uso de la IA alcanzado. Intenta en un minuto.");
  if (!groqResponse.ok) {
    console.error("Groq respondió", groqResponse.status, await groqResponse.text().catch(() => ""));
    return errorResponse(502, "La IA no está disponible en este momento.");
  }

  const data = await groqResponse.json().catch(() => null);
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) return errorResponse(502, "La IA no devolvió respuesta.");

  return Response.json({ content });
}
