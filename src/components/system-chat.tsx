import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, TextInputInstance, View } from "react-native";
import { Avatar } from "@/components/avatar";
import { Card, Chip, Icon, IconButton, PrimaryButton, SectionHeading } from "@/components/ui";
import { systemColors } from "@/constants/system-colors";
import { usePlayer } from "@/context/player-context";
import { askSystem, ChatMessage, describeAction, findConflicts, PlanAction, PlayerSnapshot } from "@/services/ai-service";
import { applyPlan } from "@/services/player-service";

type Entry = ChatMessage & {
  actions?: PlanAction[];
  warnings?: string[];
  status?: "pending" | "saving" | "applied" | "failed" | "discarded";
  systemGreeting?: boolean;
};

// "send" manda la pregunta tal cual; "draft" deja el inicio escrito para que completes tus actividades.
const quickPrompts: { label: string; text: string; mode: "send" | "draft" }[] = [
  { label: "Planificar día", text: "PLANIFICAR DÍA. Ayúdame a priorizar lo que sí cabe hoy.", mode: "send" },
  { label: "Planificar semana", text: "PLANIFICAR SEMANA. Ayúdame a organizar la semana sin sobrecargarla.", mode: "send" },
  { label: "Vaciar mi mente", text: "VACIAR MI MENTE. Esto es lo que tengo pendiente: ", mode: "draft" },
  { label: "Revisión diaria", text: "REVISIÓN DIARIA. Guíame con preguntas breves.", mode: "send" },
  { label: "Estoy saturado", text: "ESTOY SATURADO. Ayúdame a reducir la carga y elegir qué hacer primero.", mode: "send" },
];

function createGreeting(player: PlayerSnapshot, questionnaireCompleted: boolean): Entry {
  const discovery = player.discovery;
  const supportStyle = discovery?.supportStyle === "direct"
    ? "con claridad y al grano"
    : discovery?.supportStyle === "structured"
      ? "con pasos sencillos y ordenados"
      : "con calma, sin exigirte de más";
  const goal = discovery?.nearTermGoal;
  return {
    role: "assistant",
    systemGreeting: true,
    content: discovery
      ? `Hola, ${player.name}. Me alegra acompañarte ${supportStyle}. Tengo presente que quieres avanzar en “${goal}”. ¿Qué paso pequeño te gustaría dar hoy, cuidando también el espacio que necesitas?`
      : questionnaireCompleted
        ? `Hola, ${player.name}. Me alegra acompañarte. Este espacio es para organizarte sin juzgarte ni exigirte de más. ¿Qué te gustaría cuidar primero hoy: tu rutina, una tarea o un propósito?`
        : `Hola, ${player.name}. Me alegra acompañarte. Este espacio es para organizarte sin juzgarte ni exigirte de más. ¿Qué te gustaría cuidar primero hoy: tu rutina, una tarea o un propósito? Si quieres, puedes responder el cuestionario para que conozca mejor tu ritmo.`,
  };
}

// Lo que se envía a la IA: el texto de cada mensaje y, si hubo propuesta, qué pasó con ella.
function toHistory(entries: Entry[]): ChatMessage[] {
  return entries
    .filter((entry) => !entry.systemGreeting)
    .map((entry) => {
      if (!entry.actions?.length) return { role: entry.role, content: entry.content };
      const summary = entry.actions.map(describeAction).join("; ");
      const outcome = entry.status === "applied"
        ? "La persona confirmó que estos cambios se guardaron"
        : entry.status === "discarded"
          ? "La persona DESCARTÓ estos cambios"
          : entry.status === "saving"
            ? "Estos cambios están sincronizándose"
            : entry.status === "failed"
              ? "No se pudieron guardar estos cambios"
              : "Cambios aún sin aplicar";
      return { role: entry.role, content: `${entry.content}\n[${outcome}: ${summary}]` };
    });
}

