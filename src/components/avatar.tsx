import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";
import { glow, systemColors } from "@/constants/system-colors";

const defaultAvatar = require("@/assets/images/default-avatar.png");

export function Avatar({ photo, size = 44 }: { photo: string | null | undefined; size?: number }) {
  return (
    <View style={[styles.ring, { width: size + 6, height: size + 6, borderRadius: (size + 6) / 2 }]}>
      <Image
        source={photo ? { uri: photo } : defaultAvatar}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="cover"
        accessibilityLabel="Foto de perfil"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: systemColors.accent,
    backgroundColor: systemColors.card,
    boxShadow: `0 0 8px ${glow(0.7)}`,
  },
});
