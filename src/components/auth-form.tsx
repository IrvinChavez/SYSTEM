import { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon } from "@/components/ui";
import { systemColors } from "@/constants/system-colors";

// Marco común de las pantallas de ingreso y registro.
export function AuthFrame({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <View style={styles.heroFrame}>
              <Icon name="layers-outline" size={24} color={systemColors.accent} />
            </View>
            <Text style={styles.brandName}>SYSTEM</Text>
            <Text style={styles.brandTagline}>ORGANIZA TU DÍA</Text>
          </View>

          <View style={styles.window}>
            <Text style={styles.windowTag}>TU ESPACIO PERSONAL</Text>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
            <View style={styles.form}>{children}</View>
          </View>

          <View style={styles.footer}>{footer}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return <Text accessibilityRole="alert" style={styles.error}>{message}</Text>;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: systemColors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
    gap: 16,
    maxWidth: 520,
    width: "100%",
    alignSelf: "center",
  },
  brand: {
    alignItems: "center",
    paddingVertical: 4,
  },
  heroFrame: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: systemColors.border,
    overflow: "hidden",
    backgroundColor: systemColors.card,
    marginBottom: 10,
  },
  brandName: {
    color: systemColors.text,
    fontSize: 22,
    fontWeight: "600",
    letterSpacing: 4,
    paddingLeft: 4,
  },
  brandTagline: {
    color: systemColors.textFaint,
    fontSize: 9,
    letterSpacing: 1.6,
    marginTop: 5,
  },
  window: {
    borderWidth: 1,
    borderColor: systemColors.border,
    borderRadius: 16,
    backgroundColor: systemColors.card,
    padding: 20,
  },
  windowTag: {
    color: systemColors.accent,
    fontSize: 10,
    letterSpacing: 1.2,
  },
  title: {
    color: systemColors.text,
    fontSize: 20,
    fontWeight: "700",
    textAlign: "left",
    marginTop: 10,
  },
  subtitle: {
    color: systemColors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "left",
    marginTop: 6,
  },
  form: {
    gap: 14,
    marginTop: 20,
  },
  footer: {
    alignItems: "center",
    gap: 12,
  },
  error: {
    color: systemColors.danger,
    fontSize: 13,
    textAlign: "center",
  },
});
