import { createRemoteJWKSet, jwtVerify } from "jose";

// Utilidades compartidas por las rutas /api (solo corren en el servidor).

const PROJECT_ID = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? "";

// Llaves públicas con las que Google firma los ID tokens de Firebase Auth.
const firebaseKeys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);

export const errorResponse = (status: number, error: string) => Response.json({ error }, { status });

export function missingProjectId() {
  return PROJECT_ID ? null : errorResponse(503, "Falta EXPO_PUBLIC_FIREBASE_PROJECT_ID en las variables del servidor.");
}

export async function verifyUser(request: Request) {
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

// Límite simple por usuario: `limit` peticiones por minuto en cada instancia del servidor.
export function createRateLimiter(limit: number) {
  const recentRequests = new Map<string, number[]>();
  return function isRateLimited(uid: string) {
    const now = Date.now();
    const recent = (recentRequests.get(uid) ?? []).filter((time) => now - time < 60_000);
    recent.push(now);
    recentRequests.set(uid, recent);
    return recent.length > limit;
  };
}
