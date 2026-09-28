import * as Crypto from "expo-crypto";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// Ingreso con huella / Face ID. Firebase no guarda huellas (y la huella nunca sale del teléfono): lo que se hace
// es guardar usuario y contraseña en el almacén seguro del sistema (Android Keystore / iOS Keychain) con una llave
// que solo se desbloquea con tu biometría. Si agregas o quitas huellas, el sistema invalida esa llave a propósito.

const CREDENTIALS_KEY = "system.biometric.credentials";
// Sin protección biométrica: solo sirve para mostrar "Entrar como @usuario" sin pedir la huella antes de tiempo.
const USERNAME_KEY = "system.biometric.username";

export type BiometricSupport = { available: boolean; label: string };

export class BiometricError extends Error {
  constructor(message: string, readonly cancelled = false) {
    super(message);
  }
}

export async function biometricSupport(): Promise<BiometricSupport> {
  if (Platform.OS === "web") return { available: false, label: "huella" };
  try {
    const [hasHardware, enrolled, types] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);
    const faceOnly = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
      && !types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
    return {
      available: hasHardware && enrolled && SecureStore.canUseBiometricAuthentication(),
      label: faceOnly ? "Face ID" : "huella",
    };
  } catch {
    return { available: false, label: "huella" };
  }
}

function toBiometricError(error: unknown): BiometricError {
  const message = error instanceof Error ? error.message : String(error);
  if (/cancel/i.test(message)) return new BiometricError("Cancelaste la verificación.", true);
  if (/invalidat|permanently/i.test(message)) {
    return new BiometricError("Tus huellas del teléfono cambiaron y el ingreso con huella se desactivó por seguridad. Entra con tu contraseña para activarlo de nuevo.");
  }
  return new BiometricError("No se pudo verificar tu huella. Inténtalo de nuevo o usa tu contraseña.");
}

// Guarda usuario y contraseña protegidos con la huella. Siempre pide la huella antes de guardar.
export async function saveBiometricLogin(username: string, password: string) {
  try {
    // En Android guardar con requireAuthentication ya muestra el diálogo de huella; en iOS no, así que se pide antes.
    if (Platform.OS === "ios") {
      const result = await LocalAuthentication.authenticateAsync({ promptMessage: "Activa el ingreso con Face ID", cancelLabel: "Cancelar" });
      if (!result.success) throw new Error(result.error);
    }
    await SecureStore.setItemAsync(CREDENTIALS_KEY, JSON.stringify({ username, password }), {
      requireAuthentication: true,
      authenticationPrompt: "Pon tu huella para activar el ingreso rápido",
    });
    await SecureStore.setItemAsync(USERNAME_KEY, username);
  } catch (error) {
    throw toBiometricError(error);
  }
}

export async function readBiometricLogin(prompt = "Entra a SYSTEM con tu huella") {
  let raw: string | null;
  try {
    raw = await SecureStore.getItemAsync(CREDENTIALS_KEY, { requireAuthentication: true, authenticationPrompt: prompt });
  } catch (error) {
    const biometricError = toBiometricError(error);
    // Llave invalidada: se borra para que el botón de huella no vuelva a aparecer roto.
    if (!biometricError.cancelled && /cambiaron/.test(biometricError.message)) await clearBiometricLogin();
    throw biometricError;
  }
  const parsed = raw ? JSON.parse(raw) as { username?: unknown; password?: unknown } : null;
  if (typeof parsed?.username !== "string" || typeof parsed.password !== "string") {
    throw new BiometricError("No hay ingreso con huella guardado en este teléfono.");
  }
  return { username: parsed.username, password: parsed.password };
}

export async function storedBiometricUsername() {
  if (Platform.OS === "web") return null;
  try {
    return await SecureStore.getItemAsync(USERNAME_KEY);
  } catch {
    return null;
  }
}

export async function clearBiometricLogin() {
  if (Platform.OS === "web") return;
  await Promise.all([SecureStore.deleteItemAsync(CREDENTIALS_KEY), SecureStore.deleteItemAsync(USERNAME_KEY)]).catch(() => undefined);
}

// Contraseña aleatoria de 24 caracteres (~143 bits) para las cuentas que se registran solo con huella.
export function generatePassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789-_!?";
  return Array.from(Crypto.getRandomBytes(24), (byte) => alphabet[byte % alphabet.length]).join("");
}
