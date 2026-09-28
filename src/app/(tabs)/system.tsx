import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SystemChat } from "@/components/system-chat";
import { Card, Chip, IconButton, PrimaryButton, Screen, SectionHeading } from "@/components/ui";
import { systemColors } from "@/constants/system-colors";
import { usePlayer } from "@/context/player-context";
import { Mission, StatKey, statInfo, statKeys, suggestedMissions } from "@/data/system-data";
import { syncInBackground } from "@/lib/confirm";
import { currentTime, toDateKey } from "@/lib/dates";
import { weakestStat } from "@/lib/leveling";
import { generateMissions, PlayerSnapshot } from "@/services/ai-service";
import { addMission } from "@/services/player-service";
import { fetchRandomQuote, Quote } from "@/services/quote-service";

const monarch = require("@/assets/images/system-monarch.png");

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
  const { uid, profile, missions, completedCount, streak, events, todayEvents, experience, experienceGoal, level, rank, weeklyProgress } = usePlayer();
  const { quote, fromApi, loading, refresh } = useQuote();
  // Inicio abre esta pantalla con ?prompt=…&t=<marca de tiempo> para preguntarle algo directo a la IA.
  const { prompt, t } = useLocalSearchParams<{ prompt?: string; t?: string }>();
  const weakest = weakestStat(profile.stats);
  const [focus, setFocus] = useState<StatKey | null>(null);
  const [aiMissions, setAiMissions] = useState<Omit<Mission, "id">[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const focusStat = focus ?? weakest;
  const pending = missions.filter((mission) => !mission.completed);
  const pendingXp = pending.reduce((total, mission) => total + mission.xp, 0);
  const now = currentTime();
  const overdue = pending.filter((mission) => mission.time < now);
  const upcomingEvent = todayEvents.find((event) => event.start >= now);

  const analysis: string[] = [];
  if (missions.length === 0) {
    analysis.push("No tienes misiones activas. Agrega al menos una para comenzar a subir de nivel.");
  } else if (pending.length === 0) {
    analysis.push("Misión diaria completada. El Sistema reconoce tu disciplina.");
  } else {
    analysis.push(`Quedan ${pending.length} misiones pendientes con ${pendingXp} EXP disponibles.`);
    if (pendingXp >= experienceGoal - experience) {
      analysis.push("Si completas lo pendiente de hoy, subirás de nivel.");
    }
    if (overdue.length > 0) {
      analysis.push(`${overdue.length} ${overdue.length === 1 ? "misión ya pasó" : "misiones ya pasaron"} de su hora: ${overdue.map((mission) => mission.title).join(", ")}.`);
    }
  }
  analysis.push(streak > 0
    ? `Racha actual: ${streak} ${streak === 1 ? "día perfecto" : "días perfectos"}. No la rompas.`
    : "Aún no tienes racha. Completa todas tus misiones hoy para iniciarla.");
  analysis.push(`Tu estadística más baja es ${statInfo[weakest].label} (${profile.stats[weakest]}). ${statInfo[weakest].description}.`);
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

  return (
    <Screen>
      <View style={styles.hero}>
        <Image source={monarch} style={styles.heroImage} contentFit="cover" contentPosition="top" />
        <View style={styles.heroShade} />
        <View style={styles.heroCopy}>
          <Text style={styles.heroTag}>[ EL SISTEMA ]</Text>
          <Text style={styles.heroTitle}>Monarca del Sistema</Text>
          <Text style={styles.heroText}>Cuéntale tus planes y acomodará tus misiones y tu agenda.</Text>
        </View>
      </View>

      <SystemChat player={player} autoPrompt={prompt && t ? { text: prompt, key: t } : undefined} />

      <Card style={styles.quoteCard}>
        <SectionHeading icon="✦" title="FRASE DEL DÍA" trailing={<IconButton icon="refresh" label="Otra frase" onPress={refresh} />} />
        {loading || !quote ? (
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
        <SectionHeading icon="◉" title="ANÁLISIS DEL SISTEMA" trailing={`${completedCount}/${missions.length}`} />
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
        <SectionHeading icon={statInfo[focusStat].icon} title="MISIONES SUGERIDAS" trailing={aiMissions ? "IA ✦" : focusStat} />
        <Text style={styles.helper}>
          Entrenar {statInfo[focusStat].label.toLowerCase()}{focusStat === weakest ? " (tu estadística más baja)" : ""}:
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
            <Text style={styles.helper}>{aiMissions ? "Ya agregaste todas. Genera otras." : "Ya tienes todas las sugerencias para esta estadística."}</Text>
          ) : suggestions.map((mission) => (
            <View key={mission.title} style={styles.suggestion}>
              <Text style={styles.suggestionIcon}>{mission.icon}</Text>
              <View style={styles.flex}>
                <Text style={styles.suggestionTitle}>{mission.title}</Text>
                <Text style={styles.suggestionMeta}>{mission.time} · +{mission.xp} EXP</Text>
              </View>
              <View style={styles.addButton}>
                <PrimaryButton label="AGREGAR" variant="outline" onPress={() => handleAdd(mission)} />
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
    height: 190,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: systemColors.primary,
    borderRadius: 17,
    backgroundColor: systemColors.card,
    marginTop: 8,
  },
  heroImage: {
    ...StyleSheet.absoluteFill,
  },
  heroShade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(5, 7, 11, 0.35)",
  },
  heroCopy: {
    flex: 1,
    justifyContent: "flex-end",
    padding: 16,
  },
  heroTag: {
    color: systemColors.accent,
    fontSize: 10,
    letterSpacing: 2,
  },
  heroTitle: {
    color: systemColors.text,
    fontSize: 22,
    fontWeight: "700",
    marginTop: 4,
    textShadowColor: "#000",
    textShadowRadius: 8,
  },
  heroText: {
    color: systemColors.text,
    fontSize: 12,
    marginTop: 4,
    textShadowColor: "#000",
    textShadowRadius: 6,
  },
  quoteCard: {
    borderColor: systemColors.primary,
  },
  quoteLoading: {
    marginVertical: 24,
  },
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
    width: 100,
  },
});
