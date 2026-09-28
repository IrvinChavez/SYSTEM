import { Image } from "expo-image";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Avatar } from "@/components/avatar";
import { Card, Chip, Icon, IconButton, PrimaryButton, SectionHeading } from "@/components/ui";
import { systemColors } from "@/constants/system-colors";
import { usePlayer } from "@/context/player-context";
import { askSystem, ChatMessage, describeAction, findConflicts, PlanAction, PlayerSnapshot } from "@/services/ai-service";
import { syncInBackground } from "@/lib/confirm";
import { applyPlan } from "@/services/player-service";

const monarch = require("@/assets/images/system-monarch.png");

type Entry = ChatMessage & {
  actions?: PlanAction[];
  warnings?: string[];
  status?: "pending" | "applied" | "discarded";
};

const quickPrompts = [
  "Acomoda mi día de mañana",
  "Mañana tengo clase de 8 a 14, ¿cuándo entreno?",
  "Quiero empezar a leer 20 min diarios",
  "Motívame para terminar hoy",
];

const greeting: Entry = {
  role: "assistant",
  content: "[ Sistema en línea ] Jugador, cuéntame qué quieres hacer o cuál es tu horario y acomodaré tus misiones y tu agenda. También puedo analizar tu progreso.",
};

// Lo que se envía a la IA: el texto de cada mensaje y, si hubo propuesta, qué pasó con ella.
function toHistory(entries: Entry[]): ChatMessage[] {
  return entries
    .filter((entry) => entry !== greeting)
    .map((entry) => {
      if (!entry.actions?.length) return { role: entry.role, content: entry.content };
      const summary = entry.actions.map(describeAction).join("; ");
      const outcome = entry.status === "applied" ? "El jugador APLICÓ estos cambios" : entry.status === "discarded" ? "El jugador DESCARTÓ estos cambios" : "Cambios aún sin aplicar";
      return { role: entry.role, content: `${entry.content}\n[${outcome}: ${summary}]` };
    });
}

