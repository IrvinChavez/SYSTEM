import { Link } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text } from "react-native";
import { AuthFrame, FormError } from "@/components/auth-form";
import { PrimaryButton, TextField } from "@/components/ui";
import { systemColors } from "@/constants/system-colors";
import { authErrorMessage, useAuth } from "@/context/auth-context";
import { isValidUsername, normalizeUsername, signupOpen } from "@/lib/username";

export default function RegisterScreen() {
  const { register } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleRegister = async () => {
    const normalized = normalizeUsername(username);
    if (!isValidUsername(normalized)) {
      setError("El usuario debe tener de 3 a 20 caracteres: letras, números, punto o guion bajo (sin espacios).");
      return;
    }
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await register(normalized, password);
    } catch (reason) {
      setError(authErrorMessage(reason));
      setSubmitting(false);
    }
  };

  if (!signupOpen) {
    return (
      <AuthFrame
        title="Registro cerrado"
        subtitle="Esta instancia del Sistema es de uso personal y no acepta jugadores nuevos."
        footer={<Link href="/login" replace style={styles.link}>Ir a <Text style={styles.linkStrong}>Ingresar</Text></Link>}
      >
        {null}
      </AuthFrame>
    );
  }

  return (
    <AuthFrame
      title="Despertar"
      subtitle="Elige tu nombre de usuario. El Sistema te asignará tus primeras misiones diarias."
      footer={(
        <Link href="/login" replace style={styles.link}>
          ¿Ya eres Jugador? <Text style={styles.linkStrong}>Ingresar</Text>
        </Link>
      )}
    >
      <TextField
        label="NOMBRE DE USUARIO"
        value={username}
        onChangeText={setUsername}
        placeholder="jinwoo"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username-new"
        textContentType="username"
        maxLength={20}
      />
      <TextField
        label="CONTRASEÑA"
        value={password}
        onChangeText={setPassword}
        placeholder="Mínimo 6 caracteres"
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <TextField
        label="CONFIRMAR CONTRASEÑA"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        placeholder="Repite tu contraseña"
        secureTextEntry
        onSubmitEditing={handleRegister}
      />
      <Text style={styles.hint}>
        Guarda bien tu contraseña: al no usar correo, no se puede recuperar por email. Al registrarte aceptas la{" "}
        <Link href="/privacidad" style={styles.linkStrong}>política de privacidad</Link>.
      </Text>
      <FormError message={error} />
      <PrimaryButton label="CREAR CUENTA" onPress={handleRegister} loading={submitting} />
    </AuthFrame>
  );
}

const styles = StyleSheet.create({
  link: {
    color: systemColors.textMuted,
    fontSize: 14,
  },
  linkStrong: {
    color: systemColors.accent,
    fontWeight: "700",
  },
  hint: {
    color: systemColors.textFaint,
    fontSize: 11,
    lineHeight: 16,
  },
});