// `autoPrompt` llega desde otras pantallas (p. ej. la tarjeta "En curso" de Inicio); `key` distingue cada envío.
export function SystemChat({ player, autoPrompt, questionnaireCompleted = false }: { player: PlayerSnapshot; autoPrompt?: { text: string; key: string }; questionnaireCompleted?: boolean }) {
  const { uid, profile } = usePlayer();
  const inputRef = useRef<TextInputInstance>(null);
  const applyingEntries = useRef(new Set<string>());
  const [entries, setEntries] = useState<Entry[]>(() => [createGreeting(player, questionnaireCompleted)]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const conversationVersion = useRef(0);

  const updateEntry = (index: number, patch: Partial<Entry>) => {
    setEntries((current) => current.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
  };

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || thinking) return;

    const version = conversationVersion.current;
    const next: Entry[] = [...entries, { role: "user", content }];
    setEntries(next);
    setInput("");
    setError(null);
    setThinking(true);

    try {
      const { reply, actions } = await askSystem(toHistory(next), player);
      if (conversationVersion.current === version) {
        setEntries([...next, {
          role: "assistant",
          content: reply,
          actions,
          warnings: actions.length ? findConflicts(actions, player.events) : [],
          status: actions.length ? "pending" : undefined,
        }]);
      }
    } catch (reason) {
      if (conversationVersion.current === version) {
        setError(reason instanceof Error ? reason.message : "Error desconocido de la IA.");
      }
    } finally {
      if (conversationVersion.current === version) setThinking(false);
    }
  };

  const handledPrompt = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!autoPrompt || handledPrompt.current === autoPrompt.key) return;
    handledPrompt.current = autoPrompt.key;
    void send(autoPrompt.text);
    // Solo debe dispararse cuando llega un prompt nuevo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPrompt?.key]);

  const pickQuickPrompt = (prompt: (typeof quickPrompts)[number]) => {
    if (prompt.mode === "send") {
      void send(prompt.text);
      return;
    }
    setInput(prompt.text);
    TextInput.State.focusTextInput(inputRef.current?.getNativeRef());
  };

  const apply = async (index: number, actions: PlanAction[]) => {
    if (entries[index]?.status === "saving" || entries[index]?.status === "applied") return;
    const version = conversationVersion.current;
    const operationKey = `${version}:${index}`;
    if (applyingEntries.current.has(operationKey)) return;
    applyingEntries.current.add(operationKey);
    updateEntry(index, { status: "saving" });
    try {
      await applyPlan(uid, actions);
      if (conversationVersion.current === version) updateEntry(index, { status: "applied" });
    } catch (reason) {
      console.warn("No se pudieron guardar los cambios de la IA", reason);
      if (conversationVersion.current === version) updateEntry(index, { status: "failed" });
    } finally {
      applyingEntries.current.delete(operationKey);
    }
  };

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <AssistantMark size={42} />
        <View style={styles.flex}>
          <SectionHeading icon="✦" title="HABLA CON EL SISTEMA" />
          <Text style={styles.headerHint}>Organiza tareas, proyectos, hábitos y agenda con información real.</Text>
        </View>
        <IconButton icon="refresh" label="Nueva conversación" onPress={() => { conversationVersion.current += 1; setEntries([createGreeting(player, questionnaireCompleted)]); setThinking(false); setError(null); }} />
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
              <AssistantMark size={30} />
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
            <AssistantMark size={30} />
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
          {quickPrompts.map((prompt) => <Chip key={prompt.label} label={prompt.label} selected={false} onPress={() => pickQuickPrompt(prompt)} />)}
        </View>
      ) : null}

      <View style={styles.inputRow}>
        <TextInput
          ref={inputRef}
          value={input}
          onChangeText={setInput}
          placeholder="Ej. Tengo Cálculo lunes y miércoles de 7 a 9 y quiero ir al gym…"
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
      <Text style={styles.source}>IA en servidor · comparte solo lo necesario; las acciones propuestas requieren tu aprobación.</Text>
    </Card>
  );
}

function AssistantMark({ size }: { size: number }) {
  return (
    <View style={[styles.assistantMark, { width: size, height: size, borderRadius: size / 3 }]}>
      <Icon name="sparkles-outline" size={size * 0.52} color={systemColors.accent} />
    </View>
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

      {entry.status === "saving" ? (
        <View style={styles.planRow}>
          <ActivityIndicator size="small" color={systemColors.accent} />
          <Text style={styles.planText}>Guardando cambios. Se confirmarán cuando el servidor responda.</Text>
        </View>
      ) : entry.status === "applied" ? (
        <View style={styles.planRow}>
          <Icon name="checkmark-circle" size={18} color={systemColors.success} />
          <Text style={[styles.planText, styles.appliedText]}>Cambios guardados y sincronizados. Revisa tareas y planificación.</Text>
        </View>
      ) : entry.status === "discarded" ? (
        <Text style={styles.discardedText}>Propuesta descartada.</Text>
      ) : (
        <>
          {entry.status === "failed" ? (
            <Text style={styles.error}>No se pudieron guardar los cambios. Revisa la conexión y los permisos e inténtalo de nuevo.</Text>
          ) : null}
          <View style={styles.planButtons}>
            <View style={styles.flex}>
              <PrimaryButton label={entry.status === "failed" ? "REINTENTAR" : "APLICAR CAMBIOS"} onPress={onApply} />
            </View>
            <View style={styles.flex}>
              <PrimaryButton label="DESCARTAR" variant="outline" onPress={onDiscard} />
            </View>
          </View>
        </>
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
    case "add_task":
      return "checkbox-outline" as const;
    case "update_mission":
    case "update_event":
    case "update_task":
      return "time-outline" as const;
    default:
      return "trash-outline" as const;
  }
}

const styles = StyleSheet.create({
  card: {
    borderColor: systemColors.border,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  assistantMark: { alignItems: "center", justifyContent: "center", backgroundColor: systemColors.cardAlt },
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
    backgroundColor: systemColors.primarySoft,
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
