import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { FormSheet } from "@/components/form-sheet";
import { Card, PrimaryButton, SectionHeading, TextField } from "@/components/ui";
import { systemColors } from "@/constants/system-colors";
import { usePlayer } from "@/context/player-context";
import { confirmAction } from "@/lib/confirm";
import { CALENDAR_DAYS } from "@/services/calendar-service";

const steps = [
  "Notion Calendar guarda tus eventos en tu cuenta de Google Calendar. Abre Google Calendar en la web (botón de abajo).",
  "Ve a Configuración (⚙) → en \"Configuración de mis calendarios\" elige el calendario que usas en Notion Calendar.",
  "Baja hasta \"Integrar el calendario\" y copia la \"Dirección secreta en formato iCal\".",
  "Pégala aquí. Es privada: no la compartas con nadie.",
];

const timeLabel = (date: Date) => `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;

// Estado de la conexión con Notion Calendar y el formulario para conectarlo.
export function CalendarConnectCard() {
  const { calendar } = usePlayer();
  const [formVisible, setFormVisible] = useState(false);
  const [url, setUrl] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const handleConnect = async () => {
    setFormError(null);
    const error = await calendar.connect(url);
    if (error) {
      setFormError(error);
      return;
    }
    setUrl("");
    setFormVisible(false);
  };

  const handleDisconnect = () => {
    confirmAction(
      "Desconectar calendario",
      "Se quitarán de la agenda los eventos importados de hoy en adelante. Tu calendario de Notion no se modifica.",
      "Desconectar",
      () => void calendar.disconnect(),
    );
  };

  const status = calendar.syncing
    ? "Sincronizando…"
    : calendar.lastSync
      ? `${calendar.lastCount} ${calendar.lastCount === 1 ? "evento" : "eventos"} de los próximos ${CALENDAR_DAYS} días · ${timeLabel(calendar.lastSync)}`
      : "Conectado. Se sincroniza al abrir la app y cada 15 min.";

  return (
    <Card style={calendar.connected ? styles.connected : undefined}>
      <SectionHeading icon="⟲" title="NOTION CALENDAR" trailing={calendar.connected ? "● ACTIVO" : undefined} />
      {calendar.connected ? (
        <>
          <Text style={styles.text}>{status}</Text>
          {calendar.error ? <Text style={styles.error}>{calendar.error}</Text> : null}
          <View style={styles.row}>
            <View style={styles.flex}>
              <PrimaryButton label="SINCRONIZAR" onPress={() => void calendar.sync()} loading={calendar.syncing} />
            </View>
            <View style={styles.flex}>
              <PrimaryButton label="DESCONECTAR" variant="danger" onPress={handleDisconnect} disabled={calendar.syncing} />
            </View>
          </View>
        </>
      ) : (
        <>
          <Text style={styles.text}>
            Importa tus clases y eventos de Notion Calendar: aparecerán aquí con su duración y cronómetro, y la IA acomodará tus misiones alrededor.
          </Text>
          <PrimaryButton label="CONECTAR" variant="outline" onPress={() => { setFormError(null); setFormVisible(true); }} />
        </>
      )}

      <FormSheet visible={formVisible} title="CONECTAR NOTION CALENDAR" onClose={() => setFormVisible(false)}>
        {steps.map((step, index) => (
          <View key={step} style={styles.step}>
            <Text style={styles.stepNumber}>{index + 1}</Text>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
        <PrimaryButton
          label="ABRIR GOOGLE CALENDAR"
          variant="outline"
          onPress={() => void WebBrowser.openBrowserAsync("https://calendar.google.com/calendar/r/settings")}
        />
        <TextField
          label="DIRECCIÓN SECRETA EN FORMATO ICAL"
          value={url}
          onChangeText={setUrl}
          placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        <Text style={styles.hint}>También funciona con enlaces de iCloud y Outlook. Los eventos de todo el día no se importan.</Text>
        {formError ? <Text style={styles.error}>{formError}</Text> : null}
        <PrimaryButton label="CONECTAR Y SINCRONIZAR" onPress={handleConnect} loading={calendar.syncing} disabled={!url.trim()} />
      </FormSheet>
    </Card>
  );
}

const styles = StyleSheet.create({
  connected: {
    borderColor: systemColors.primary,
  },
  text: {
    color: systemColors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    gap: 8,
  },
  flex: {
    flex: 1,
  },
  error: {
    color: systemColors.danger,
    fontSize: 12,
    marginBottom: 8,
  },
  step: {
    flexDirection: "row",
    gap: 10,
  },
  stepNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    overflow: "hidden",
    textAlign: "center",
    lineHeight: 22,
    color: systemColors.text,
    backgroundColor: systemColors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  stepText: {
    flex: 1,
    color: systemColors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  hint: {
    color: systemColors.textFaint,
    fontSize: 11,
  },
});
