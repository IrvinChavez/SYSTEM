import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SystemChat } from "@/components/system-chat";
import { Card, Chip, IconButton, PrimaryButton, Screen, SectionHeading } from "@/components/ui";
import { systemColors } from "@/constants/system-colors";
import { useDiscovery } from "@/context/discovery-context";
import { useOrganizer } from "@/context/organizer-context";
import { usePlayer } from "@/context/player-context";
import { Mission, StatKey, statInfo, statKeys, suggestedMissions } from "@/data/system-data";
import { syncInBackground } from "@/lib/confirm";
import { currentTime, toDateKey } from "@/lib/dates";
import { weakestStat } from "@/lib/leveling";
import { generateMissions, PlayerSnapshot } from "@/services/ai-service";
import { addMission } from "@/services/player-service";
import { fetchRandomQuote, Quote } from "@/services/quote-service";

function useQuote() {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [fromApi, setFromApi] = useState(true);
  const [loading, setLoading] = useState(true);

  const apply = (result: Awaited<ReturnType<typeof fetchRandomQuote>>) => {
    setQuote(result.quote);
    setFromApi(result.fromApi);
    setLoading(false);
  };

  const refresh = () => {
    setLoading(true);
    void fetchRandomQuote().then(apply);
  };

  useEffect(() => {
    let active = true;
    void fetchRandomQuote().then((result) => {
      if (active) apply(result);
    });
    return () => {
      active = false;
    };
  }, []);

  return { quote, fromApi, loading, refresh };
}

