import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { FieldGroup, FormSheet } from "@/components/form-sheet";
import { ActionPill, Card, Chip, EmptyState, IconButton, PrimaryButton, Screen, ScreenHeader, TextField } from "@/components/ui";
import { systemColors } from "@/constants/system-colors";
import { useOrganizer } from "@/context/organizer-context";
import { GoalHorizon, PersonalGoal } from "@/data/system-data";
import { confirmAction, syncInBackground } from "@/lib/confirm";
import { addGoal, deleteGoal, updateGoal } from "@/services/organizer-service";
import { isValidDateKey } from "@/lib/dates";

type GoalDraft = Omit<PersonalGoal, "id">;
const blankGoal: GoalDraft = { title: "", measure: "", nextStep: "", horizon: "short", targetDate: null, status: "active" };
const horizonLabels: Record<GoalHorizon, string> = { short: "Corto plazo", medium: "Mediano plazo", long: "Largo plazo" };

function validDate(value: string) {
  return !value || isValidDateKey(value);
}

export default function GoalsScreen() {
  const { uid, goals, loading, error } = useOrganizer();
  const [visible, setVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<GoalDraft>(blankGoal);
  const [targetDate, setTargetDate] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const openNew = () => { setEditingId(null); setDraft(blankGoal); setTargetDate(""); setFormError(null); setVisible(true); };
  const openEdit = (goal: PersonalGoal) => {
    const { id, ...value } = goal;
    setEditingId(id); setDraft(value); setTargetDate(value.targetDate ?? ""); setFormError(null); setVisible(true);
  };
  const save = () => {
    const title = draft.title.trim();
    if (!title) return setFormError("Escribe un nombre para la meta.");
    if (!validDate(targetDate)) return setFormError("Usa una fecha válida con formato AAAA-MM-DD.");
    const value = { ...draft, title, measure: draft.measure.trim(), nextStep: draft.nextStep.trim(), targetDate: targetDate || null };
    syncInBackground(editingId ? updateGoal(uid, editingId, value) : addGoal(uid, value), "No se pudo guardar la meta.");
    setVisible(false);
  };
  const remove = (goal: PersonalGoal) => confirmAction("Eliminar meta", `¿Eliminar "${goal.title}"?`, "Eliminar", () => {
    syncInBackground(deleteGoal(uid, goal.id), "No se pudo eliminar la meta.");
  });
  return (
    <Screen>
      <ScreenHeader title="Metas" subtitle="Convierte una intención en un resultado medible." action={<ActionPill icon="add" label="Nueva" onPress={openNew} />} />
      {error ? <Text style={styles.notice}>{error}</Text> : null}
      {loading ? <Text style={styles.notice}>Sincronizando tus metas…</Text> : null}
      {goals.length === 0 ? (
        <Card><EmptyState icon="flag-outline" title="Sin metas por ahora" text="Elige una meta que realmente quieras y define cómo reconocerás el avance. No necesitas llenar todos los plazos." /></Card>
      ) : goals.map((goal) => (
        <Card key={goal.id} style={styles.goalCard}>
          <View style={styles.header}>
            <View style={styles.copy}>
              <Text style={styles.title}>{goal.title}</Text>
              <Text style={styles.horizon}>{horizonLabels[goal.horizon]}{goal.targetDate ? ` · ${goal.targetDate}` : ""}</Text>
            </View>
            <View style={styles.actions}>
              <IconButton icon="create-outline" label={`Editar ${goal.title}`} onPress={() => openEdit(goal)} />
              <IconButton icon="trash-outline" label={`Eliminar ${goal.title}`} onPress={() => remove(goal)} color={systemColors.danger} />
            </View>
          </View>
          {goal.measure ? <Text style={styles.detail}><Text style={styles.label}>CÓMO MEDIRLA  </Text>{goal.measure}</Text> : null}
          {goal.nextStep ? <Text style={styles.detail}><Text style={styles.label}>SIGUIENTE PASO  </Text>{goal.nextStep}</Text> : null}
          <Text style={styles.status}>{goal.status === "completed" ? "Completada" : goal.status === "paused" ? "En pausa" : "Activa"}</Text>
        </Card>
      ))}
      <FormSheet visible={visible} title={editingId ? "Editar meta" : "Nueva meta"} onClose={() => setVisible(false)}>
        <TextField label="META" value={draft.title} onChangeText={(title) => setDraft({ ...draft, title })} placeholder="¿Qué quieres conseguir?" maxLength={120} />
        <TextField label="INDICADOR DE AVANCE" value={draft.measure} onChangeText={(measure) => setDraft({ ...draft, measure })} placeholder="¿Cómo sabrás que avanzaste?" maxLength={300} />
        <TextField label="SIGUIENTE PASO" value={draft.nextStep} onChangeText={(nextStep) => setDraft({ ...draft, nextStep })} placeholder="La próxima acción concreta" maxLength={300} />
        <FieldGroup label="HORIZONTE">
          {(["short", "medium", "long"] as const).map((horizon) => <Chip key={horizon} label={horizonLabels[horizon]} selected={draft.horizon === horizon} onPress={() => setDraft({ ...draft, horizon })} />)}
        </FieldGroup>
        <FieldGroup label="ESTADO">
          {(["active", "paused", "completed"] as const).map((status) => <Chip key={status} label={status === "active" ? "Activa" : status === "paused" ? "En pausa" : "Completada"} selected={draft.status === status} onPress={() => setDraft({ ...draft, status })} />)}
        </FieldGroup>
        <TextField label="FECHA OBJETIVO OPCIONAL · AAAA-MM-DD" value={targetDate} onChangeText={setTargetDate} placeholder="Sin fecha definida" maxLength={10} />
        {formError ? <Text style={styles.error}>{formError}</Text> : null}
        <PrimaryButton label={editingId ? "GUARDAR CAMBIOS" : "CREAR META"} onPress={save} />
      </FormSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  notice: { color: systemColors.textMuted, fontSize: 13 },
  goalCard: { gap: 12 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  copy: { flex: 1, gap: 4 },
  title: { color: systemColors.text, fontSize: 17, fontWeight: "600" },
  horizon: { color: systemColors.accent, fontSize: 12 },
  actions: { flexDirection: "row" },
  detail: { color: systemColors.textMuted, fontSize: 13, lineHeight: 19 },
  label: { color: systemColors.textFaint, fontSize: 10, letterSpacing: 0.6 },
  status: { color: systemColors.textMuted, fontSize: 12 },
  error: { color: systemColors.danger, fontSize: 13 },
});
