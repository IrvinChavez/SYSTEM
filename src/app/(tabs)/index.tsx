import { useRouter } from "expo-router";
import { useMemo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Avatar } from "@/components/avatar";
import { MissionRow } from "@/components/mission-row";
import { ActionPill, EmptyState, Icon, ProgressBar, Screen } from "@/components/ui";
import { systemColors } from "@/constants/system-colors";
import { useDiscovery } from "@/context/discovery-context";
import { useOrganizer } from "@/context/organizer-context";
import { usePlayer } from "@/context/player-context";
import { PersonalTask } from "@/data/system-data";
import { toDateKey } from "@/lib/dates";
import { syncInBackground } from "@/lib/confirm";
import { updateTask } from "@/services/organizer-service";

function PanelHeading({ title, icon, trailing }: { title: string; icon: "checkmark-circle-outline" | "calendar-outline" | "repeat-outline" | "folder-outline" | "time-outline"; trailing?: React.ReactNode }) {
  return (
    <View style={styles.panelHeading}>
      <View style={styles.panelTitleGroup}>
        <Icon name={icon} size={16} color={systemColors.textMuted} />
        <Text style={styles.panelTitle}>{title}</Text>
      </View>
      {trailing}
    </View>
  );
}

function StatTile({ label, value, detail, progress, icon }: { label: string; value: string; detail: string; progress: number; icon: "checkmark-done-outline" | "folder-outline" | "repeat-outline" | "calendar-outline" }) {
  return (
    <View style={styles.statTile}>
      <View style={styles.statTop}>
        <Text style={styles.statLabel}>{label}</Text>
        <Icon name={icon} size={16} color={systemColors.textFaint} />
      </View>
      <View style={styles.statBottom}>
        <Text style={styles.statValue}>{value}</Text>
        <View style={styles.statProgress}>
          <Text style={styles.statDetail}>{detail}</Text>
          <ProgressBar progress={progress} height={4} />
        </View>
      </View>
    </View>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <Text style={styles.emptyLine}>{text}</Text>;
}

function ToolLink({ icon, label, onPress }: { icon: "folder-outline" | "flag-outline" | "document-text-outline" | "sparkles-outline"; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.toolLink, pressed && styles.pressed]}>
      <Icon name={icon} size={17} color={systemColors.accent} />
      <Text style={styles.toolLabel}>{label}</Text>
      <Icon name="chevron-forward" size={14} color={systemColors.textFaint} />
    </Pressable>
  );
}

function TaskLine({ task, onPress }: { task: PersonalTask; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.taskLine, pressed && styles.pressed]}>
      <View style={[styles.priorityMark, task.priority === "high" && styles.priorityMarkHigh, task.priority === "normal" && styles.priorityMarkNormal]}>
        <Text style={styles.priorityMarkText}>{task.priority === "high" ? "!" : task.priority === "normal" ? "·" : "○"}</Text>
      </View>
      <View style={styles.taskCopy}>
        <Text style={styles.taskTitle} numberOfLines={2}>{task.title}</Text>
        <Text style={styles.taskMeta} numberOfLines={1}>
          {task.dueDate ? task.dueDate : task.projectId ? "Proyecto" : "Sin fecha límite"}
        </Text>
      </View>
      <Icon name="chevron-forward" size={16} color={systemColors.textFaint} />
    </Pressable>
  );
}

