import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/avatar";
import { LiveEventCard, timingLabel } from "@/components/event-timer";
import { MissionRow } from "@/components/mission-row";
import { Card, Icon, IconName, LineIcon, ProgressBar, Screen, SectionHeading } from "@/components/ui";
import { glow, systemColors } from "@/constants/system-colors";
import { usePlayer } from "@/context/player-context";
import { eventTiming, greetingForNow } from "@/lib/dates";
import { useNow } from "@/lib/use-now";

const images = {
  banner: require("@/assets/images/player-banner.png"),
  landscape: require("@/assets/images/landscape-torii.png"),
  dayPath: require("@/assets/images/day-path.png"),
  monarch: require("@/assets/images/system-monarch.png"),
};

function PlayerCard() {
  const { profile, level, experience, experienceGoal, rank } = usePlayer();

  return (
    <View style={styles.playerCard}>
      <Image source={images.banner} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="right" />
      <View style={styles.playerCopy}>
        <Text style={styles.eyebrow}>ESTADO DEL JUGADOR · RANGO {rank.rank}</Text>
        <Text style={styles.greeting}>{greetingForNow()}</Text>
        <Text style={styles.playerName} numberOfLines={1}>{profile.name}.</Text>
        <Text style={styles.motto}>{rank.title}</Text>
      </View>
      <View style={styles.levelBlock}>
        <Text style={styles.levelLabel}>NIVEL</Text>
        <Text style={styles.levelValue}>{level}</Text>
        <View style={styles.experienceTrack}>
          <ProgressBar progress={experience / experienceGoal} height={3} color={systemColors.accent} />
        </View>
        <Text style={styles.experienceText}>EXP {experience} / {experienceGoal.toLocaleString()}</Text>
      </View>
    </View>
  );
}

function QuickAction({ icon, label, detail, onPress }: { icon: IconName; label: string; detail: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]}>
      <View style={styles.quickIcon}>
        <Icon name={icon} size={22} color={systemColors.text} />
      </View>
      <Text style={styles.quickLabel}>{label}</Text>
      <Text style={styles.quickDetail}>{detail}</Text>
    </Pressable>
  );
}

