import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { FormSheet } from "@/components/form-sheet";
import { MissionRow } from "@/components/mission-row";
import { ActionPill, Card, EmptyState, IconButton, PrimaryButton, ProgressBar, Screen, ScreenHeader, SectionHeading, TextField } from "@/components/ui";
import { systemColors } from "@/constants/system-colors";
import { DailyMission, usePlayer } from "@/context/player-context";
import { Mission, missionIcons } from "@/data/system-data";
import { confirmAction, syncInBackground } from "@/lib/confirm";
import { isValidTime } from "@/lib/dates";
import { addMission, deleteMission, updateMission } from "@/services/player-service";

type MissionDraft = Omit<Mission, "id">;

const emptyDraft: MissionDraft = { title: "", time: "08:00", icon: missionIcons[0], xp: 20, stat: "INT" };

export default function MissionsScreen() {
  const { uid, missions, completedCount } = usePlayer();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [draft, setDraft] = useState<MissionDraft>(emptyDraft);
  const [error, setError] = useState<string | null>(null);

  const openNew = () => {
    setEditingId(null);
    setDraft(emptyDraft);
    setError(null);
    setFormVisible(true);
  };

  // Los accesos rápidos de Inicio navegan con ?nuevo=<marca de tiempo> para abrir el formulario directamente.
  const { nuevo } = useLocalSearchParams<{ nuevo?: string }>();
  const [handledNuevo, setHandledNuevo] = useState<string | undefined>();
  if (nuevo && nuevo !== handledNuevo) {
    setHandledNuevo(nuevo);
    openNew();
  }

  const openEdit = (mission: DailyMission) => {
    setEditingId(mission.id);
    setDraft({ title: mission.title, time: mission.time, icon: mission.icon, xp: mission.xp, stat: mission.stat });
    setError(null);
    setFormVisible(true);
  };

  const handleSave = () => {
    const title = draft.title.trim();
    if (!title) {
      setError("Ponle un nombre a la misión.");
      return;
    }
    if (!isValidTime(draft.time)) {
      setError("La hora debe tener formato HH:MM (24 h), por ejemplo 07:30.");
      return;
    }

    const mission = { ...draft, title };
    syncInBackground(editingId ? updateMission(uid, editingId, mission) : addMission(uid, mission), "No se pudo guardar la misión.");
    setFormVisible(false);
  };

  const handleDelete = (mission: DailyMission) => {
    confirmAction("Eliminar hábito", `¿Eliminar "${mission.title}"? El historial ya registrado se conserva.`, "Eliminar", () => {
      syncInBackground(deleteMission(uid, mission.id), "No se pudo eliminar la misión.");
    });
  };

  return (
    <Screen>
      <ScreenHeader
        title="Hábitos"
        subtitle="Registra lo que sí quieres repetir. El seguimiento se reinicia a medianoche."
        action={<ActionPill icon="add" label="Nueva" onPress={openNew} />}
      />

      <Card>
        <SectionHeading icon="repeat-outline" title="CONSISTENCIA DE HOY" trailing={`${completedCount}/${missions.length}`} />
        <View style={styles.rewardTrack}>
          <ProgressBar progress={missions.length ? completedCount / missions.length : 0} height={6} />
        </View>
        <Text style={styles.helper}>{completedCount} de {missions.length} hábitos registrados hoy</Text>
      </Card>

      <Card>
        <SectionHeading icon="checkmark-circle-outline" title="TUS HÁBITOS" trailing={`${missions.length}`} />
        <View style={styles.list}>
          {missions.length === 0 ? (
            <EmptyState icon="repeat-outline" title="Sin hábitos por ahora" text="Empieza con una acción pequeña y sostenible. Puedes ajustar su hora cuando cambie tu rutina." />
          ) : missions.map((mission) => (
            <MissionRow
              key={mission.id}
              mission={mission}
              trailing={(
                <View style={styles.rowActions}>
                  <IconButton icon="create-outline" label={`Editar ${mission.title}`} onPress={() => openEdit(mission)} />
                  <IconButton icon="trash-outline" label={`Eliminar ${mission.title}`} onPress={() => handleDelete(mission)} color={systemColors.danger} />
                </View>
              )}
            />
          ))}
        </View>
      </Card>

      <PrimaryButton label="AGREGAR HÁBITO" variant="outline" onPress={openNew} />

      <FormSheet visible={formVisible} title={editingId ? "Editar hábito" : "Nuevo hábito"} onClose={() => setFormVisible(false)}>
        <TextField label="HÁBITO" value={draft.title} onChangeText={(title) => setDraft({ ...draft, title })} placeholder="Ej. Caminar 15 minutos" maxLength={40} />
        <TextField label="HORA (HH:MM)" value={draft.time} onChangeText={(time) => setDraft({ ...draft, time })} placeholder="07:30" keyboardType="numbers-and-punctuation" maxLength={5} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton label={editingId ? "GUARDAR CAMBIOS" : "CREAR HÁBITO"} onPress={handleSave} />
      </FormSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  rewardTrack: {
    marginTop: 12,
  },
  helper: {
    color: systemColors.textMuted,
    fontSize: 11,
    marginTop: 8,
  },
  list: {
    gap: 4,
    marginTop: 10,
  },
  rowActions: {
    flexDirection: "row",
    marginLeft: 4,
  },
  error: {
    color: systemColors.danger,
    fontSize: 12,
  },
});