export default function SystemScreen() {
  const router = useRouter();
  const { uid, profile, missions, completedCount, streak, events, todayEvents, experience, experienceGoal, level, rank, weeklyProgress, loading: playerLoading, error: playerError } = usePlayer();
  const { tasks, projects, goals, loading: organizerLoading, error: organizerError } = useOrganizer();
  const { discovery, loading: discoveryLoading, error: discoveryError } = useDiscovery();
  const { quote, fromApi, loading: quoteLoading, refresh } = useQuote();
  // Inicio abre esta pantalla con ?prompt=…&t=<marca de tiempo> para preguntarle algo directo a la IA.
  const { prompt, t } = useLocalSearchParams<{ prompt?: string; t?: string }>();
  const weakest = weakestStat(profile.stats);
  const [focus, setFocus] = useState<StatKey | null>(null);
  const [aiMissions, setAiMissions] = useState<Omit<Mission, "id">[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const focusStat = focus ?? weakest;
  const pending = missions.filter((mission) => !mission.completed);
  const now = currentTime();
  const overdue = pending.filter((mission) => mission.time < now);
  const upcomingEvent = todayEvents.find((event) => event.start >= now);

  const analysis: string[] = [];
  if (missions.length === 0) {
    analysis.push("Aún no tienes hábitos activos. Puedes comenzar con uno pequeño y realista.");
  } else if (pending.length === 0) {
    analysis.push("Registraste todos tus hábitos de hoy. Considera cerrar el día o descansar.");
  } else {
    analysis.push(`Quedan ${pending.length} hábitos sin registrar hoy.`);
    if (overdue.length > 0) {
      analysis.push(`${overdue.length} ${overdue.length === 1 ? "hábito tenía" : "hábitos tenían"} una hora prevista anterior. Puedes moverlo o dejarlo para otro día.`);
    }
  }
  if (streak > 0) analysis.push(`Llevas ${streak} ${streak === 1 ? "día" : "días"} registrando hábitos. La racha es una referencia, no una obligación.`);
  const openTasks = tasks.filter((task) => task.status !== "completed");
  if (openTasks.length) analysis.push(`Hay ${openTasks.length} tareas abiertas. Prioriza una antes de añadir más.`);
  const activeProjects = projects.filter((project) => project.status === "active");
  if (activeProjects.length) analysis.push(`${activeProjects.length} proyectos activos; revisa que cada uno tenga un siguiente paso manejable.`);
  const activeGoals = goals.filter((goal) => goal.status === "active");
  if (activeGoals.length) analysis.push(`${activeGoals.length} metas activas en seguimiento.`);
  if (upcomingEvent) {
    analysis.push(`Próximo evento: ${upcomingEvent.title} a las ${upcomingEvent.start}.`);
  }

  const player: PlayerSnapshot = {
    name: profile.name,
    level,
    rank: `${rank.rank} (${rank.title})`,
    experience,
    experienceGoal,
    streak,
    weeklyProgress,
    stats: profile.stats,
    missions,
    events,
    tasks,
    projects,
    goals,
    ...(discovery?.completed && discovery.aiPersonalizationConsent ? { discovery } : {}),
    today: toDateKey(),
    currentTime: now,
  };

  const existingTitles = new Set(missions.map((mission) => mission.title.toLowerCase()));
  const suggestions = (aiMissions ?? suggestedMissions[focusStat]).filter((mission) => !existingTitles.has(mission.title.toLowerCase()));

  const changeFocus = (stat: StatKey) => {
    setFocus(stat);
    setAiMissions(null);
    setAiError(null);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setAiError(null);
    try {
      const generated = await generateMissions(player, focusStat);
      if (generated.length === 0) throw new Error("La IA no generó misiones válidas. Inténtalo de nuevo.");
      setAiMissions(generated);
    } catch (reason) {
      setAiError(reason instanceof Error ? reason.message : "Error de la IA.");
    } finally {
      setGenerating(false);
    }
  };

  const handleAdd = (mission: Omit<Mission, "id">) => {
    syncInBackground(addMission(uid, mission), "No se pudo agregar la misión.");
    // Quitamos la sugerencia ya agregada de la lista generada.
    setAiMissions((current) => current?.filter((item) => item.title !== mission.title) ?? null);
  };

  const contextError = playerError ?? organizerError ?? discoveryError;
  if (playerLoading || organizerLoading || discoveryLoading || contextError) {
    return (
      <Screen>
        <Card>
          <SectionHeading icon="sparkles-outline" title="ASISTENTE PERSONAL" />
          {contextError ? (
            <Text style={styles.error}>{contextError} El asistente esperará hasta tener el contexto sincronizado.</Text>
          ) : (
            <View style={styles.loadingState}>
              <ActivityIndicator color={systemColors.accent} />
              <Text style={styles.helper}>Sincronizando tus datos antes de planificar…</Text>
            </View>
          )}
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.heroTag}>ASISTENTE PERSONAL</Text>
        <Text style={styles.heroTitle}>Organiza con contexto</Text>
        <Text style={styles.heroText}>Comparte solo lo necesario. Las sugerencias no cambian tus datos hasta que las apruebes.</Text>
      </View>

      {!discovery?.completed ? (
        <Card style={styles.surveyCard}>
          <SectionHeading icon="heart-outline" title="PRIMERO, CONOZCAMOS TU RITMO" />
          <Text style={styles.surveyText}>Responde unas preguntas opcionales sobre tu rutina, objetivos y lo que quieres cuidar. Así podemos planificar contigo sin imponerte una rutina.</Text>
          <PrimaryButton label="EMPEZAR CUESTIONARIO" onPress={() => router.push("/onboarding")} />
        </Card>
      ) : (
        <Card style={styles.surveyCard}>
          <SectionHeading icon="heart-outline" title="TU FORMA DE PLANIFICAR" trailing={discovery.aiPersonalizationConsent ? "Personalización activa" : "Respuestas privadas"} />
          <Text style={styles.surveyText}>El asistente puede revisar tus objetivos y prioridades de cuidado. {discovery.aiPersonalizationConsent ? "La personalización con IA está autorizada." : "Tus respuestas no se envían a la IA mientras no lo autorices."}</Text>
          <PrimaryButton label="REVISAR CUESTIONARIO" variant="outline" onPress={() => router.push("/onboarding")} />
        </Card>
      )}

      <SystemChat player={player} questionnaireCompleted={Boolean(discovery?.completed)} autoPrompt={prompt && t ? { text: prompt, key: t } : undefined} />

      <Card style={styles.quoteCard}>
        <SectionHeading icon="✦" title="FRASE DEL DÍA" trailing={<IconButton icon="refresh" label="Otra frase" onPress={refresh} />} />
        {quoteLoading || !quote ? (
          <ActivityIndicator color={systemColors.accent} style={styles.quoteLoading} />
        ) : (
          <>
            <Text style={styles.quoteText}>“{quote.text}”</Text>
            <Text style={styles.quoteAuthor}>— {quote.author}</Text>
          </>
        )}
        <Text style={styles.source}>{fromApi ? "Fuente: API externa DummyJSON" : "Sin conexión con la API · frase local"}</Text>
      </Card>

      <Card>
        <SectionHeading icon="analytics-outline" title="RESUMEN DE HOY" trailing={`${completedCount}/${missions.length} hábitos`} />
        <View style={styles.analysis}>
          {analysis.map((line) => (
            <View key={line} style={styles.analysisRow}>
              <Text style={styles.bullet}>›</Text>
              <Text style={styles.analysisText}>{line}</Text>
            </View>
          ))}
        </View>
      </Card>

      <Card>
        <SectionHeading icon={statInfo[focusStat].icon} title="HÁBITOS SUGERIDOS" trailing={aiMissions ? "IA" : focusStat} />
        <Text style={styles.helper}>
          Sugerencias para {statInfo[focusStat].label.toLowerCase()}:
        </Text>
        <View style={styles.focusChips}>
          {statKeys.map((stat) => <Chip key={stat} label={stat} selected={stat === focusStat} onPress={() => changeFocus(stat)} />)}
        </View>
        <View style={styles.generate}>
          <PrimaryButton label={aiMissions ? "✦ GENERAR OTRAS" : "✦ GENERAR CON IA"} onPress={handleGenerate} loading={generating} />
        </View>
        {aiError ? <Text style={styles.error}>{aiError}</Text> : null}
        <View style={styles.suggestions}>
          {suggestions.length === 0 ? (
            <Text style={styles.helper}>{aiMissions ? "Ya agregaste todas. Genera otras." : "Ya tienes todas las sugerencias para esta área."}</Text>
          ) : suggestions.map((mission) => (
            <View key={mission.title} style={styles.suggestion}>
              <Text style={styles.suggestionIcon}>{mission.icon}</Text>
              <View style={styles.flex}>
                <Text style={styles.suggestionTitle}>{mission.title}</Text>
                <Text style={styles.suggestionMeta}>Hábito diario · {mission.time}</Text>
              </View>
              <View style={styles.addButton}>
                <PrimaryButton label="AGREGAR HÁBITO" variant="outline" onPress={() => handleAdd(mission)} />
              </View>
            </View>
          ))}
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderWidth: 1,
    borderColor: systemColors.border,
    borderRadius: 12,
    backgroundColor: systemColors.card,
    padding: 16,
    gap: 7,
  },
  heroTag: {
    color: systemColors.accent,
    fontSize: 10,
    letterSpacing: 2,
  },
  heroTitle: {
    color: systemColors.text,
    fontSize: 22,
    fontWeight: "600",
  },
  heroText: {
    color: systemColors.text,
    fontSize: 12,
    lineHeight: 18,
  },
  surveyCard: { gap: 9, backgroundColor: systemColors.backgroundRaised },
  surveyText: { color: systemColors.textMuted, fontSize: 12, lineHeight: 18 },
  quoteCard: {
    borderColor: systemColors.border,
  },
  quoteLoading: {
    marginVertical: 24,
  },
  loadingState: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 16 },
  quoteText: {
    color: systemColors.text,
    fontSize: 16,
    lineHeight: 24,
    fontStyle: "italic",
    marginTop: 12,
  },
  quoteAuthor: {
    color: systemColors.accent,
    fontSize: 12,
    marginTop: 8,
    textAlign: "right",
  },
  source: {
    color: systemColors.textFaint,
    fontSize: 9,
    letterSpacing: 0.6,
    marginTop: 12,
  },
  analysis: {
    gap: 8,
    marginTop: 10,
  },
  analysisRow: {
    flexDirection: "row",
    gap: 8,
  },
  bullet: {
    color: systemColors.accent,
    fontSize: 14,
    lineHeight: 18,
  },
  analysisText: {
    flex: 1,
    color: systemColors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  helper: {
    color: systemColors.textMuted,
    fontSize: 11,
    marginTop: 8,
  },
  suggestions: {
    gap: 6,
    marginTop: 10,
  },
  suggestion: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 9,
    padding: 8,
    backgroundColor: systemColors.backgroundRaised,
  },
  suggestionIcon: {
    color: systemColors.accent,
    fontSize: 18,
    width: 24,
    textAlign: "center",
  },
  flex: {
    flex: 1,
  },
  suggestionTitle: {
    color: systemColors.text,
    fontSize: 13,
  },
  suggestionMeta: {
    color: systemColors.textFaint,
    fontSize: 10,
    marginTop: 2,
  },
  focusChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  generate: {
    marginTop: 10,
  },
  error: {
    color: systemColors.danger,
    fontSize: 12,
    marginTop: 8,
  },
  addButton: {
    width: 142,
  },
});
