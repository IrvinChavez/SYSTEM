// Firebase Auth solo acepta correo + contraseña, así que cada nombre de usuario se guarda como un correo
// interno "<usuario>@jugadores.system-app.com". El jugador nunca lo ve ni recibe correos en él, y Firebase
// garantiza que no haya dos usuarios con el mismo nombre.
const USERNAME_DOMAIN = "jugadores.system-app.com";

// Uso personal: con EXPO_PUBLIC_SIGNUP_OPEN=false se oculta el registro en la app. Para bloquearlo de verdad
// desactiva también "Habilitar creación (registro)" en Firebase Console → Authentication → Configuración.
export const signupOpen = process.env.EXPO_PUBLIC_SIGNUP_OPEN !== "false";

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export function isValidUsername(value: string) {
  return /^[a-z0-9._]{3,20}$/.test(value);
}

// Acepta un usuario o, para cuentas antiguas, directamente un correo.
export function loginIdentifierToEmail(identifier: string) {
  const value = normalizeUsername(identifier);
  return value.includes("@") ? value : `${value}@${USERNAME_DOMAIN}`;
}

export function emailToUsername(email: string | null | undefined) {
  return (email ?? "").split("@")[0];
}
