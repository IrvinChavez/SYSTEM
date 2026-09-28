import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { FieldGroup, FormSheet } from "@/components/form-sheet";
import { MissionRow } from "@/components/mission-row";
import { ActionPill, Card, Chip, EmptyState, IconButton, PrimaryButton, ProgressBar, Screen, ScreenHeader, SectionHeading, TextField } from "@/components/ui";
import { systemColors } from "@/constants/system-colors";
import { DailyMission, usePlayer } from "@/context/player-context";
import { difficultyOptions, Mission, missionIcons, StatKey, statInfo, statKeys } from "@/data/system-data";
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
    confirmAction("Eliminar misión", `¿Eliminar "${mission.title}"? La EXP ya ganada se conserva.`, "Eliminar", () => {
      syncInBackground(deleteMission(uid, mission.id), "No se pudo eliminar la misión.");
    });
  };

  const earnedToday = missions.filter((mission) => mission.completed).reduce((total, mission) => total + mission.xp, 0);
  const availableToday = missions.reduce((total, mission) => total + mission.xp, 0);

  return (
    <Screen>
      <ScreenHeader
        title="MISIONES"
        subtitle="Toca una misión para completarla. Se reinician a medianoche."
        action={<ActionPill icon="add" label="Nueva" onPress={openNew} />}
      />

      <Card>
        <SectionHeading icon="✦" title="RECOMPENSA DE HOY" trailing={`${earnedToday}/${availableToday} EXP`} />
        <View style={styles.rewardTrack}>
          <ProgressBar progress={availableToday ? earnedToday / availableToday : 0} height={6} />
        </View>
        <Text style={styles.helper}>{completedCount} de {missions.length} misiones completadas</Text>
      </Card>

      <Card>
        <SectionHeading icon="✓" title="MISIÓN DIARIA" trailing={`${missions.length}`} />
        <View style={styles.list}>
          {missions.length === 0 ? (
            <EmptyState icon="✓" title="Sin misiones" text="Crea tu primera misión con el botón Nueva o pídesela a la IA." />
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

      <PrimaryButton label="＋ NUEVA MISIÓN" variant="outline" onPress={openNew} />

      <FormSheet visible={formVisible} title={editingId ? "EDITAR MISIÓN" : "NUEVA MISIÓN"} onClose={() => setFormVisible(false)}>
        <TextField label="NOMBRE" value={draft.title} onChangeText={(title) => setDraft({ ...draft, title })} placeholder="Ej. Correr 3 km" maxLength={40} />
        <TextField label="HORA (HH:MM)" value={draft.time} onChangeText={(time) => setDraft({ ...draft, time })} placeholder="07:30" keyboardType="numbers-and-punctuation" maxLength={5} />
        <FieldGroup label="DIFICULTAD">
          {difficultyOptions.map((option) => (
            <Chip key={option.xp} label={`${option.label} · ${option.xp} EXP`} selected={draft.xp === option.xp} onPress={() => setDraft({ ...draft, xp: option.xp })} />
          ))}
        </FieldGroup>
        <FieldGroup label="ESTADÍSTICA QUE ENTRENA">
          {statKeys.map((stat: StatKey) => (
            <Chip key={stat} label={`${statInfo[stat].icon} ${statInfo[stat].label}`} selected={draft.stat === stat} onPress={() => setDraft({ ...draft, stat })} />
          ))}
        </FieldGroup>
        <FieldGroup label="ÍCONO">
          {missionIcons.map((icon) => (
            <Chip key={icon} label={icon} selected={draft.icon === icon} onPress={() => setDraft({ ...draft, icon })} />
          ))}
        </FieldGroup>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton label={editingId ? "GUARDAR CAMBIOS" : "CREAR MISIÓN"} onPress={handleSave} />
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
