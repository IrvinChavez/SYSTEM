import { Pressable, StyleSheet, Text, View } from "react-native";
import { systemColors } from "@/constants/system-colors";
import { DailyMission, usePlayer } from "@/context/player-context";
import { notify } from "@/lib/confirm";

export function MissionRow({ mission, trailing }: { mission: DailyMission; trailing?: React.ReactNode }) {
  const { toggleMission } = usePlayer();

  // No esperamos al servidor: Firestore actualiza la pantalla al instante y sincroniza cuando haya conexión.
  const handleToggle = () => {
    toggleMission(mission.id).catch((error) => {
      console.warn("No se pudo actualizar la misión", error);
      notify("Error del Sistema", "No se pudo guardar el progreso. Revisa tu conexión.");
    });
  };

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: mission.completed }}
      accessibilityLabel={`${mission.title}, ${mission.xp} EXP`}
      onPress={handleToggle}
      style={({ pressed }) => [styles.row, mission.completed && styles.rowDone, pressed && styles.pressed]}
    >
      <View style={[styles.checkbox, mission.completed && styles.checkboxDone]}>
        {mission.completed ? <Text style={styles.checkmark}>✓</Text> : null}
      </View>
      <Text style={[styles.icon, mission.completed && styles.doneText]}>{mission.icon}</Text>
      <View style={styles.copy}>
        <Text style={[styles.name, mission.completed && styles.doneText]} numberOfLines={1}>{mission.title}</Text>
        <Text style={styles.meta}>+{mission.xp} EXP · {mission.stat}</Text>
      </View>
      <Text style={[styles.time, mission.completed && styles.doneText]}>{mission.time}</Text>
      {trailing}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 9,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: systemColors.backgroundRaised,
  },
  rowDone: {
    backgroundColor: systemColors.primarySoft,
  },
  checkbox: {
    width: 21,
    height: 21,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: systemColors.textFaint,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxDone: {
    borderColor: systemColors.success,
    backgroundColor: systemColors.success,
  },
  checkmark: {
    color: systemColors.background,
    fontSize: 14,
    fontWeight: "700",
  },
  icon: {
    color: systemColors.accent,
    width: 27,
    fontSize: 18,
    marginLeft: 5,
    textAlign: "center",
  },
  copy: {
    flex: 1,
    marginLeft: 6,
  },
  name: {
    color: systemColors.textMuted,
    fontSize: 13,
  },
  meta: {
    color: systemColors.textFaint,
    fontSize: 9,
    marginTop: 2,
  },
  time: {
    color: systemColors.textFaint,
    fontSize: 11,
    marginLeft: 6,
  },
  doneText: {
    color: systemColors.success,
  },
  pressed: {
    opacity: 0.72,
  },
});
