import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { FieldGroup, FormSheet } from "@/components/form-sheet";
import { ActionPill, Card, Chip, EmptyState, IconButton, PrimaryButton, Screen, ScreenHeader, TextField } from "@/components/ui";
import { systemColors } from "@/constants/system-colors";
import { useOrganizer } from "@/context/organizer-context";
import { PersonalProject, ProjectStatus } from "@/data/system-data";
import { confirmAction, syncInBackground } from "@/lib/confirm";
import { addProject, deleteProject, updateProject } from "@/services/organizer-service";
import { useRouter } from "expo-router";
import { isValidDateKey } from "@/lib/dates";

type ProjectDraft = Omit<PersonalProject, "id">;
const blankProject: ProjectDraft = { title: "", purpose: "", status: "active", nextAction: "", deadline: null };
const labels: Record<ProjectStatus, string> = { active: "En curso", paused: "En pausa", blocked: "Bloqueado", completed: "Completado" };

function validDate(value: string) {
  return !value || isValidDateKey(value);
}

export default function ProjectsScreen() {
  const router = useRouter();
  const { uid, projects, tasks, loading, error } = useOrganizer();
  const [visible, setVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProjectDraft>(blankProject);
  const [deadline, setDeadline] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const openNew = () => { setEditingId(null); setDraft(blankProject); setDeadline(""); setFormError(null); setVisible(true); };
  const openEdit = (project: PersonalProject) => {
    const { id, ...value } = project;
    setEditingId(id); setDraft(value); setDeadline(value.deadline ?? ""); setFormError(null); setVisible(true);
  };
  const save = () => {
    const title = draft.title.trim();
    if (!title) return setFormError("Escribe un nombre para el proyecto.");
    if (!validDate(deadline)) return setFormError("Usa una fecha válida con formato AAAA-MM-DD.");
    const value = { ...draft, title, purpose: draft.purpose.trim(), nextAction: draft.nextAction.trim(), deadline: deadline || null };
    syncInBackground(editingId ? updateProject(uid, editingId, value) : addProject(uid, value), "No se pudo guardar el proyecto.");
    setVisible(false);
  };
  const remove = (project: PersonalProject) => confirmAction(
    "Eliminar proyecto",
    `Las tareas asociadas se conservarán sin proyecto. ¿Eliminar "${project.title}"?`,
    "Eliminar",
    () => syncInBackground(deleteProject(uid, project.id), "No se pudo eliminar el proyecto."),
  );

  return (
    <Screen>
      <ScreenHeader title="Proyectos" subtitle="Define el resultado esperado y el siguiente paso." action={<ActionPill icon="add" label="Nuevo" onPress={openNew} />} />
      {error ? <Text style={styles.notice}>{error}</Text> : null}
      {loading ? <Text style={styles.notice}>Sincronizando tus proyectos…</Text> : null}
      {projects.length === 0 ? (
        <Card><EmptyState icon="folder-open-outline" title="Todavía no hay proyectos" text="Empieza con un resultado concreto y una acción pequeña. Puedes pausar un proyecto cuando tu capacidad esté llena." /></Card>
      ) : projects.map((project) => (
        <Card key={project.id} style={styles.projectCard}>
          <View style={styles.projectHeader}>
            <View style={styles.projectCopy}>
              <Text style={styles.title}>{project.title}</Text>
              <Text style={styles.status}>{labels[project.status]}</Text>
            </View>
            <View style={styles.actions}>
              <IconButton icon="create-outline" label={`Editar ${project.title}`} onPress={() => openEdit(project)} />
              <IconButton icon="trash-outline" label={`Eliminar ${project.title}`} onPress={() => remove(project)} color={systemColors.danger} />
            </View>
          </View>
          {project.purpose ? <Text style={styles.body}>{project.purpose}</Text> : null}
          <View style={styles.nextAction}>
            <Text style={styles.label}>SIGUIENTE ACCIÓN</Text>
            <Text style={styles.body}>{project.nextAction || "Aún no definida"}</Text>
          </View>
          <View style={styles.footer}>
            {project.deadline ? <Text style={styles.meta}>Fecha: {project.deadline}</Text> : <Text style={styles.meta}>Sin fecha límite</Text>}
            <Text style={styles.meta}>{tasks.filter((task) => task.projectId === project.id && task.status !== "completed").length} tareas abiertas</Text>
          </View>
        </Card>
      ))}
      <PrimaryButton label="VER TAREAS" variant="outline" onPress={() => router.navigate("/tasks")} />
      <FormSheet visible={visible} title={editingId ? "Editar proyecto" : "Nuevo proyecto"} onClose={() => setVisible(false)}>
        <TextField label="NOMBRE" value={draft.title} onChangeText={(title) => setDraft({ ...draft, title })} placeholder="Resultado o proyecto" maxLength={120} />
        <TextField label="RESULTADO ESPERADO" value={draft.purpose} onChangeText={(purpose) => setDraft({ ...draft, purpose })} placeholder="¿Qué significa terminarlo?" multiline maxLength={1200} />
        <TextField label="SIGUIENTE ACCIÓN" value={draft.nextAction} onChangeText={(nextAction) => setDraft({ ...draft, nextAction })} placeholder="Un paso ejecutable" maxLength={300} />
        <FieldGroup label="ESTADO">
          {(["active", "paused", "blocked", "completed"] as const).map((status) => <Chip key={status} label={labels[status]} selected={draft.status === status} onPress={() => setDraft({ ...draft, status })} />)}
        </FieldGroup>
        <TextField label="FECHA LÍMITE OPCIONAL · AAAA-MM-DD" value={deadline} onChangeText={setDeadline} placeholder="Sin fecha definida" maxLength={10} />
        {formError ? <Text style={styles.error}>{formError}</Text> : null}
        <PrimaryButton label={editingId ? "GUARDAR CAMBIOS" : "CREAR PROYECTO"} onPress={save} />
      </FormSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  notice: { color: systemColors.textMuted, fontSize: 13 },
  projectCard: { gap: 12 },
  projectHeader: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  projectCopy: { flex: 1, gap: 4 },
  title: { color: systemColors.text, fontSize: 17, fontWeight: "600" },
  status: { color: systemColors.accent, fontSize: 12 },
  actions: { flexDirection: "row" },
  body: { color: systemColors.textMuted, fontSize: 13, lineHeight: 19 },
  nextAction: { padding: 12, borderRadius: 10, backgroundColor: systemColors.backgroundRaised, gap: 5 },
  label: { color: systemColors.textFaint, fontSize: 10, letterSpacing: 1 },
  footer: { flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 8 },
  meta: { color: systemColors.textMuted, fontSize: 12 },
  error: { color: systemColors.danger, fontSize: 13 },
});
