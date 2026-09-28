import { ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { systemColors } from "@/constants/system-colors";

export function FormSheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={styles.dismissArea} accessibilityLabel="Cerrar" onPress={onClose} />
        <SafeAreaView edges={["bottom"]} style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" hitSlop={10} onPress={onClose}>
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function FieldGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupLabel}>{label}</Text>
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: systemColors.overlay,
  },
  dismissArea: {
    flex: 1,
  },
  sheet: {
    maxHeight: "88%",
    borderTopWidth: 1,
    borderColor: systemColors.primary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: systemColors.card,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 6,
  },
  title: {
    color: systemColors.text,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  close: {
    color: systemColors.textMuted,
    fontSize: 18,
  },
  content: {
    padding: 20,
    paddingTop: 10,
    gap: 16,
  },
  group: {
    gap: 8,
  },
  groupLabel: {
    color: systemColors.textMuted,
    fontSize: 10,
    letterSpacing: 1.2,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
});
