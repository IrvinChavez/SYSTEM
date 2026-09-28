import { Link } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/avatar";
import { BiometricSettingsCard } from "@/components/biometric-settings";
import { Card, Icon, PrimaryButton, ProgressBar, Screen, ScreenHeader, SectionHeading, TextField } from "@/components/ui";
import { systemColors } from "@/constants/system-colors";
import { authErrorMessage, useAuth } from "@/context/auth-context";
import { usePlayer } from "@/context/player-context";
import { statInfo, statKeys } from "@/data/system-data";
import { confirmAction, notify, syncInBackground } from "@/lib/confirm";
import { PhotoPermissionError, pickProfilePhoto } from "@/lib/pick-photo";
import { useBiometrics } from "@/lib/use-biometrics";
import { readBiometricLogin } from "@/services/biometric-service";
import { updatePlayerName, updatePlayerPhoto } from "@/services/player-service";

export default function ProfileScreen() {
  const { logout, deleteAccount } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const biometrics = useBiometrics();

  // Las cuentas creadas con huella no conocen su contraseña: se puede confirmar con la huella.
  const fillPasswordWithBiometrics = async () => {
    setDeleteError(null);
    try {
      setDeletePassword((await readBiometricLogin("Confirma para eliminar tu cuenta")).password);
    } catch (reason) {
      setDeleteError(authErrorMessage(reason));
    }
  };

  const handleDeleteAccount = () => {
    if (!deletePassword) {
      setDeleteError("Escribe tu contraseña para confirmar.");
      return;
    }
    confirmAction("Eliminar cuenta", "Se borrarán tu cuenta, misiones, agenda, progreso y foto. Esto no se puede deshacer.", "Eliminar", async () => {
      setDeleteBusy(true);
      setDeleteError(null);
      try {
        // Aquí sí esperamos al servidor: borrar la cuenta requiere conexión y confirmación real.
        await deleteAccount(deletePassword);
      } catch (reason) {
        setDeleteError(authErrorMessage(reason));
        setDeleteBusy(false);
      }
    });
  };
  const { uid, profile, level, experience, experienceGoal, rank, streak, weeklyProgress } = usePlayer();
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(profile.name);
  const [photoBusy, setPhotoBusy] = useState(false);

  const changePhoto = async (source: "library" | "camera") => {
    setPhotoBusy(true);
    try {
      const photo = await pickProfilePhoto(source);
      if (photo) syncInBackground(updatePlayerPhoto(uid, photo), "No se pudo guardar la foto.");
    } catch (reason) {
      console.warn("No se pudo cambiar la foto", reason);
      notify("Foto de perfil", reason instanceof PhotoPermissionError ? reason.message : "No se pudo procesar la foto. Prueba con otra imagen.");
    } finally {
      setPhotoBusy(false);
    }
  };

  const removePhoto = () => {
    confirmAction("Quitar foto", "¿Volver a la foto predeterminada?", "Quitar", () => {
      syncInBackground(updatePlayerPhoto(uid, null), "No se pudo quitar la foto.");
    });
  };

  const maxStat = Math.max(10, ...statKeys.map((key) => profile.stats[key]));

  const saveName = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    syncInBackground(updatePlayerName(uid, trimmed), "No se pudo actualizar el nombre.");
    setEditingName(false);
  };

  return (
    <Screen>
      <ScreenHeader title="PERFIL" subtitle={profile.username ? `@${profile.username}` : undefined} />

      <Card style={styles.photoCard}>
        <Pressable accessibilityRole="button" accessibilityLabel="Cambiar foto de perfil" onPress={() => changePhoto("library")} disabled={photoBusy}>
          <Avatar photo={profile.photo} size={110} />
          <View style={styles.cameraBadge}>
            {photoBusy ? <ActivityIndicator size="small" color={systemColors.text} /> : <Icon name="camera" size={18} color={systemColors.text} />}
          </View>
        </Pressable>
        <Text style={styles.photoName} numberOfLines={1}>{profile.name}</Text>
        <View style={styles.photoButtons}>
          <PhotoButton icon="images-outline" label="Galería" onPress={() => changePhoto("library")} disabled={photoBusy} />
          {Platform.OS !== "web" ? <PhotoButton icon="camera-outline" label="Cámara" onPress={() => changePhoto("camera")} disabled={photoBusy} /> : null}
          {profile.photo ? <PhotoButton icon="trash-outline" label="Quitar" onPress={removePhoto} disabled={photoBusy} /> : null}
        </View>
      </Card>

      <Card style={styles.statusWindow}>
        <Text style={styles.windowTag}>[ ESTADO ]</Text>
        <View style={styles.statusRow}>
          <View style={styles.flex}>
            <Text style={styles.label}>NOMBRE</Text>
            <Text style={styles.name} numberOfLines={1}>{profile.name}</Text>
            <Text style={styles.label}>TÍTULO</Text>
            <Text style={styles.value}>{rank.title}</Text>
          </View>
          <View style={styles.rankBadge}>
            <Text style={styles.rankLetter}>{rank.rank}</Text>
            <Text style={styles.rankLabel}>RANGO</Text>
          </View>
        </View>
        <View style={styles.levelRow}>
          <Text style={styles.levelText}>NIVEL {level}</Text>
          <Text style={styles.expText}>{experience} / {experienceGoal} EXP</Text>
        </View>
        <ProgressBar progress={experience / experienceGoal} height={6} color={systemColors.accent} />
        <View style={styles.metrics}>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{profile.totalXp}</Text>
            <Text style={styles.metricLabel}>EXP TOTAL</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{streak}🔥</Text>
            <Text style={styles.metricLabel}>RACHA</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{Math.round(weeklyProgress * 100)}%</Text>
            <Text style={styles.metricLabel}>SEMANA</Text>
          </View>
        </View>
      </Card>

      <Card>
        <SectionHeading icon="◆" title="ESTADÍSTICAS" />
        <Text style={styles.helper}>Cada misión completada suma 1 punto a su estadística.</Text>
        <View style={styles.stats}>
          {statKeys.map((key) => (
            <View key={key} style={styles.stat}>
              <View style={styles.statHeader}>
                <Text style={styles.statName}>{statInfo[key].icon}  {key} · {statInfo[key].label}</Text>
                <Text style={styles.statValue}>{profile.stats[key]}</Text>
              </View>
              <ProgressBar progress={profile.stats[key] / maxStat} />
            </View>
          ))}
        </View>
      </Card>

      <Card>
        <SectionHeading icon="✎" title="CUENTA" />
        <View style={styles.account}>
          {editingName ? (
            <>
              <TextField label="NOMBRE DE JUGADOR" value={name} onChangeText={setName} maxLength={30} autoFocus onSubmitEditing={saveName} />
              <PrimaryButton label="GUARDAR" onPress={saveName} />
              <PrimaryButton label="CANCELAR" variant="outline" onPress={() => { setName(profile.name); setEditingName(false); }} />
            </>
          ) : (
            <PrimaryButton label="CAMBIAR NOMBRE DE JUGADOR" variant="outline" onPress={() => { setName(profile.name); setEditingName(true); }} />
          )}
          <PrimaryButton
            label="CERRAR SESIÓN"
            variant="danger"
            onPress={() => confirmAction("Cerrar sesión", "¿Quieres salir de tu cuenta?", "Salir", () => void logout())}
          />
        </View>
      </Card>

      <BiometricSettingsCard username={profile.username} />

      <Card style={styles.dangerCard}>
        <SectionHeading icon="⚠" title="ZONA DE PELIGRO" />
        <Text style={styles.helper}>Eliminar tu cuenta borra para siempre tu progreso, misiones, agenda y foto.</Text>
        <View style={styles.account}>
          {deleting ? (
            <>
              <TextField
                label="CONFIRMA CON TU CONTRASEÑA"
                value={deletePassword}
                onChangeText={setDeletePassword}
                secureTextEntry
                autoComplete="current-password"
              />
              {biometrics.support.available && biometrics.savedUsername === profile.username && !deletePassword ? (
                <PrimaryButton label={`CONFIRMAR CON ${biometrics.support.label.toUpperCase()}`} variant="outline" onPress={fillPasswordWithBiometrics} />
              ) : null}
              {deleteError ? <Text style={styles.deleteError}>{deleteError}</Text> : null}
              <PrimaryButton label="ELIMINAR MI CUENTA" variant="danger" onPress={handleDeleteAccount} loading={deleteBusy} />
              <PrimaryButton label="CANCELAR" variant="outline" onPress={() => { setDeleting(false); setDeletePassword(""); setDeleteError(null); }} disabled={deleteBusy} />
            </>
          ) : (
            <PrimaryButton label="ELIMINAR CUENTA" variant="danger" onPress={() => setDeleting(true)} />
          )}
        </View>
        <Link href="/privacidad" style={styles.privacyLink}>Política de privacidad</Link>
      </Card>
    </Screen>
  );
}