function SummaryCard({ icon, label, value, detail, progress, onPress }: {
  icon: string;
  label: string;
  value: string;
  detail?: string;
  progress?: number;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.summaryCard, pressed && styles.pressed]}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <View style={styles.summaryValueRow}>
        <LineIcon name={icon} size={22} />
        <Text style={styles.summaryValue}>{value}</Text>
      </View>
      {detail ? <Text style={styles.summaryDetail}>{detail}</Text> : null}
      {progress !== undefined ? <View style={styles.summaryTrack}><ProgressBar progress={progress} /></View> : null}
    </Pressable>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { loading, error, missions, completedCount, todayEvents, weeklyProgress, streak, profile } = usePlayer();
  const openForm = (pathname: "/missions" | "/agenda") => router.navigate({ pathname, params: { nuevo: String(Date.now()) } });
  // Se refresca cada 30 s para que la tarjeta "en curso" aparezca y desaparezca sola.
  const clock = useNow(30_000);

  if (loading && !error) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={systemColors.accent} size="large" />
        <Text style={styles.loadingText}>Sincronizando con el Sistema…</Text>
      </View>
    );
  }

  const liveEvent = todayEvents.find((event) => eventTiming(event, clock).status === "live");
  const nextEvent = todayEvents.find((event) => eventTiming(event, clock).status === "upcoming") ?? (liveEvent ? undefined : todayEvents.at(-1));
  const askAboutDay = (prompt: string) => router.navigate({ pathname: "/system", params: { prompt, t: String(Date.now()) } });
  const pending = missions.length - completedCount;

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Mi perfil" style={styles.headerSide} onPress={() => router.navigate("/profile")}>
          <Avatar photo={profile.photo} size={36} />
        </Pressable>
        <View style={styles.brand}>
          <Text style={styles.brandName}>SYSTEM</Text>
          <Text style={styles.brandTagline}>TU POTENCIAL SIN LÍMITES</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Hablar con el Sistema" style={styles.headerSide} onPress={() => router.navigate("/system")}>
          <Icon name="sparkles" size={26} />
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <PlayerCard />

      {liveEvent ? (
        <LiveEventCard
          event={liveEvent}
          onAsk={() => askAboutDay(`Estoy en ${liveEvent.title} (${liveEvent.start}–${liveEvent.end}). ¿Qué sigue en mi día y cómo aprovecho el tiempo libre?`)}
        />
      ) : null}

      <View>
        <Text style={styles.groupTitle}>¿QUÉ QUIERES HACER?</Text>
        <View style={styles.quickGrid}>
          <QuickAction icon="add-circle" label="Nueva misión" detail="Agregar un hábito" onPress={() => openForm("/missions")} />
          <QuickAction icon="calendar" label="Nuevo evento" detail="Clase, trabajo, cita" onPress={() => openForm("/agenda")} />
          <QuickAction icon="sparkles" label="Planear con IA" detail="Acomoda tu horario" onPress={() => router.navigate("/system")} />
          <QuickAction icon="person-circle" label="Mi perfil" detail="Foto y estadísticas" onPress={() => router.navigate("/profile")} />
        </View>
      </View>

      <Pressable accessibilityRole="button" onPress={() => router.navigate("/system")} style={({ pressed }) => [styles.systemCard, pressed && styles.pressed]}>
        <Image source={images.monarch} style={styles.systemImage} contentFit="cover" />
        <View style={styles.systemCopy}>
          <Text style={styles.systemTag}>[ MENSAJE DEL SISTEMA ]</Text>
          <Text style={styles.systemText}>
            {missions.length - completedCount > 0
              ? `Tienes ${missions.length - completedCount} misiones pendientes. Cuéntame tu día y lo acomodo.`
              : "Misión diaria completada. ¿Planeamos mañana?"}
          </Text>
        </View>
        <Icon name="chevron-forward" size={22} />
      </Pressable>

      <Card>
        <SectionHeading icon="✓" title="MISIÓN DIARIA" trailing={`${completedCount}/${missions.length}`} />
        <View style={styles.missionProgress}>
          <ProgressBar progress={missions.length ? completedCount / missions.length : 0} height={2} />
        </View>
        <Text style={styles.helperText}>
          {missions.length === 0
            ? "No tienes misiones. Agrégalas en la pestaña Misiones."
            : pending === 0 ? "¡Misión diaria completada! Recompensa obtenida." : "Completa tus misiones de hoy."}
        </Text>
        <View style={styles.missionList}>
          {missions.map((mission) => <MissionRow key={mission.id} mission={mission} />)}
        </View>
      </Card>

      <View style={styles.summaryGrid}>
        <SummaryCard icon="▥" label="HÁBITOS" value={`${completedCount}/${missions.length}`} progress={missions.length ? completedCount / missions.length : 0} onPress={() => router.navigate("/missions")} />
        <SummaryCard icon="□" label="TAREAS" value={`${pending}`} detail="Pendientes hoy" onPress={() => router.navigate("/missions")} />
        <SummaryCard icon="▦" label="AGENDA" value="Hoy" detail={`${todayEvents.length} ${todayEvents.length === 1 ? "evento" : "eventos"}`} onPress={() => router.navigate("/agenda")} />
        <SummaryCard icon="▮" label="PROGRESO" value={`${Math.round(weeklyProgress * 100)}%`} detail={`Esta semana · racha ${streak}🔥`} progress={weeklyProgress} onPress={() => router.navigate("/profile")} />
      </View>

      <View style={styles.progressCard}>
        <View style={styles.progressCardCopy}>
          <Text style={styles.progressQuote}>La disciplina es el puente entre tus objetivos y la realidad.</Text>
          <Pressable accessibilityRole="button" style={({ pressed }) => [styles.progressButton, pressed && styles.pressed]} onPress={() => router.navigate("/profile")}>
            <Text style={styles.progressButtonText}>VER PROGRESO</Text>
            <Text style={styles.arrow}>›</Text>
          </Pressable>
        </View>
        <Image source={images.landscape} style={styles.landscape} contentFit="cover" />
      </View>

      <View style={styles.eventMotivationRow}>
        <Pressable style={({ pressed }) => [styles.eventCard, pressed && styles.pressed]} onPress={() => router.navigate("/agenda")}>
          <SectionHeading icon="□" title={liveEvent && !nextEvent ? "DESPUÉS" : "PRÓXIMO EVENTO"} />
          {nextEvent ? (
            <View style={styles.eventBody}>
              <View style={styles.eventTimeColumn}>
                <Text style={styles.eventTime}>{nextEvent.start}</Text>
                <Text style={styles.eventTimeDivider}>—</Text>
                <Text style={styles.eventTime}>{nextEvent.end}</Text>
              </View>
              <View style={styles.eventInfo}>
                <Text style={styles.eventTitle} numberOfLines={2}>{nextEvent.title}</Text>
                {nextEvent.location ? <Text style={styles.eventLocation}>⌖ {nextEvent.location}</Text> : null}
                <Text style={styles.eventDuration}>{timingLabel(nextEvent, clock)}</Text>
                <Text style={styles.eventCategory}>{nextEvent.source === "calendar" ? `${nextEvent.category} · NOTION` : nextEvent.category}</Text>
              </View>
              <Text style={styles.arrow}>›</Text>
            </View>
          ) : (
            <Text style={styles.noEvent}>{liveEvent ? "Nada más después de este evento." : "Sin eventos hoy. Toca para agregar uno."}</Text>
          )}
        </Pressable>
        <View style={styles.dayCard}>
          <Image source={images.dayPath} style={StyleSheet.absoluteFill} contentFit="cover" />
          <Text style={styles.dayCardText}>UN DÍA{"\n"}A LA VEZ.</Text>
        </View>
      </View>

      <Pressable style={styles.footerPrompt} onPress={() => router.navigate("/system")}>
        <Text style={styles.footerPromptText}>CONSTRUYE LA MEJOR VERSIÓN DE TI</Text>
        <Text style={styles.footerPromptArrow}>→</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    backgroundColor: systemColors.background,
  },
  loadingText: {
    color: systemColors.textMuted,
    fontSize: 13,
    letterSpacing: 1,
  },
  error: {
    color: systemColors.danger,
    fontSize: 12,
    textAlign: "center",
  },
  header: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerSide: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  brand: {
    alignItems: "center",
  },
  brandName: {
    color: systemColors.text,
    fontSize: 22,
    fontWeight: "300",
    letterSpacing: 8,
    paddingLeft: 8,
  },
  brandTagline: {
    color: systemColors.textFaint,
    fontSize: 7,
    letterSpacing: 2.4,
    marginTop: 5,
  },
  playerCard: {
    minHeight: 152,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: systemColors.border,
    borderRadius: 17,
    backgroundColor: systemColors.card,
  },
  playerCopy: {
    paddingLeft: 16,
    paddingTop: 16,
    paddingRight: 130,
    zIndex: 2,
  },
  eyebrow: {
    color: systemColors.textFaint,
    fontSize: 8,
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  greeting: {
    color: systemColors.textMuted,
    fontSize: 15,
  },
  playerName: {
    color: systemColors.text,
    fontSize: 26,
    fontWeight: "700",
    marginTop: 1,
  },
  motto: {
    color: systemColors.textMuted,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 8,
  },
  levelBlock: {
    position: "absolute",
    top: 25,
    right: 16,
    alignItems: "flex-end",
    zIndex: 2,
  },
  levelLabel: {
    color: systemColors.textMuted,
    fontSize: 9,
    letterSpacing: 2,
  },
  levelValue: {
    color: systemColors.accent,
    fontSize: 40,
    fontWeight: "700",
    lineHeight: 45,
    textShadowColor: glow(0.9),
    textShadowRadius: 10,
  },
  experienceTrack: {
    width: 87,
    marginTop: 3,
  },
  experienceText: {
    color: systemColors.textMuted,
    fontSize: 8,
    marginTop: 6,
  },
  landscape: {
    width: 140,
  },
  groupTitle: {
    color: systemColors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.4,
    marginBottom: 8,
    marginTop: 4,
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  quickAction: {
    flexGrow: 1,
    flexBasis: "46%",
    minHeight: 96,
    borderWidth: 1,
    borderColor: systemColors.border,
    borderRadius: 14,
    backgroundColor: systemColors.cardAlt,
    padding: 12,
    gap: 4,
  },
  quickIcon: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: systemColors.primary,
    marginBottom: 4,
  },
  quickLabel: {
    color: systemColors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  quickDetail: {
    color: systemColors.textMuted,
    fontSize: 11,
  },
  systemCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: systemColors.primary,
    borderRadius: 15,
    backgroundColor: systemColors.card,
    padding: 10,
  },
  systemImage: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1.5,
    borderColor: systemColors.accent,
  },
  systemCopy: {
    flex: 1,
    gap: 4,
  },
  systemTag: {
    color: systemColors.accent,
    fontSize: 9,
    letterSpacing: 1.5,
  },
  systemText: {
    color: systemColors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  missionProgress: {
    marginTop: 10,
  },
  helperText: {
    color: systemColors.textMuted,
    fontSize: 11,
    marginTop: 9,
    marginBottom: 9,
  },
  missionList: {
    gap: 4,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  summaryCard: {
    flexGrow: 1,
    flexBasis: "46%",
    minHeight: 92,
    borderWidth: 1,
    borderColor: systemColors.border,
    borderRadius: 13,
    backgroundColor: systemColors.card,
    padding: 12,
  },
  summaryLabel: {
    color: systemColors.textMuted,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  summaryValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
  },
  summaryValue: {
    color: systemColors.text,
    fontSize: 16,
    fontWeight: "500",
  },
  summaryDetail: {
    color: systemColors.textFaint,
    fontSize: 9,
    marginTop: 4,
    marginLeft: 32,
  },
  summaryTrack: {
    marginTop: 10,
  },
  progressCard: {
    minHeight: 116,
    overflow: "hidden",
    flexDirection: "row",
    borderWidth: 1,
    borderColor: systemColors.border,
    borderRadius: 15,
    backgroundColor: systemColors.card,
  },
  progressCardCopy: {
    flex: 1,
    justifyContent: "space-between",
    padding: 15,
    gap: 10,
    zIndex: 2,
  },
  progressQuote: {
    color: systemColors.text,
    fontSize: 12,
    lineHeight: 18,
    maxWidth: 230,
  },
  progressButton: {
    alignSelf: "flex-start",
    minHeight: 35,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: systemColors.border,
    borderRadius: 8,
    backgroundColor: systemColors.cardAlt,
  },
  progressButtonText: {
    color: systemColors.text,
    fontSize: 10,
    letterSpacing: 0.4,
  },
  arrow: {
    color: systemColors.accent,
    fontSize: 24,
    lineHeight: 24,
  },
  eventMotivationRow: {
    flexDirection: "row",
    gap: 8,
  },
  eventCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: systemColors.border,
    borderRadius: 15,
    backgroundColor: systemColors.card,
    padding: 13,
  },
  eventBody: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  eventTimeColumn: {
    borderLeftWidth: 3,
    borderLeftColor: systemColors.primary,
    paddingLeft: 8,
  },
  eventTime: {
    color: systemColors.textMuted,
    fontSize: 11,
  },
  eventTimeDivider: {
    color: systemColors.textFaint,
    fontSize: 9,
    lineHeight: 12,
  },
  eventInfo: {
    flex: 1,
    gap: 4,
  },
  eventTitle: {
    color: systemColors.text,
    fontSize: 12,
    fontWeight: "600",
  },
  eventLocation: {
    color: systemColors.textMuted,
    fontSize: 10,
  },
  eventDuration: {
    color: systemColors.accent,
    fontSize: 10,
    fontWeight: "600",
    marginTop: 4,
  },
  eventCategory: {
    alignSelf: "flex-start",
    color: systemColors.accent,
    fontSize: 8,
    backgroundColor: systemColors.primarySoft,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 3,
    overflow: "hidden",
  },
  noEvent: {
    color: systemColors.textMuted,
    fontSize: 11,
    marginTop: 12,
  },
  dayCard: {
    width: 110,
    minHeight: 128,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: systemColors.border,
    borderRadius: 15,
    backgroundColor: systemColors.cardAlt,
    padding: 13,
    justifyContent: "flex-end",
  },
  dayCardText: {
    color: systemColors.text,
    fontSize: 11,
    lineHeight: 17,
    letterSpacing: 1,
    zIndex: 2,
  },
  footerPrompt: {
    minHeight: 45,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  footerPromptText: {
    color: systemColors.textFaint,
    fontSize: 8,
    letterSpacing: 1.4,
  },
  footerPromptArrow: {
    color: systemColors.accent,
    fontSize: 15,
  },
  pressed: {
    opacity: 0.72,
  },
});
