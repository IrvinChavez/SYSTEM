import { Pressable, StyleProp, StyleSheet, Text, TextStyle, View } from "react-native";
import { Icon, ProgressBar } from "@/components/ui";
import { glow, systemColors } from "@/constants/system-colors";
import { AgendaEvent } from "@/data/system-data";
import { eventTiming, formatClock, formatDuration } from "@/lib/dates";
import { useNow } from "@/lib/use-now";

// Texto corto del estado de un evento: "2 h", "en 25 min · 2 h", "en curso", "terminó".
export function timingLabel(event: AgendaEvent, now: Date) {
  const timing = eventTiming(event, now);
  const duration = formatDuration(timing.totalSeconds / 60);
  if (timing.status === "live") return `En curso · ${duration}`;
  if (timing.status === "done") return `Terminó · ${duration}`;
  return timing.startsInSeconds < 12 * 3600 ? `En ${formatDuration(Math.ceil(timing.startsInSeconds / 60))} · ${duration}` : duration;
}

// Cronómetro que arranca en 00:00 al empezar el evento y avanza cada segundo hasta su duración.
export function LiveClock({ event, style }: { event: AgendaEvent; style?: StyleProp<TextStyle> }) {
  const now = useNow(1000);
  const timing = eventTiming(event, now);
  return <Text style={[styles.inlineClock, style]}>{formatClock(timing.elapsedSeconds)}</Text>;
}

// Tarjeta grande de la clase / evento en curso: cronómetro, progreso, cuánto falta y acceso a la IA.
export function LiveEventCard({ event, onAsk }: { event: AgendaEvent; onAsk?: () => void }) {
  const now = useNow(1000);
  const timing = eventTiming(event, now);
  const remaining = timing.totalSeconds - timing.elapsedSeconds;

  return (
    <View style={styles.card} accessibilityLabel={`${event.title} en curso, ${formatClock(timing.elapsedSeconds)} de ${formatDuration(timing.totalSeconds / 60)}`}>
      <View style={styles.header}>
        <View style={styles.liveDot} />
        <Text style={styles.tag}>EN CURSO · {event.category}</Text>
        {event.source === "calendar" ? <Text style={styles.source}>NOTION</Text> : null}
      </View>
      <Text style={styles.title} numberOfLines={2}>{event.title}</Text>
      {event.location ? <Text style={styles.location}>⌖ {event.location}</Text> : null}

      <View style={styles.clockRow}>
        <Text style={styles.clock}>{formatClock(timing.elapsedSeconds)}</Text>
        <Text style={styles.total}>de {formatDuration(timing.totalSeconds / 60)}</Text>
      </View>
      <ProgressBar progress={timing.totalSeconds ? timing.elapsedSeconds / timing.totalSeconds : 0} height={5} color={systemColors.primary} />
      <View style={styles.footer}>
        <Text style={styles.meta}>{event.start} – {event.end}</Text>
        <Text style={styles.meta}>Faltan {formatDuration(Math.ceil(remaining / 60))}</Text>
      </View>

      {onAsk ? (
        <Pressable accessibilityRole="button" onPress={onAsk} style={({ pressed }) => [styles.ask, pressed && styles.pressed]}>
          <Icon name="sparkles" size={16} color={systemColors.text} />
          <Text style={styles.askText}>Platicar mi día con la IA</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: systemColors.primary,
    borderRadius: 15,
    backgroundColor: systemColors.card,
    padding: 14,
    gap: 4,
    boxShadow: `0 0 18px ${glow(0.3)}`,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: systemColors.accent,
    boxShadow: `0 0 6px ${glow(0.9)}`,
  },
  tag: {
    flex: 1,
    color: systemColors.accent,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.4,
  },
  source: {
    color: systemColors.highlight,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
  },
  title: {
    color: systemColors.text,
    fontSize: 18,
    fontWeight: "700",
    marginTop: 4,
  },
  location: {
    color: systemColors.textMuted,
    fontSize: 11,
  },
  clockRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    marginTop: 8,
    marginBottom: 6,
  },
  clock: {
    color: systemColors.text,
    fontSize: 38,
    fontWeight: "300",
    fontVariant: ["tabular-nums"],
    letterSpacing: 1,
    textShadowColor: glow(0.8),
    textShadowRadius: 12,
  },
  total: {
    color: systemColors.textMuted,
    fontSize: 13,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  meta: {
    color: systemColors.textMuted,
    fontSize: 11,
  },
  ask: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 10,
    backgroundColor: systemColors.primary,
    marginTop: 10,
  },
  askText: {
    color: systemColors.text,
    fontSize: 12,
    fontWeight: "700",
  },
  inlineClock: {
    color: systemColors.accent,
    fontSize: 11,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  pressed: {
    opacity: 0.72,
  },
});
