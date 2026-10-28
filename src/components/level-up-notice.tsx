import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "@/components/ui";
import { systemColors } from "@/constants/system-colors";
import { usePlayer } from "@/context/player-context";

export function LevelUpNotice() {
  const { levelUpNotice, dismissLevelUp } = usePlayer();
  if (levelUpNotice === null) return null;

  return (
    <Modal transparent animationType="fade" visible onRequestClose={dismissLevelUp}>
      <Pressable style={styles.backdrop} onPress={dismissLevelUp}>
        <View style={styles.window}>
          <View style={styles.icon}><Icon name="checkmark" size={22} color={systemColors.success} /></View>
          <Text style={styles.tag}>PROGRESO</Text>
          <Text style={styles.title}>Vas construyendo constancia</Text>
          <Text style={styles.body}>Cada hábito registrado cuenta. Sigue a tu ritmo y deja espacio para descansar.</Text>
          <Text style={styles.hint}>Toca para continuar</Text>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: systemColors.overlay,
    padding: 24,
  },
  window: {
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
    borderWidth: 1,
    borderColor: systemColors.border,
    borderRadius: 16,
    backgroundColor: systemColors.card,
    padding: 24,
    gap: 8,
  },
  icon: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: systemColors.backgroundRaised,
    marginBottom: 4,
  },
  tag: {
    color: systemColors.accent,
    fontSize: 10,
    letterSpacing: 1.4,
    fontWeight: "600",
  },
  title: {
    color: systemColors.text,
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
  },
  body: {
    color: systemColors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  hint: {
    color: systemColors.textFaint,
    fontSize: 10,
    marginTop: 10,
  },
});
