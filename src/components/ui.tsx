import Ionicons from "@expo/vector-icons/Ionicons";
import { ComponentProps, ReactNode } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { systemColors } from "@/constants/system-colors";

export function LineIcon({ name, size = 22, color = systemColors.accent }: { name: string; size?: number; color?: string }) {
  return <Text style={[styles.lineIcon, { fontSize: size, color }]}>{name}</Text>;
}

export function SectionHeading({ icon, title, trailing }: { icon: string; title: string; trailing?: ReactNode }) {
  return (
    <View style={styles.sectionHeading}>
      <View style={styles.sectionTitleRow}>
        <LineIcon name={icon} size={18} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {typeof trailing === "string" ? <Text style={styles.sectionTrailing}>{trailing}</Text> : trailing}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function ProgressBar({ progress, height = 4, color = systemColors.primary }: { progress: number; height?: number; color?: string }) {
  const clamped = Math.max(0, Math.min(1, progress));
  return (
    <View style={[styles.track, { height, borderRadius: height / 2 }]}>
      <View style={[styles.fill, { width: `${clamped * 100}%`, backgroundColor: color, borderRadius: height / 2 }]} />
    </View>
  );
}

export function PrimaryButton({ label, onPress, loading, disabled, variant = "primary" }: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "outline" | "danger";
}) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === "outline" && styles.buttonOutline,
        variant === "danger" && styles.buttonDanger,
        inactive && styles.buttonDisabled,
        pressed && styles.pressed,
      ]}
    >
      {loading
        ? <ActivityIndicator color={systemColors.text} />
        : <Text style={[styles.buttonText, variant === "danger" && styles.buttonTextDanger]}>{label}</Text>}
    </Pressable>
  );
}

export function TextField({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={systemColors.textFaint}
        selectionColor={systemColors.accent}
        style={styles.input}
        {...props}
      />
    </View>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export function ScreenHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <View style={styles.screenHeader}>
      <View style={styles.screenHeaderCopy}>
        <Text style={styles.screenTitle}>{title}</Text>
        {subtitle ? <Text style={styles.screenSubtitle}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

export function Screen({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView style={styles.safeArea} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function EmptyState({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <View style={styles.empty}>
      <LineIcon name={icon} size={36} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

export type IconName = ComponentProps<typeof Ionicons>["name"];

export function Icon({ name, size = 22, color = systemColors.accent }: { name: IconName; size?: number; color?: string }) {
  return <Ionicons name={name} size={size} color={color} />;
}

export function IconButton({ icon, label, onPress, color = systemColors.accent }: { icon: IconName; label: string; onPress: () => void; color?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={20} color={color} />
    </Pressable>
  );
}

// Botón con ícono y texto, para acciones que deben encontrarse fácilmente (p. ej. "Nueva").
export function ActionPill({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={18} color={systemColors.text} />
      <Text style={styles.pillText}>{label}</Text>
    </Pressable>
  );
}

export const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: systemColors.background,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 28,
    gap: 10,
  },
  lineIcon: {
    fontWeight: "300",
    textAlign: "center",
  },
  sectionHeading: {
    minHeight: 26,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  sectionTitle: {
    color: systemColors.text,
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  sectionTrailing: {
    color: systemColors.textMuted,
    fontSize: 12,
  },
  card: {
    borderWidth: 1,
    borderColor: systemColors.border,
    borderRadius: 15,
    backgroundColor: systemColors.card,
    padding: 14,
  },
  track: {
    backgroundColor: systemColors.borderMuted,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
  },
  button: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    paddingHorizontal: 16,
    backgroundColor: systemColors.primary,
  },
  buttonOutline: {
    borderWidth: 1,
    borderColor: systemColors.border,
    backgroundColor: systemColors.cardAlt,
  },
  buttonDanger: {
    borderWidth: 1,
    borderColor: systemColors.danger,
    backgroundColor: "transparent",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: systemColors.text,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  buttonTextDanger: {
    color: systemColors.danger,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    color: systemColors.textMuted,
    fontSize: 10,
    letterSpacing: 1.2,
  },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: systemColors.border,
    borderRadius: 10,
    backgroundColor: systemColors.backgroundRaised,
    color: systemColors.text,
    fontSize: 15,
    paddingHorizontal: 12,
  },
  chip: {
    minHeight: 34,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: systemColors.border,
    borderRadius: 17,
    paddingHorizontal: 12,
    backgroundColor: systemColors.backgroundRaised,
  },
  chipSelected: {
    borderColor: systemColors.accent,
    backgroundColor: "#17325A",
  },
  chipText: {
    color: systemColors.textMuted,
    fontSize: 12,
  },
  chipTextSelected: {
    color: systemColors.text,
    fontWeight: "600",
  },
  screenHeader: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  screenHeaderCopy: {
    flex: 1,
  },
  screenTitle: {
    color: systemColors.text,
    fontSize: 22,
    fontWeight: "300",
    letterSpacing: 4,
  },
  screenSubtitle: {
    color: systemColors.textFaint,
    fontSize: 11,
    marginTop: 4,
  },
  empty: {
    alignItems: "center",
    paddingVertical: 28,
    gap: 8,
  },
  emptyTitle: {
    color: systemColors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  emptyText: {
    color: systemColors.textMuted,
    fontSize: 12,
    textAlign: "center",
  },
  iconButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 19,
  },
  pill: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 20,
    paddingHorizontal: 14,
    backgroundColor: systemColors.primary,
  },
  pillText: {
    color: systemColors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.72,
  },
});
