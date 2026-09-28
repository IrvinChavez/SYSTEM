import { Link } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AuthFrame, FormError } from "@/components/auth-form";
import { Chip, PrimaryButton, TextField } from "@/components/ui";
import { systemColors } from "@/constants/system-colors";
import { authErrorMessage, useAuth } from "@/context/auth-context";
import { useBiometrics } from "@/lib/use-biometrics";
import { signupOpen } from "@/lib/username";

export default function LoginScreen() {
  const { loginWithPassword, loginWithBiometrics } = useAuth();
  const { support, savedUsername } = useBiometrics();
  const [enableBiometrics, setEnableBiometrics] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      setError("Escribe tu nombre de usuario y contraseña.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      // Se ofrece activar la huella si el teléfono la tiene y aún no está activa para este usuario.
      const offerBiometrics = support.available && enableBiometrics && savedUsername !== username.trim().toLowerCase();
      await loginWithPassword(username, password, offerBiometrics);
      // El guard de _layout.tsx redirige a las pestañas cuando cambia el usuario.
    } catch (reason) {
      setError(authErrorMessage(reason));
      setSubmitting(false);
    }
  };

  const handleBiometricLogin = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await loginWithBiometrics();
    } catch (reason) {
      setError(authErrorMessage(reason));
      setSubmitting(false);
    }
  };

  const showBiometricLogin = support.available && !!savedUsername;

  return (
    <AuthFrame
      title="Has sido elegido como Jugador"
      subtitle="Ingresa para continuar con tus misiones diarias."
      footer={signupOpen ? (
        <Link href="/register" replace style={styles.link}>
          ¿Aún no despiertas? <Text style={styles.linkStrong}>Crear cuenta</Text>
        </Link>
      ) : null}
    >
      {showBiometricLogin ? (
        <>
          <PrimaryButton label={`ENTRAR CON ${support.label.toUpperCase()} · @${savedUsername}`} onPress={handleBiometricLogin} loading={submitting} />
          <View style={styles.divider}>
            <View style={styles.line} />
            <Text style={styles.dividerText}>o con contraseña</Text>
            <View style={styles.line} />
          </View>
        </>
      ) : null}
      <TextField
        label="NOMBRE DE USUARIO"
        value={username}
        onChangeText={setUsername}
        placeholder="jinwoo"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        textContentType="username"
      />
      <TextField
        label="CONTRASEÑA"
        value={password}
        onChangeText={setPassword}
        placeholder="••••••••"
        secureTextEntry
        autoComplete="password"
        textContentType="password"
        onSubmitEditing={handleLogin}
      />
      {support.available && !showBiometricLogin ? (
        <View style={styles.option}>
          <Chip label={`${enableBiometrics ? "✓ " : ""}Activar ingreso con ${support.label}`} selected={enableBiometrics} onPress={() => setEnableBiometrics(!enableBiometrics)} />
        </View>
      ) : null}
      <FormError message={error} />
      <PrimaryButton label="INGRESAR" variant={showBiometricLogin ? "outline" : "primary"} onPress={handleLogin} loading={submitting} />
    </AuthFrame>
  );
}

const styles = StyleSheet.create({
  link: {
    color: systemColors.textMuted,
    fontSize: 14,
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
  linkStrong: {
    color: systemColors.accent,
    fontWeight: "700",
  },
});
