import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { FieldGroup, FormSheet } from "@/components/form-sheet";
import { ActionPill, Card, Chip, EmptyState, IconButton, PrimaryButton, Screen, ScreenHeader, TextField } from "@/components/ui";
import { systemColors } from "@/constants/system-colors";
import { useOrganizer } from "@/context/organizer-context";
import { PersonalTask, TaskPriority, TaskStatus } from "@/data/system-data";
import { confirmAction, syncInBackground } from "@/lib/confirm";
import { addTask, deleteTask, updateTask } from "@/services/organizer-service";
import { isValidDateKey } from "@/lib/dates";

type TaskDraft = Omit<PersonalTask, "id">;
type Filter = "open" | "all" | "completed";

const emptyDraft: TaskDraft = {
  title: "",
  description: "",
  status: "pending",
  priority: "normal",
  dueDate: null,
  estimateMinutes: null,
  projectId: null,
};
const statusLabels: Record<TaskStatus, string> = {
  pending: "Pendiente",
  in_progress: "En progreso",
  blocked: "Bloqueada",
  completed: "Completada",
};
const priorityLabels: Record<TaskPriority, string> = { low: "Baja", normal: "Normal", high: "Alta" };

function validDate(value: string) {
  return !value || isValidDateKey(value);
}

export default function TasksScreen() {
  const { uid, tasks, projects, loading, error } = useOrganizer();
  const [filter, setFilter] = useState<Filter>("open");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState<TaskDraft>(emptyDraft);
  const [dueDate, setDueDate] = useState("");
  const [estimate, setEstimate] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const openNew = () => {
    setEditingId(null);
    setDraft(emptyDraft);
    setDueDate("");
    setEstimate("");
    setFormError(null);
    setVisible(true);
  };
  const { nuevo } = useLocalSearchParams<{ nuevo?: string }>();
  const [handledNew, setHandledNew] = useState<string | undefined>();
  if (nuevo && nuevo !== handledNew) {
    setHandledNew(nuevo);
    openNew();
  }
  const openEdit = (task: PersonalTask) => {
    const { id, ...value } = task;
    setEditingId(id);
    setDraft(value);
    setDueDate(value.dueDate ?? "");
    setEstimate(value.estimateMinutes?.toString() ?? "");
    setFormError(null);
    setVisible(true);
  };
  const save = () => {
    const title = draft.title.trim();
    const minutes = estimate ? Number(estimate) : null;
    if (!title) return setFormError("Escribe un nombre para la tarea.");
    if (!validDate(dueDate)) return setFormError("Usa una fecha válida con formato AAAA-MM-DD.");
    if (estimate && (!Number.isInteger(minutes) || Number(minutes) < 1 || Number(minutes) > 1440)) {
      return setFormError("La duración debe ser de 1 a 1440 minutos.");
    }
    const value = { ...draft, title, description: draft.description.trim(), dueDate: dueDate || null, estimateMinutes: minutes };
    syncInBackground(editingId ? updateTask(uid, editingId, value) : addTask(uid, value), "No se pudo guardar la tarea.");
    setVisible(false);
  };

  const visibleTasks = tasks
    .filter((task) => filter === "all" || (filter === "completed" ? task.status === "completed" : task.status !== "completed"))
    .sort((a, b) => Number(b.priority === "high") - Number(a.priority === "high") || (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
  const complete = (task: PersonalTask) => {
    const { id, ...value } = task;
    syncInBackground(updateTask(uid, id, { ...value, status: task.status === "completed" ? "pending" : "completed" }), "No se pudo actualizar la tarea.");
  };
  const remove = (task: PersonalTask) => confirmAction("Eliminar tarea", `¿Eliminar "${task.title}"?`, "Eliminar", () => {
    syncInBackground(deleteTask(uid, task.id), "No se pudo eliminar la tarea.");
  });

  return (
    <Screen>
      <ScreenHeader title="Tareas" subtitle="Pendientes claros, próximos pasos concretos." action={<ActionPill icon="add" label="Nueva" onPress={openNew} />} />
      {error ? <Text style={styles.notice}>{error}</Text> : null}
      <View style={styles.filters}>
        {([["open", "Pendientes"], ["all", "Todas"], ["completed", "Completadas"]] as const).map(([key, label]) => (
          <Chip key={key} label={`${label}${key === "open" ? ` · ${tasks.filter((task) => task.status !== "completed").length}` : ""}`} selected={filter === key} onPress={() => setFilter(key)} />
        ))}
      </View>
      {loading ? <Text style={styles.notice}>Sincronizando tus tareas…</Text> : null}
      {visibleTasks.length === 0 ? (
        <Card><EmptyState icon="checkmark-done-outline" title={filter === "completed" ? "Aún no hay tareas completadas" : "Sin tareas pendientes"} text="Captura el siguiente paso. No hace falta asignarle una fecha si aún no la conoces." /></Card>
      ) : visibleTasks.map((task) => {
        const project = projects.find((item) => item.id === task.projectId);
        return (
          <Card key={task.id} style={styles.taskCard}>
            <View style={styles.taskTop}>
              <View style={styles.taskCopy}>
                <Text style={styles.taskTitle}>{task.title}</Text>
                {task.description ? <Text style={styles.description}>{task.description}</Text> : null}
                <View style={styles.metadata}>
                  <Text style={[styles.status, task.status === "completed" && styles.completed]}>{statusLabels[task.status]}</Text>
                  <Text style={[styles.priority, task.priority === "high" && styles.highPriority]}>{priorityLabels[task.priority]}</Text>
                  {task.dueDate ? <Text style={styles.metadataText}>{task.dueDate}</Text> : null}
                  {task.estimateMinutes ? <Text style={styles.metadataText}>{task.estimateMinutes} min</Text> : null}
                </View>
                {project ? <Text style={styles.projectLabel}>{project.title}</Text> : null}
              </View>
              <View style={styles.actions}>
                <IconButton icon="create-outline" label={`Editar ${task.title}`} onPress={() => openEdit(task)} />
                <IconButton icon="trash-outline" label={`Eliminar ${task.title}`} onPress={() => remove(task)} color={systemColors.danger} />
              </View>
            </View>
            <PrimaryButton label={task.status === "completed" ? "REABRIR TAREA" : "MARCAR COMO COMPLETADA"} variant={task.status === "completed" ? "outline" : "primary"} onPress={() => complete(task)} />
          </Card>
        );
      })}

      <FormSheet visible={visible} title={editingId ? "Editar tarea" : "Nueva tarea"} onClose={() => setVisible(false)}>
        <TextField label="TAREA" value={draft.title} onChangeText={(title) => setDraft({ ...draft, title })} placeholder="¿Cuál es el siguiente paso?" maxLength={120} />
        <TextField label="DETALLES" value={draft.description} onChangeText={(description) => setDraft({ ...draft, description })} placeholder="Contexto opcional" maxLength={1200} multiline />
        <FieldGroup label="ESTADO">
          {(["pending", "in_progress", "blocked", "completed"] as const).map((status) => (
            <Chip key={status} label={statusLabels[status]} selected={draft.status === status} onPress={() => setDraft({ ...draft, status })} />
          ))}
        </FieldGroup>
        <FieldGroup label="PRIORIDAD">
          {(["low", "normal", "high"] as const).map((priority) => (
            <Chip key={priority} label={priorityLabels[priority]} selected={draft.priority === priority} onPress={() => setDraft({ ...draft, priority })} />
          ))}
        </FieldGroup>
        <TextField label="FECHA LÍMITE OPCIONAL · AAAA-MM-DD" value={dueDate} onChangeText={setDueDate} placeholder="Sin fecha definida" maxLength={10} />
        <TextField label="DURACIÓN ESTIMADA EN MINUTOS" value={estimate} onChangeText={setEstimate} placeholder="Opcional" keyboardType="number-pad" maxLength={4} />
        {projects.length ? (
          <FieldGroup label="PROYECTO">
            <Chip label="Sin proyecto" selected={!draft.projectId} onPress={() => setDraft({ ...draft, projectId: null })} />
            {projects.filter((project) => project.status !== "completed").map((project) => (
              <Chip key={project.id} label={project.title} selected={draft.projectId === project.id} onPress={() => setDraft({ ...draft, projectId: project.id })} />
            ))}
          </FieldGroup>
        ) : null}
        {formError ? <Text style={styles.error}>{formError}</Text> : null}
        <PrimaryButton label={editingId ? "GUARDAR CAMBIOS" : "CREAR TAREA"} onPress={save} />
      </FormSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  notice: { color: systemColors.textMuted, fontSize: 13, lineHeight: 19 },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  taskCard: { gap: 12 },
  taskTop: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  taskCopy: { flex: 1, gap: 7 },
  taskTitle: { color: systemColors.text, fontSize: 16, fontWeight: "600" },
  description: { color: systemColors.textMuted, fontSize: 13, lineHeight: 19 },
  metadata: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10 },
  status: { color: systemColors.accent, fontSize: 12, fontWeight: "600" },
  completed: { color: systemColors.success },
  priority: { color: systemColors.textMuted, fontSize: 12 },
  highPriority: { color: systemColors.warning },
  metadataText: { color: systemColors.textFaint, fontSize: 12 },
  projectLabel: { color: systemColors.textMuted, fontSize: 12 },
  actions: { flexDirection: "row" },
  error: { color: systemColors.danger, fontSize: 13 },
});
