import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Card, PrimaryButton, SectionHeading, TextField } from "@/components/ui";
import { systemColors } from "@/constants/system-colors";
import { authErrorMessage, useAuth } from "@/context/auth-context";
import { confirmAction, notify } from "@/lib/confirm";
import { useBiometrics } from "@/lib/use-biometrics";
import { clearBiometricLogin, readBiometricLogin } from "@/services/biometric-service";

// Ingreso con huella desde Perfil: activarlo, desactivarlo y ver la contraseña guardada para respaldarla
// (las cuentas creadas con huella tienen una contraseña generada que el jugador no conoce).
export function BiometricSettingsCard({ username }: { username: string }) {
  const { enableBiometrics } = useAuth();
  const { support, savedUsername, refresh } = useBiometrics();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!support.available) return null;
  const active = savedUsername === username;

  const handleEnable = async () => {
    if (!password) {
      setError("Escribe tu contraseña actual.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await enableBiometrics(password);
      setPassword("");
      refresh();
    } catch (reason) {
      setError(authErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  const showPassword = async () => {
    setError(null);
    try {
      const credentials = await readBiometricLogin("Confirma para ver tu contraseña");
      notify("Tu contraseña", `Usuario: ${credentials.username}\nContraseña: ${credentials.password}\n\nGuárdala en un lugar seguro: la necesitas si cambias de teléfono o desactivas la ${support.label}.`);
    } catch (reason) {
      setError(authErrorMessage(reason));
      refresh();
    }
  };

  const handleDisable = () => {
    confirmAction(
      `Desactivar ${support.label}`,
      "Después tendrás que entrar con tu contraseña. Si te registraste con huella, primero usa \"Ver mi contraseña\" y guárdala, o no podrás volver a entrar.",
      "Desactivar",
      async () => {
        await clearBiometricLogin();
        refresh();
      },
    );
  };

  return (
    <Card>
      <SectionHeading icon="◉" title="SEGURIDAD" trailing={active ? "● ACTIVO" : undefined} />
      <Text style={styles.helper}>
        {active
          ? `Entras con tu ${support.label} en este teléfono. Tu contraseña está guardada cifrada y solo se desbloquea con ella.`
          : `Entra sin escribir tu contraseña usando tu ${support.label}.`}
      </Text>
      <View style={styles.actions}>
        {active ? (
          <>
            <PrimaryButton label="VER MI CONTRASEÑA" variant="outline" onPress={showPassword} />
            <PrimaryButton label={`DESACTIVAR ${support.label.toUpperCase()}`} variant="danger" onPress={handleDisable} />
          </>
        ) : (
          <>
            <TextField label="CONTRASEÑA ACTUAL" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" onSubmitEditing={handleEnable} />
            <PrimaryButton label={`ACTIVAR ${support.label.toUpperCase()}`} onPress={handleEnable} loading={busy} />
          </>
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  helper: {
    color: systemColors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
  actions: {
    gap: 8,
    marginTop: 12,
  },
  error: {
    color: systemColors.danger,
    fontSize: 12,
  },
});
