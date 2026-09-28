import { Platform } from "react-native";
import { firebaseAuth } from "@/config/firebase";

// Llama a nuestras rutas /api (src/app/api) con el token de sesión de Firebase.
// En web y en desarrollo basta la ruta relativa; en la app instalada se usa EXPO_PUBLIC_API_URL (tu dominio).
const API_BASE = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/$/, "");

export class ApiError extends Error {}

export async function postWithSession(path: string, body: unknown, timeoutMs: number, what: string) {
  const user = firebaseAuth.currentUser;
  if (!user) throw new ApiError("Tu sesión expiró. Vuelve a ingresar.");
  // En el APK una ruta relativa no lleva a ningún lado: sin la URL del servidor la IA nunca respondería.
  if (Platform.OS !== "web" && !API_BASE) {
    throw new ApiError("Esta versión de la app no sabe dónde está el servidor (se compiló sin EXPO_PUBLIC_API_URL).");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${await user.getIdToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => null) as Record<string, unknown> | null;
    if (!response.ok) {
      throw new ApiError(typeof data?.error === "string" ? data.error : `${what} respondió con un error (HTTP ${response.status}).`);
    }
    return data ?? {};
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError(`${what} tardó demasiado en responder.`);
    }
    throw new ApiError(`No se pudo conectar con ${what.charAt(0).toLowerCase()}${what.slice(1)} (${API_BASE || "servidor local"}). Revisa tu conexión.`);
  } finally {
    clearTimeout(timeout);
  }
}