function EventLine({ title, start, end, category, onPress }: { title: string; start: string; end: string; category: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.eventLine, pressed && styles.pressed]}>
      <Text style={styles.eventTime}>{start}</Text>
      <View style={styles.eventRail}><View style={styles.eventDot} /></View>
      <View style={styles.eventCopy}>
        <Text style={styles.eventTitle} numberOfLines={1}>{title}</Text>
        <Text style={styles.eventMeta}>{end} · {category.toLocaleLowerCase("es-MX")}</Text>
      </View>
      <View style={styles.eventTag}><Text style={styles.eventTagText}>{category}</Text></View>
    </Pressable>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { loading: playerLoading, error: playerError, profile, missions, completedCount, todayEvents, events, weeklyProgress } = usePlayer();
  const { uid: taskOwner, loading: organizerLoading, error: organizerError, tasks, projects } = useOrganizer();
  const { discovery, loading: discoveryLoading } = useDiscovery();
  const todayKey = toDateKey();
  const now = new Date();
  const date = new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "long" }).format(now);
  const openTasks = useMemo(() => tasks.filter((task) => task.status !== "completed"), [tasks]);
  const priorities = useMemo(
    () => openTasks.filter((task) => task.priority === "high").slice(0, 3),
    [openTasks],
  );
  const priorityIds = new Set(priorities.map((task) => task.id));
  const remainingTasks = openTasks.filter((task) => !priorityIds.has(task.id)).slice(0, 4);
  const activeProjects = projects.filter((project) => project.status === "active");
  const minuteNow = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const nextEvent = events.find((event) => event.date > todayKey || (event.date === todayKey && event.end > minuteNow));
  const columns = width >= 1360 ? 3 : width >= 960 ? 2 : 1;
  const panelWidth = columns === 1 ? "100%" : columns === 2 ? "48%" : "30.5%";
  const compactStats = width < 1260;

  if ((playerLoading || organizerLoading) && !playerError && !organizerError) {
    return <View style={styles.loading}><ActivityIndicator color={systemColors.accent} size="large" /><Text style={styles.loadingText}>Sincronizando tu espacio…</Text></View>;
  }

  const goToTasks = () => router.navigate("/tasks");
  const completeTask = (task: PersonalTask) => {
    syncInBackground(updateTask(taskOwner, task.id, {
      title: task.title,
      description: task.description,
      status: "completed",
      priority: task.priority,
      dueDate: task.dueDate,
      estimateMinutes: task.estimateMinutes,
      projectId: task.projectId,
    }), "No se pudo completar la tarea.");
  };

  const completionRate = openTasks.length + tasks.filter((task) => task.status === "completed").length
    ? tasks.filter((task) => task.status === "completed").length / tasks.length
    : 0;
  const habitsRate = missions.length ? completedCount / missions.length : 0;

  return (
    <Screen>
      <View style={styles.topbar}>
        <View style={styles.brandGroup}>
          <View style={styles.brandMark}><Icon name="layers-outline" size={17} color={systemColors.accent} /></View>
          <Text style={styles.brand}>SYSTEM</Text>
        </View>
        <View style={styles.topbarRight}>
          <View style={styles.dateBadge}>
            <Text style={styles.dateDay}>{date}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Abrir perfil" onPress={() => router.navigate("/profile")}>
            <Avatar photo={profile.photo} size={38} />
          </Pressable>
        </View>
      </View>

      <View style={styles.intro}>
        <Text style={styles.title}>Hola, {profile.name} <Text style={styles.wave}>👋</Text></Text>
        <Text style={styles.subtitle}>Disciplina hoy, resultados mañana.</Text>
      </View>

      {!discoveryLoading && !discovery?.completed ? (
        <Pressable accessibilityRole="button" onPress={() => router.navigate("/onboarding")} style={({ pressed }) => [styles.discoveryBanner, pressed && styles.pressed]}>
          <View style={styles.discoveryIcon}><Icon name="heart-outline" size={18} color={systemColors.accent} /></View>
          <View style={styles.discoveryCopy}>
            <Text style={styles.discoveryTitle}>Hagamos un plan a tu medida</Text>
            <Text style={styles.discoveryText}>Cuéntanos sobre tu rutina, objetivos y lo que quieres cuidar.</Text>
          </View>
          <Icon name="chevron-forward" size={17} color={systemColors.textMuted} />
        </Pressable>
      ) : null}

      {playerError || organizerError ? <Text style={styles.error}>{playerError ?? organizerError}</Text> : null}

      <View style={[styles.stats, compactStats && styles.statsCompact]}>
        <StatTile
          label="TAREAS ABIERTAS"
          value={`${openTasks.length}`}
          detail={`${tasks.length ? Math.round(completionRate * 100) : 0}% completadas`}
          progress={completionRate}
          icon="checkmark-done-outline"
        />
        <StatTile
          label="PROYECTOS ACTIVOS"
          value={`${activeProjects.length}`}
          detail={`${projects.length} en total`}
          progress={projects.length ? activeProjects.length / projects.length : 0}
          icon="folder-outline"
        />
        <StatTile
          label="HÁBITOS DE HOY"
          value={`${completedCount} / ${missions.length}`}
          detail={`${Math.round(habitsRate * 100)}% del día`}
          progress={habitsRate}
          icon="repeat-outline"
        />
        <StatTile
          label="AGENDA DE HOY"
          value={`${todayEvents.length}`}
          detail={todayEvents.length === 1 ? "actividad" : "actividades"}
          progress={todayEvents.length ? 1 : 0}
          icon="calendar-outline"
        />
      </View>

      <View style={styles.panelGrid}>
        <View style={[styles.panel, { width: panelWidth }, styles.nextPanel]}>
          <View style={styles.nextPanelTop}>
            <View>
              <Text style={styles.panelEyebrow}>SIGUIENTE EN TU DÍA</Text>
              <Text style={styles.nextTime}>{nextEvent ? `${nextEvent.start} — ${nextEvent.end}` : "Tu espacio, a tu ritmo"}</Text>
            </View>
            <View style={styles.nextIcon}><Icon name="time-outline" size={20} color={systemColors.accent} /></View>
          </View>
          <Text style={styles.nextTitle}>{nextEvent?.title ?? "No hay actividades próximas"}</Text>
          <View style={styles.nextBottom}>
            <Text style={styles.nextMeta}>{nextEvent ? `${nextEvent.category.toLocaleLowerCase("es-MX")} · ${nextEvent.location || "Sin ubicación"}` : "Puedes agregar un compromiso a tu planificación."}</Text>
            <Pressable accessibilityRole="button" onPress={() => router.navigate("/agenda")} style={styles.inlineLink}>
              <Text style={styles.link}>Planificar</Text>
              <Icon name="arrow-forward" size={14} color={systemColors.accent} />
            </Pressable>
          </View>
        </View>

        <View style={[styles.panel, { width: panelWidth }]}>
          <PanelHeading title="PRIORIDADES DE HOY" icon="checkmark-circle-outline" trailing={<Text style={styles.panelCount}>{priorities.length} altas</Text>} />
          {priorities.length ? priorities.map((task) => (
            <View key={task.id} style={styles.priorityRow}>
              <TaskLine task={task} onPress={goToTasks} />
              <Pressable
                accessibilityRole="checkbox"
                accessibilityLabel={`Completar ${task.title}`}
                accessibilityState={{ checked: false }}
                hitSlop={8}
                onPress={() => completeTask(task)}
                style={styles.completeButton}
              >
                <Icon name="checkmark" size={14} color={systemColors.textMuted} />
              </Pressable>
            </View>
          )) : (
            <EmptyState icon="checkmark-done-outline" title="Sin prioridades altas" text="Tus pendientes importantes aparecerán aquí." />
          )}
          <ActionPill icon="add" label="Agregar prioridad" onPress={() => router.navigate({ pathname: "/tasks", params: { nuevo: String(Date.now()) } })} />
        </View>

        <View style={[styles.panel, { width: panelWidth }]}>
          <PanelHeading
            title="PLAN DE HOY"
            icon="calendar-outline"
            trailing={<Pressable accessibilityRole="button" onPress={() => router.navigate("/agenda")}><Text style={styles.link}>Ver agenda →</Text></Pressable>}
          />
          {todayEvents.length ? (
            <View style={styles.events}>
              {todayEvents.slice(0, 5).map((event) => (
                <EventLine key={event.id} title={event.title} start={event.start} end={event.end} category={event.category} onPress={() => router.navigate("/agenda")} />
              ))}
            </View>
          ) : <EmptyLine text="No tienes compromisos para hoy." />}
        </View>

        <View style={[styles.panel, { width: panelWidth }]}>
          <PanelHeading
            title="TAREAS PENDIENTES"
            icon="checkmark-circle-outline"
            trailing={<Pressable accessibilityRole="button" onPress={goToTasks}><Text style={styles.link}>Ver todas →</Text></Pressable>}
          />
          {remainingTasks.length ? remainingTasks.map((task) => <TaskLine key={task.id} task={task} onPress={goToTasks} />) : (
            <EmptyLine text={openTasks.length ? "Tus prioridades cubren lo pendiente por ahora." : "No tienes tareas pendientes."} />
          )}
          <Pressable accessibilityRole="button" onPress={goToTasks} style={styles.panelFooter}>
            <Text style={styles.footerLink}>{openTasks.length} tareas abiertas</Text>
            <Icon name="arrow-forward" size={14} color={systemColors.accent} />
          </Pressable>
        </View>

        <View style={[styles.panel, { width: panelWidth }]}>
          <PanelHeading
            title="HÁBITOS DE HOY"
            icon="repeat-outline"
            trailing={<Pressable accessibilityRole="button" onPress={() => router.navigate("/missions")}><Text style={styles.link}>Ver todos →</Text></Pressable>}
          />
          <View style={styles.habitSummary}>
            <Text style={styles.habitNumbers}>{completedCount}<Text style={styles.habitTotal}> / {missions.length}</Text></Text>
            <Text style={styles.habitDetail}>{Math.round(weeklyProgress * 100)}% de constancia esta semana</Text>
          </View>
          <ProgressBar progress={habitsRate} height={5} />
          {missions.length ? (
            <View style={styles.habitList}>{missions.slice(0, 4).map((mission) => <MissionRow key={mission.id} mission={mission} />)}</View>
          ) : <EmptyLine text="Agrega un hábito pequeño y sostenible." />}
        </View>

        <View style={[styles.panel, { width: panelWidth }]}>
          <PanelHeading
            title="PROYECTOS EN CURSO"
            icon="folder-outline"
            trailing={<Pressable accessibilityRole="button" onPress={() => router.navigate("/projects")}><Text style={styles.link}>Ver todos →</Text></Pressable>}
          />
          {activeProjects.length ? (
            <View style={styles.projects}>
              {activeProjects.slice(0, 4).map((project) => (
                <Pressable key={project.id} accessibilityRole="button" onPress={() => router.navigate("/projects")} style={({ pressed }) => [styles.projectLine, pressed && styles.pressed]}>
                  <View style={styles.projectIcon}><Icon name="folder-open-outline" size={17} color={systemColors.accent} /></View>
                  <View style={styles.projectCopy}>
                    <Text style={styles.projectTitle} numberOfLines={1}>{project.title}</Text>
                    <Text style={styles.projectAction} numberOfLines={2}>{project.nextAction || project.purpose}</Text>
                  </View>
                  <Icon name="chevron-forward" size={16} color={systemColors.textFaint} />
                </Pressable>
              ))}
            </View>
          ) : <EmptyLine text="Tus proyectos activos aparecerán aquí." />}
          <ActionPill icon="add" label="Crear proyecto" onPress={() => router.navigate("/projects")} />
        </View>

        {width < 920 ? (
          <View style={[styles.panel, styles.toolsPanel, { width: panelWidth }]}>
            <PanelHeading title="MÁS ESPACIOS" icon="folder-outline" />
            <View style={styles.toolGrid}>
              <ToolLink icon="folder-outline" label="Proyectos" onPress={() => router.navigate("/projects")} />
              <ToolLink icon="flag-outline" label="Metas" onPress={() => router.navigate("/goals")} />
              <ToolLink icon="document-text-outline" label="Notas" onPress={() => router.navigate("/notes")} />
              <ToolLink icon="sparkles-outline" label="Asistente" onPress={() => router.navigate("/system")} />
            </View>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: systemColors.background },
  loadingText: { color: systemColors.textMuted, fontSize: 13 },
  topbar: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brandGroup: { flexDirection: "row", alignItems: "center", gap: 9 },
  brandMark: { width: 30, height: 30, alignItems: "center", justifyContent: "center", borderRadius: 9, backgroundColor: systemColors.cardAlt },
  brand: { color: systemColors.text, fontSize: 13, fontWeight: "700", letterSpacing: 1.8 },
  topbarRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  dateBadge: { borderWidth: 1, borderColor: systemColors.border, borderRadius: 9, backgroundColor: systemColors.backgroundRaised, paddingHorizontal: 10, paddingVertical: 7 },
  dateDay: { color: systemColors.textMuted, fontSize: 11, textTransform: "capitalize" },
  intro: { gap: 4, paddingTop: 9, paddingBottom: 15 },
  title: { color: systemColors.text, fontSize: 27, fontWeight: "600" },
  wave: { fontSize: 23 },
  subtitle: { color: systemColors.textMuted, fontSize: 13 },
  discoveryBanner: { minHeight: 65, flexDirection: "row", alignItems: "center", gap: 11, borderWidth: 1, borderColor: systemColors.border, borderRadius: 11, backgroundColor: systemColors.backgroundRaised, paddingHorizontal: 12, marginBottom: 10 },
  discoveryIcon: { width: 35, height: 35, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: systemColors.surfaceActive },
  discoveryCopy: { flex: 1, gap: 4 },
  discoveryTitle: { color: systemColors.text, fontSize: 12, fontWeight: "600" },
  discoveryText: { color: systemColors.textMuted, fontSize: 10, lineHeight: 15 },
  error: { color: systemColors.danger, fontSize: 13, marginBottom: 10 },
  stats: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 10, marginBottom: 10 },
  statsCompact: { justifyContent: "flex-start" },
  statTile: { flexGrow: 1, flexBasis: "23%", minWidth: 135, minHeight: 79, borderWidth: 1, borderColor: systemColors.borderMuted, borderRadius: 11, backgroundColor: systemColors.backgroundRaised, padding: 11 },
  statTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 5 },
  statLabel: { color: systemColors.textMuted, fontSize: 9, fontWeight: "700", letterSpacing: 0.75 },
  statBottom: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 9, marginTop: 6 },
  statValue: { color: systemColors.text, fontSize: 20, fontWeight: "600", fontVariant: ["tabular-nums"] },
  statProgress: { flex: 1, maxWidth: 94, gap: 5, paddingBottom: 3 },
  statDetail: { color: systemColors.textFaint, fontSize: 9, textAlign: "right" },
  panelGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10, columnGap: 0 },
  panel: { borderWidth: 1, borderColor: systemColors.borderMuted, borderRadius: 12, backgroundColor: systemColors.card, padding: 13 },
  nextPanel: { backgroundColor: systemColors.cardAlt },
  nextPanelTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  panelEyebrow: { color: systemColors.textMuted, fontSize: 9, fontWeight: "700", letterSpacing: 1.1 },
  nextTime: { color: systemColors.accent, fontSize: 12, fontWeight: "600", marginTop: 5 },
  nextIcon: { width: 35, height: 35, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: systemColors.surfaceActive },
  nextTitle: { color: systemColors.text, fontSize: 18, fontWeight: "600", marginTop: 11 },
  nextBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 10 },
  nextMeta: { flex: 1, color: systemColors.textMuted, fontSize: 11, lineHeight: 16 },
  inlineLink: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 5 },
  panelHeading: { minHeight: 24, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 },
  panelTitleGroup: { flexDirection: "row", alignItems: "center", gap: 7, flexShrink: 1 },
  panelTitle: { color: systemColors.text, fontSize: 11, fontWeight: "700", letterSpacing: 0.6 },
  panelCount: { color: systemColors.textFaint, fontSize: 10 },
  link: { color: systemColors.accent, fontSize: 10, fontWeight: "600" },
  priorityRow: { flexDirection: "row", alignItems: "center", gap: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: systemColors.borderMuted },
  taskLine: { minHeight: 48, flex: 1, flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 5 },
  priorityMark: { width: 24, height: 24, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: systemColors.backgroundRaised },
  priorityMarkHigh: { backgroundColor: "#46363A" },
  priorityMarkNormal: { backgroundColor: "#3A392F" },
  priorityMarkText: { color: systemColors.textMuted, fontSize: 13, fontWeight: "700" },
  taskCopy: { flex: 1, gap: 3 },
  taskTitle: { color: systemColors.text, fontSize: 12, lineHeight: 17 },
  taskMeta: { color: systemColors.textFaint, fontSize: 10 },
  completeButton: { width: 30, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 8 },
  events: { gap: 0 },
  eventLine: { minHeight: 45, flexDirection: "row", alignItems: "center", gap: 8 },
  eventTime: { color: systemColors.textMuted, width: 42, fontSize: 10, fontVariant: ["tabular-nums"] },
  eventRail: { width: 9, alignSelf: "stretch", alignItems: "center", justifyContent: "center" },
  eventDot: { width: 5, height: 5, borderWidth: 1, borderColor: systemColors.accent, borderRadius: 3, backgroundColor: systemColors.card },
  eventCopy: { flex: 1, gap: 3, borderLeftWidth: 2, borderLeftColor: systemColors.border, paddingLeft: 8 },
  eventTitle: { color: systemColors.text, fontSize: 11, fontWeight: "500" },
  eventMeta: { color: systemColors.textFaint, fontSize: 9, textTransform: "capitalize" },
  eventTag: { borderRadius: 6, backgroundColor: systemColors.backgroundRaised, paddingHorizontal: 6, paddingVertical: 4 },
  eventTagText: { color: systemColors.textMuted, fontSize: 8, fontWeight: "600" },
  emptyLine: { color: systemColors.textMuted, fontSize: 12, lineHeight: 18, paddingVertical: 11 },
  panelFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: systemColors.borderMuted, marginTop: 5, paddingTop: 9 },
  footerLink: { color: systemColors.textMuted, fontSize: 10 },
  habitSummary: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 7 },
  habitNumbers: { color: systemColors.text, fontSize: 19, fontWeight: "600" },
  habitTotal: { color: systemColors.textMuted, fontSize: 12, fontWeight: "400" },
  habitDetail: { color: systemColors.textMuted, fontSize: 10 },
  habitList: { gap: 5, marginTop: 10 },
  projects: { gap: 3 },
  projectLine: { minHeight: 50, flexDirection: "row", alignItems: "center", gap: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: systemColors.borderMuted, paddingVertical: 5 },
  projectIcon: { width: 30, height: 30, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: systemColors.backgroundRaised },
  projectCopy: { flex: 1, gap: 3 },
  projectTitle: { color: systemColors.text, fontSize: 12, fontWeight: "600" },
  projectAction: { color: systemColors.textMuted, fontSize: 10, lineHeight: 14 },
  toolsPanel: { backgroundColor: systemColors.backgroundRaised },
  toolGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 6 },
  toolLink: { width: "48%", minHeight: 42, flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 8, backgroundColor: systemColors.card, paddingHorizontal: 9 },
  toolLabel: { flex: 1, color: systemColors.text, fontSize: 11 },
  pressed: { opacity: 0.72 },
});