function PhotoButton({ icon, label, onPress, disabled }: { icon: "images-outline" | "camera-outline" | "trash-outline"; label: string; onPress: () => void; disabled: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.photoButton, (pressed || disabled) && styles.pressed]}
    >
      <Icon name={icon} size={18} color={icon === "trash-outline" ? systemColors.danger : systemColors.accent} />
      <Text style={styles.photoButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  photoCard: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 20,
  },
  cameraBadge: {
    position: "absolute",
    right: 2,
    bottom: 2,
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    borderWidth: 2,
    borderColor: systemColors.card,
    backgroundColor: systemColors.primary,
  },
  photoName: {
    color: systemColors.text,
    fontSize: 20,
    fontWeight: "700",
  },
  photoButtons: {
    flexDirection: "row",
    gap: 8,
  },
  photoButton: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: systemColors.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    backgroundColor: systemColors.cardAlt,
  },
  photoButtonText: {
    color: systemColors.text,
    fontSize: 12,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.6,
  },
  flex: {
    flex: 1,
  },
  statusWindow: {
    borderColor: systemColors.primary,
    gap: 10,
  },
  windowTag: {
    color: systemColors.accent,
    fontSize: 10,
    letterSpacing: 2,
    textAlign: "center",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  label: {
    color: systemColors.textFaint,
    fontSize: 9,
    letterSpacing: 1.2,
    marginTop: 6,
  },
  name: {
    color: systemColors.text,
    fontSize: 20,
    fontWeight: "700",
  },
  value: {
    color: systemColors.textMuted,
    fontSize: 13,
  },
  rankBadge: {
    width: 76,
    height: 76,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: systemColors.accent,
    borderRadius: 38,
    backgroundColor: systemColors.surfaceActive,
  },
  rankLetter: {
    color: systemColors.accent,
    fontSize: 32,
    fontWeight: "700",
    textShadowColor: systemColors.primary,
    textShadowRadius: 10,
  },
  rankLabel: {
    color: systemColors.textFaint,
    fontSize: 8,
    letterSpacing: 1.5,
  },
  levelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginTop: 6,
  },
  levelText: {
    color: systemColors.text,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 1,
  },
  expText: {
    color: systemColors.textMuted,
    fontSize: 11,
  },
  metrics: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },
  metric: {
    flex: 1,
    alignItems: "center",
    borderRadius: 10,
    paddingVertical: 10,
    backgroundColor: systemColors.backgroundRaised,
  },
  metricValue: {
    color: systemColors.text,
    fontSize: 17,
    fontWeight: "700",
  },
  metricLabel: {
    color: systemColors.textFaint,
    fontSize: 8,
    letterSpacing: 1.2,
    marginTop: 3,
  },
  helper: {
    color: systemColors.textMuted,
    fontSize: 11,
    marginTop: 6,
  },
  stats: {
    gap: 12,
    marginTop: 12,
  },
  stat: {
    gap: 6,
  },
  statHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statName: {
    color: systemColors.textMuted,
    fontSize: 12,
  },
  statValue: {
    color: systemColors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  dangerCard: {
    borderColor: systemColors.danger,
  },
  deleteError: {
    color: systemColors.danger,
    fontSize: 12,
  },
  privacyLink: {
    color: systemColors.accent,
    fontSize: 13,
    textAlign: "center",
    marginTop: 14,
  },
  account: {
    gap: 10,
    marginTop: 12,
  },
});
