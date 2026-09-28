import { createRateLimiter, errorResponse, missingProjectId, verifyUser } from "@/server/auth";

// Proxy del servidor hacia Groq. Corre solo en el servidor (Vercel / EAS Hosting / `expo start`), por eso puede
// leer GROQ_API_KEY sin el prefijo EXPO_PUBLIC_: esa key nunca llega al teléfono ni al navegador.

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";

// Uso personal: lista opcional de usuarios (separados por coma) que pueden usar la IA, p. ej. "irvin".
// Vacía = cualquier usuario con sesión válida.
const ALLOWED_USERS = (process.env.AI_ALLOWED_USERS ?? "")
  .split(",")
  .map((name) => name.trim().toLowerCase())
  .filter(Boolean);

const MAX_MESSAGES = 20;
const MAX_CHARS = 24_000;
const MAX_TOKENS = 2048;

// 20 peticiones por minuto por usuario en cada instancia del servidor.
const isRateLimited = createRateLimiter(20);

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
  const configError = missingProjectId();
  if (configError) return configError;

  const user = await verifyUser(request);
  if (!user) return errorResponse(401, "Tu sesión expiró. Vuelve a ingresar.");
  if (ALLOWED_USERS.length > 0 && !ALLOWED_USERS.includes(user.username)) {
    return errorResponse(403, `La cuenta @${user.username} no tiene acceso a la IA (agrégala en AI_ALLOWED_USERS del servidor).`);
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