export function SystemChat({ player }: { player: PlayerSnapshot }) {
  const { uid, profile } = usePlayer();
  const [entries, setEntries] = useState<Entry[]>([greeting]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateEntry = (index: number, patch: Partial<Entry>) => {
    setEntries((current) => current.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
  };

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || thinking) return;

    const next: Entry[] = [...entries, { role: "user", content }];
    setEntries(next);
    setInput("");
    setError(null);
    setThinking(true);

    try {
      const { reply, actions } = await askSystem(toHistory(next), player);
      setEntries([...next, {
        role: "assistant",
        content: reply,
        actions,
        warnings: actions.length ? findConflicts(actions, player.events) : [],
        status: actions.length ? "pending" : undefined,
      }]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Error desconocido de la IA.");
    } finally {
      setThinking(false);
    }
  };

  const apply = (index: number, actions: PlanAction[]) => {
    updateEntry(index, { status: "applied" });
    syncInBackground(applyPlan(uid, actions), "No se pudieron guardar los cambios de la IA en el servidor.");
  };

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Image source={monarch} style={styles.headerImage} contentFit="cover" />
        <View style={styles.flex}>
          <SectionHeading icon="✦" title="HABLA CON EL SISTEMA" />
          <Text style={styles.headerHint}>Dile qué quieres hacer y acomodará tus horarios.</Text>
        </View>
        <IconButton icon="refresh" label="Nueva conversación" onPress={() => { setEntries([greeting]); setError(null); }} />
      </View>

      <View style={styles.messages}>
        {entries.map((entry, index) => (
          entry.role === "user" ? (
            <View key={index} style={styles.userRow}>
              <View style={[styles.bubble, styles.userBubble]}>
                <Text style={styles.messageText}>{entry.content}</Text>
              </View>
              <Avatar photo={profile.photo} size={26} />
            </View>
          ) : (
            <View key={index} style={styles.systemRow}>
              <Image source={monarch} style={styles.systemAvatar} contentFit="cover" />
              <View style={[styles.bubble, styles.systemBubble]}>
                <Text style={styles.messageText}>{entry.content}</Text>
                {entry.actions?.length ? (
                  <PlanCard
                    entry={entry}
                    onApply={() => apply(index, entry.actions ?? [])}
                    onDiscard={() => updateEntry(index, { status: "discarded" })}
                  />
                ) : null}
              </View>
            </View>
          )
        ))}
        {thinking ? (
          <View style={styles.systemRow}>
            <Image source={monarch} style={styles.systemAvatar} contentFit="cover" />
            <View style={[styles.bubble, styles.systemBubble, styles.thinking]}>
              <ActivityIndicator size="small" color={systemColors.accent} />
              <Text style={styles.thinkingText}>El Sistema está analizando…</Text>
            </View>
          </View>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      {entries.length <= 1 ? (
        <View style={styles.quick}>
          {quickPrompts.map((prompt) => <Chip key={prompt} label={prompt} selected={false} onPress={() => send(prompt)} />)}
        </View>
      ) : null}

      <View style={styles.inputRow}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ej. Mañana trabajo de 9 a 5 y quiero ir al gym…"
          placeholderTextColor={systemColors.textFaint}
          selectionColor={systemColors.accent}
          style={styles.input}
          multiline
          maxLength={600}
          onSubmitEditing={() => send(input)}
          submitBehavior="submit"
          returnKeyType="send"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Enviar"
          disabled={thinking || !input.trim()}
          onPress={() => send(input)}
          style={({ pressed }) => [styles.send, (thinking || !input.trim()) && styles.sendDisabled, pressed && styles.pressed]}
        >
          <Icon name="send" size={18} color={systemColors.text} />
        </Pressable>
      </View>
      <Text style={styles.source}>IA: Groq Cloud · los cambios solo se guardan si tocas &quot;Aplicar cambios&quot;</Text>
    </Card>
  );
}

function PlanCard({ entry, onApply, onDiscard }: { entry: Entry; onApply: () => void; onDiscard: () => void }) {
  const actions = entry.actions ?? [];

  return (
    <View style={styles.plan}>
      <Text style={styles.planTitle}>CAMBIOS PROPUESTOS ({actions.length})</Text>
      {actions.map((action, index) => (
        <View key={index} style={styles.planRow}>
          <Icon name={planIcon(action)} size={16} color={action.type.startsWith("delete") ? systemColors.danger : systemColors.accent} />
          <Text style={styles.planText}>{describeAction(action)}</Text>
        </View>
      ))}
      {entry.warnings?.map((warning) => (
        <View key={warning} style={styles.planRow}>
          <Icon name="warning-outline" size={16} color={systemColors.warning} />
          <Text style={[styles.planText, styles.warningText]}>{warning}</Text>
        </View>
      ))}

      {entry.status === "applied" ? (
        <View style={styles.planRow}>
          <Icon name="checkmark-circle" size={18} color={systemColors.success} />
          <Text style={[styles.planText, styles.appliedText]}>Cambios aplicados. Revisa Misiones y Agenda.</Text>
        </View>
      ) : entry.status === "discarded" ? (
        <Text style={styles.discardedText}>Propuesta descartada.</Text>
      ) : (
        <View style={styles.planButtons}>
          <View style={styles.flex}>
            <PrimaryButton label="APLICAR CAMBIOS" onPress={onApply} />
          </View>
          <View style={styles.flex}>
            <PrimaryButton label="DESCARTAR" variant="outline" onPress={onDiscard} />
          </View>
        </View>
      )}
    </View>
  );
}

function planIcon(action: PlanAction) {
  switch (action.type) {
    case "add_mission":
      return "add-circle-outline" as const;
    case "add_event":
      return "calendar-outline" as const;
    case "update_mission":
    case "update_event":
      return "time-outline" as const;
    default:
      return "trash-outline" as const;
  }
}

const styles = StyleSheet.create({
  card: {
    borderColor: systemColors.primary,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: systemColors.accent,
  },
  headerHint: {
    color: systemColors.textMuted,
    fontSize: 11,
  },
  messages: {
    gap: 10,
    marginTop: 14,
  },
  systemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "flex-end",
    gap: 6,
  },
  systemAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: systemColors.accent,
  },
  bubble: {
    maxWidth: "84%",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  systemBubble: {
    flexShrink: 1,
    borderWidth: 1,
    borderColor: systemColors.border,
    backgroundColor: systemColors.backgroundRaised,
    borderTopLeftRadius: 3,
  },
  userBubble: {
    backgroundColor: "#17325A",
    borderBottomRightRadius: 3,
  },
  messageText: {
    color: systemColors.text,
    fontSize: 13,
    lineHeight: 19,
  },
  thinking: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  thinkingText: {
    color: systemColors.textMuted,
    fontSize: 12,
  },
  error: {
    color: systemColors.danger,
    fontSize: 12,
  },
  plan: {
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: systemColors.border,
  },
  planTitle: {
    color: systemColors.accent,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  planRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  planText: {
    flex: 1,
    color: systemColors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  warningText: {
    color: systemColors.warning,
  },
  appliedText: {
    color: systemColors.success,
    fontWeight: "600",
  },
  discardedText: {
    color: systemColors.textFaint,
    fontSize: 12,
    fontStyle: "italic",
  },
  planButtons: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  quick: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 12,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    marginTop: 12,
  },
  input: {
    flex: 1,
    minHeight: 46,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: systemColors.border,
    borderRadius: 10,
    backgroundColor: systemColors.backgroundRaised,
    color: systemColors.text,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
  },
  send: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: systemColors.primary,
  },
  sendDisabled: {
    opacity: 0.4,
  },
  source: {
    color: systemColors.textFaint,
    fontSize: 9,
    letterSpacing: 0.6,
    marginTop: 10,
  },
  pressed: {
    opacity: 0.72,
  },
});
