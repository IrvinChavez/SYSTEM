import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { ActionPill, Card, Chip, Icon, PrimaryButton, Screen, TextField } from "@/components/ui";
import { systemColors } from "@/constants/system-colors";
import { useDiscovery } from "@/context/discovery-context";
import { useOrganizer } from "@/context/organizer-context";
import { confirmAction } from "@/lib/confirm";
import { careOptions, deleteDiscovery, DiscoveryAnswers, DiscoveryProfile, emptyDiscovery, frictionOptions, lifeAreaOptions, saveDiscovery } from "@/services/discovery-service";

const focusOptions = [
  { value: "morning", label: "Mañana" },
  { value: "midday", label: "Mediodía" },
  { value: "afternoon", label: "Tarde" },
  { value: "evening", label: "Noche" },
  { value: "varies", label: "Varía" },
] as const;

const supportOptions = [
  { value: "gentle", label: "Con calma y ánimo" },
  { value: "direct", label: "Directo y breve" },
  { value: "structured", label: "Con pasos claros" },
] as const;

const stepTitles = [
  "¿Qué áreas ocupan más tu atención?",
  "¿Cómo se ve una semana normal?",
  "¿Qué te gustaría conseguir?",
  "¿Cuándo te resulta más fácil concentrarte?",
  "¿Qué quieres proteger en tu rutina?",
  "¿Cómo te gustaría que te acompañe?",
];

const stepDescriptions = [
  "Elige todas las que apliquen. No hay respuestas correctas.",
  "Cuéntame lo que quieras sobre horarios fijos y hábitos actuales. Puedes dejar cualquier campo vacío.",
  "Una meta cercana y una idea a futuro ayudan a planificar sin perder de vista lo importante.",
  "También puedes indicar qué suele hacer difícil avanzar. Esto sirve para ajustar el tamaño y el orden de los pasos.",
  "Planificar también significa dejar espacio para descanso, vínculos y cuidado personal.",
  "Puedes cambiar estas preferencias después. El cuestionario no es una evaluación.",
];

function ToggleChoice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Chip label={`${selected ? "✓ " : ""}${label}`} selected={selected} onPress={onPress} />;
}

function toggleValue(values: string[], selected: string) {
  return values.includes(selected) ? values.filter((value) => value !== selected) : [...values, selected];
}

export default function OnboardingScreen() {
  const { uid } = useOrganizer();
  const { discovery, loading, error: discoveryError } = useDiscovery();
  if (loading) {
    return (
      <Screen>
        <View style={styles.loading}>
          <ActivityIndicator color={systemColors.accent} />
          <Text style={styles.body}>Cargando tus respuestas…</Text>
        </View>
      </Screen>
    );
  }
  if (discoveryError) {
    return (
      <Screen>
        <Card><Text style={styles.error}>{discoveryError} Revisa tu conexión y vuelve a intentarlo.</Text></Card>
      </Screen>
    );
  }
  return <Questionnaire key={uid} uid={uid} discovery={discovery} />;
}

