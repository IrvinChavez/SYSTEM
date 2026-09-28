import { Link } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text } from "react-native";
import { AuthFrame, FormError } from "@/components/auth-form";
import { PrimaryButton, TextField } from "@/components/ui";
import { systemColors } from "@/constants/system-colors";
import { authErrorMessage, useAuth } from "@/context/auth-context";
import { signupOpen } from "@/lib/username";

export default function LoginScreen() {
  const { login } = useAuth();
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
      await login(username, password);
      // El guard de _layout.tsx redirige a las pestañas cuando cambia el usuario.
    } catch (reason) {
      setError(authErrorMessage(reason));
      setSubmitting(false);
    }
  };

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
      <FormError message={error} />
      <PrimaryButton label="INGRESAR" onPress={handleLogin} loading={submitting} />
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
});
