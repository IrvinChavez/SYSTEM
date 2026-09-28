import { Image } from "expo-image";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { glow, systemColors } from "@/constants/system-colors";
import { usePlayer } from "@/context/player-context";
import { rankForLevel } from "@/lib/leveling";

const monarch = require("@/assets/images/system-monarch.png");

// Ventana azul del Sistema que aparece al subir de nivel.
export function LevelUpNotice() {
  const { levelUpNotice, dismissLevelUp } = usePlayer();
  if (levelUpNotice === null) return null;

  const rank = rankForLevel(levelUpNotice);

  return (
    <Modal transparent animationType="fade" visible onRequestClose={dismissLevelUp}>
      <Pressable style={styles.backdrop} onPress={dismissLevelUp}>
        <View style={styles.window}>
          <Image source={monarch} style={styles.image} contentFit="cover" />
          <Text style={styles.tag}>[ NOTIFICACIÓN ]</Text>
          <Text style={styles.title}>¡NIVEL AUMENTADO!</Text>
          <Text style={styles.level}>{levelUpNotice}</Text>
          <Text style={styles.rank}>Rango {rank.rank} · {rank.title}</Text>
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
    borderColor: systemColors.accent,
    borderRadius: 14,
    backgroundColor: systemColors.card,
    padding: 24,
    boxShadow: `0 0 24px ${glow(0.6)}`,
  },
  image: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: systemColors.accent,
    marginBottom: 14,
  },
  tag: {
    color: systemColors.accent,
    fontSize: 10,
    letterSpacing: 2,
  },
  title: {
    color: systemColors.text,
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 2,
    marginTop: 12,
  },
  level: {
    color: systemColors.accent,
    fontSize: 64,
    fontWeight: "700",
    textShadowColor: systemColors.primary,
    textShadowRadius: 16,
  },
  rank: {
    color: systemColors.textMuted,
    fontSize: 13,
  },
  hint: {
    color: systemColors.textFaint,
    fontSize: 10,
    marginTop: 18,
  },
});
