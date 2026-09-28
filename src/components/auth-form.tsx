import { Image } from "expo-image";
import { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { systemColors } from "@/constants/system-colors";

const monarch = require("@/assets/images/system-monarch.png");

// Marco común de las pantallas de ingreso y registro.
export function AuthFrame({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <View style={styles.heroFrame}>
              <Image source={monarch} style={styles.hero} contentFit="cover" accessibilityLabel="El Sistema" />
            </View>
            <Text style={styles.brandName}>SYSTEM</Text>
            <Text style={styles.brandTagline}>TU POTENCIAL SIN LÍMITES</Text>
          </View>

          <View style={styles.window}>
            <Text style={styles.windowTag}>[ NOTIFICACIÓN ]</Text>
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
    padding: 20,
    gap: 20,
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
  },
  brand: {
    alignItems: "center",
    paddingVertical: 12,
  },
  heroFrame: {
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 2,
    borderColor: systemColors.accent,
    overflow: "hidden",
    marginBottom: 16,
    boxShadow: "0 0 24px rgba(77, 141, 255, 0.8)",
    backgroundColor: systemColors.card,
  },
  hero: {
    width: "100%",
    height: "100%",
  },
  brandName: {
    color: systemColors.text,
    fontSize: 34,
    fontWeight: "300",
    letterSpacing: 12,
    paddingLeft: 12,
  },
  brandTagline: {
    color: systemColors.textFaint,
    fontSize: 9,
    letterSpacing: 3,
    marginTop: 8,
  },
  window: {
    borderWidth: 1,
    borderColor: systemColors.primary,
    borderRadius: 14,
    backgroundColor: systemColors.card,
    padding: 20,
    boxShadow: "0 0 18px rgba(77, 141, 255, 0.35)",
  },
  windowTag: {
    color: systemColors.accent,
    fontSize: 10,
    letterSpacing: 2,
    textAlign: "center",
  },
  title: {
    color: systemColors.text,
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 10,
  },
  subtitle: {
    color: systemColors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
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
