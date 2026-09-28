import { Link } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AuthFrame, FormError } from "@/components/auth-form";
import { Chip, PrimaryButton, TextField } from "@/components/ui";
import { systemColors } from "@/constants/system-colors";
import { authErrorMessage, useAuth } from "@/context/auth-context";
import { useBiometrics } from "@/lib/use-biometrics";
import { isValidUsername, normalizeUsername, signupOpen } from "@/lib/username";

export default function RegisterScreen() {
  const { registerWithPassword, registerWithBiometrics } = useAuth();
  const { support } = useBiometrics();
  const [enableBiometrics, setEnableBiometrics] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const validUsername = () => {
    const normalized = normalizeUsername(username);
    if (isValidUsername(normalized)) return normalized;
    setError("El usuario debe tener de 3 a 20 caracteres: letras, números, punto o guion bajo (sin espacios).");
    return null;
  };

  const handleBiometricRegister = async () => {
    const normalized = validUsername();
    if (!normalized) return;
    setSubmitting(true);
    setError(null);
    try {
      await registerWithBiometrics(normalized);
    } catch (reason) {
      setError(authErrorMessage(reason));
      setSubmitting(false);
    }
  };

  const handleRegister = async () => {
    const normalized = validUsername();
    if (!normalized) return;
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
      await registerWithPassword(normalized, password, support.available && enableBiometrics);
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
      {support.available ? (
        <>
          <PrimaryButton label={`REGISTRARME CON ${support.label.toUpperCase()}`} onPress={handleBiometricRegister} loading={submitting} />
          <Text style={styles.hint}>
            Sin contraseña que recordar: la app crea una contraseña segura y la guarda cifrada con tu {support.label} en este teléfono. Podrás verla en Perfil para respaldarla.
          </Text>
          <View style={styles.divider}>
            <View style={styles.line} />
            <Text style={styles.dividerText}>o con contraseña</Text>
            <View style={styles.line} />
          </View>
        </>
      ) : null}
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
      {support.available ? (
        <View style={styles.option}>
          <Chip label={`${enableBiometrics ? "✓ " : ""}Activar ingreso con ${support.label}`} selected={enableBiometrics} onPress={() => setEnableBiometrics(!enableBiometrics)} />
        </View>
      ) : null}
      <FormError message={error} />
      <PrimaryButton label="CREAR CUENTA" variant={support.available ? "outline" : "primary"} onPress={handleRegister} loading={submitting} />
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
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: systemColors.border,
  },
  dividerText: {
    color: systemColors.textFaint,
    fontSize: 11,
  },
  option: {
    flexDirection: "row",
  },
  hint: {
    color: systemColors.textFaint,
    fontSize: 11,
    lineHeight: 16,
  },
});