function Questionnaire({ uid, discovery }: { uid: string; discovery: DiscoveryProfile | null }) {
  const router = useRouter();
  const [answers, setAnswers] = useState<DiscoveryAnswers>(() => {
    if (!discovery) return emptyDiscovery;
    const { updatedAt: _updatedAt, ...savedAnswers } = discovery;
    return { ...emptyDiscovery, ...savedAnswers };
  });
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finish = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveDiscovery(uid, { ...answers, completed: true });
      router.replace("/");
    } catch (reason) {
      console.warn("No se pudo guardar el cuestionario personal", reason);
      setError("No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  const next = async () => {
    if (step === stepTitles.length - 1) {
      void finish();
      return;
    }
    if (discovery?.completed) {
      setStep((current) => current + 1);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveDiscovery(uid, { ...answers, completed: false });
      setStep((current) => current + 1);
    } catch (reason) {
      console.warn("No se pudo guardar el avance del cuestionario", reason);
      setError("No se pudo guardar tu avance. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  const skip = () => router.replace("/");
  const clearAnswers = () => confirmAction(
    "Borrar respuestas",
    "Se eliminarán de tu cuenta las respuestas del cuestionario. Esta acción no se puede deshacer.",
    "Borrar",
    async () => {
      setSaving(true);
      setError(null);
      try {
        await deleteDiscovery(uid);
        setAnswers(emptyDiscovery);
        router.replace("/");
      } catch (reason) {
        console.warn("No se pudieron borrar las respuestas del cuestionario", reason);
        setError("No se pudieron borrar tus respuestas. Inténtalo de nuevo.");
      } finally {
        setSaving(false);
      }
    },
  );

  return (
    <Screen>
      <View style={styles.top}>
        <View style={styles.brandLine}>
          <View style={styles.brandIcon}><Icon name="sparkles-outline" size={18} color={systemColors.accent} /></View>
          <Text style={styles.brand}>CONOCERTE MEJOR</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={skip} hitSlop={10}>
          <Text style={styles.skip}>Hacerlo después</Text>
        </Pressable>
      </View>
      <View style={styles.progressHeader}>
        <Text style={styles.stepCount}>PREGUNTA {step + 1} DE {stepTitles.length}</Text>
        <Text style={styles.stepCount}>{Math.round(((step + 1) / stepTitles.length) * 100)}%</Text>
      </View>
      <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${((step + 1) / stepTitles.length) * 100}%` }]} /></View>

      <Card style={styles.questionCard}>
        <Text style={styles.eyebrow}>TU RITMO, TUS PRIORIDADES</Text>
        <Text style={styles.title}>{stepTitles[step]}</Text>
        <Text style={styles.description}>{stepDescriptions[step]}</Text>

        {step === 0 ? (
          <View style={styles.choices}>
            {lifeAreaOptions.map((option) => (
              <ToggleChoice key={option.value} label={option.label} selected={answers.lifeAreas.includes(option.value)} onPress={() => setAnswers((current) => ({ ...current, lifeAreas: toggleValue(current.lifeAreas, option.value) }))} />
            ))}
          </View>
        ) : null}

        {step === 1 ? (
          <View style={styles.fields}>
            <TextField
              label="HORARIOS O COMPROMISOS FIJOS"
              value={answers.fixedCommitments}
              onChangeText={(fixedCommitments) => setAnswers((current) => ({ ...current, fixedCommitments }))}
              placeholder="Ej. clases por la mañana, trabajo de lunes a viernes…"
              multiline
              maxLength={600}
            />
            <TextField
              label="RUTINA O HÁBITOS QUE YA TIENES"
              value={answers.currentRoutine}
              onChangeText={(currentRoutine) => setAnswers((current) => ({ ...current, currentRoutine }))}
              placeholder="¿Qué haces normalmente al iniciar o terminar el día?"
              multiline
              maxLength={600}
            />
          </View>
        ) : null}

        {step === 2 ? (
          <View style={styles.fields}>
            <TextField
              label="EN LOS PRÓXIMOS MESES"
              value={answers.nearTermGoal}
              onChangeText={(nearTermGoal) => setAnswers((current) => ({ ...current, nearTermGoal }))}
              placeholder="¿Qué te gustaría avanzar primero?"
              multiline
              maxLength={500}
            />
            <TextField
              label="MÁS A FUTURO"
              value={answers.futureGoal}
              onChangeText={(futureGoal) => setAnswers((current) => ({ ...current, futureGoal }))}
              placeholder="¿Qué proyecto o propósito te ilusiona?"
              multiline
              maxLength={500}
            />
          </View>
        ) : null}

        {step === 3 ? (
          <View style={styles.fields}>
            <Text style={styles.groupLabel}>MI MEJOR MOMENTO PARA CONCENTRARME</Text>
            <View style={styles.choices}>
              {focusOptions.map((option) => (
                <ToggleChoice key={option.value} label={option.label} selected={answers.focusWindow === option.value} onPress={() => setAnswers((current) => ({ ...current, focusWindow: option.value }))} />
              ))}
            </View>
            <Text style={styles.groupLabel}>LO QUE SUELE DIFICULTARME AVANZAR</Text>
            <View style={styles.choices}>
              {frictionOptions.map((option) => (
                <ToggleChoice key={option.value} label={option.label} selected={answers.frictionPoints.includes(option.value)} onPress={() => setAnswers((current) => ({ ...current, frictionPoints: toggleValue(current.frictionPoints, option.value) }))} />
              ))}
            </View>
          </View>
        ) : null}

        {step === 4 ? (
          <View style={styles.fields}>
            <Text style={styles.groupLabel}>QUIERO DEJAR ESPACIO PARA…</Text>
            <View style={styles.choices}>
              {careOptions.map((option) => (
                <ToggleChoice key={option.value} label={option.label} selected={answers.carePriorities.includes(option.value)} onPress={() => setAnswers((current) => ({ ...current, carePriorities: toggleValue(current.carePriorities, option.value) }))} />
              ))}
            </View>
            <View style={styles.careNote}>
              <Icon name="heart-outline" size={17} color={systemColors.success} />
              <Text style={styles.careNoteText}>Tus planes deben caber en tu vida; el descanso y los límites también cuentan.</Text>
            </View>
          </View>
        ) : null}

        {step === 5 ? (
          <View style={styles.fields}>
            <Text style={styles.groupLabel}>PREFIERO QUE EL ASISTENTE SEA…</Text>
            <View style={styles.choices}>
              {supportOptions.map((option) => (
                <ToggleChoice key={option.value} label={option.label} selected={answers.supportStyle === option.value} onPress={() => setAnswers((current) => ({ ...current, supportStyle: option.value }))} />
              ))}
            </View>
            <View style={styles.consentBox}>
              <Text style={styles.consentTitle}>Personalización con IA (opcional)</Text>
              <Text style={styles.consentText}>
                Si lo autorizas, al usar el asistente enviaremos tus respuestas del cuestionario a nuestro proveedor de IA para adaptar sus sugerencias. Puedes dejarlo apagado y cambiar esta opción después en Perfil.
              </Text>
              <ToggleChoice
                label="Permitir usar mis respuestas para personalizar el asistente"
                selected={answers.aiPersonalizationConsent}
                onPress={() => setAnswers((current) => ({ ...current, aiPersonalizationConsent: !current.aiPersonalizationConsent }))}
              />
            </View>
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.actions}>
          {step > 0 ? <PrimaryButton label="ATRÁS" variant="outline" onPress={() => setStep((current) => current - 1)} disabled={saving} /> : null}
          <View style={styles.flex}>
            <PrimaryButton label={step === stepTitles.length - 1 ? "GUARDAR Y CONTINUAR" : "CONTINUAR"} onPress={next} loading={saving} />
          </View>
        </View>
        {discovery ? (
          <Pressable accessibilityRole="button" disabled={saving} onPress={clearAnswers} style={styles.clearButton}>
            <Text style={styles.clearText}>Borrar mis respuestas</Text>
          </Pressable>
        ) : null}
      </Card>
      <View style={styles.footer}>
        <Icon name="lock-closed-outline" size={14} color={systemColors.textFaint} />
        <Text style={styles.footerText}>Tus respuestas son privadas y puedes editarlas o borrarlas desde tu cuenta.</Text>
      </View>
      <ActionPill icon="arrow-back" label="Volver a Inicio" onPress={skip} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { minHeight: 220, alignItems: "center", justifyContent: "center", gap: 12 },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 16 },
  brandLine: { flexDirection: "row", alignItems: "center", gap: 9 },
  brandIcon: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: systemColors.cardAlt },
  brand: { color: systemColors.textMuted, fontSize: 10, fontWeight: "700", letterSpacing: 1.4 },
  skip: { color: systemColors.textMuted, fontSize: 12, padding: 8 },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 7 },
  stepCount: { color: systemColors.textFaint, fontSize: 10, fontWeight: "700", letterSpacing: 0.8 },
  progressTrack: { height: 4, overflow: "hidden", borderRadius: 2, backgroundColor: systemColors.borderMuted, marginBottom: 18 },
  progressFill: { height: "100%", borderRadius: 2, backgroundColor: systemColors.accent },
  questionCard: { gap: 12, padding: 18 },
  eyebrow: { color: systemColors.accent, fontSize: 9, fontWeight: "700", letterSpacing: 1.1 },
  title: { color: systemColors.text, fontSize: 23, fontWeight: "600", lineHeight: 30 },
  description: { color: systemColors.textMuted, fontSize: 13, lineHeight: 19, marginBottom: 4 },
  fields: { gap: 14 },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  groupLabel: { color: systemColors.textMuted, fontSize: 10, fontWeight: "700", letterSpacing: 0.7 },
  careNote: { flexDirection: "row", alignItems: "flex-start", gap: 9, borderRadius: 9, backgroundColor: systemColors.backgroundRaised, padding: 11 },
  careNoteText: { flex: 1, color: systemColors.textMuted, fontSize: 12, lineHeight: 17 },
  consentBox: { gap: 10, borderWidth: 1, borderColor: systemColors.border, borderRadius: 10, backgroundColor: systemColors.backgroundRaised, padding: 12 },
  consentTitle: { color: systemColors.text, fontSize: 13, fontWeight: "600" },
  consentText: { color: systemColors.textMuted, fontSize: 11, lineHeight: 16 },
  error: { color: systemColors.danger, fontSize: 12, lineHeight: 17 },
  actions: { flexDirection: "row", alignItems: "center", gap: 9, marginTop: 6 },
  clearButton: { alignSelf: "flex-start", paddingVertical: 8 },
  clearText: { color: systemColors.danger, fontSize: 11 },
  flex: { flex: 1 },
  footer: { flexDirection: "row", alignItems: "center", gap: 7, marginVertical: 13 },
  footerText: { flex: 1, color: systemColors.textFaint, fontSize: 10, lineHeight: 15 },
  body: { color: systemColors.textMuted, fontSize: 13 },
});
