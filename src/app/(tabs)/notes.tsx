import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { FormSheet } from "@/components/form-sheet";
import { ActionPill, Card, EmptyState, IconButton, PrimaryButton, Screen, ScreenHeader, TextField } from "@/components/ui";
import { systemColors } from "@/constants/system-colors";
import { useOrganizer } from "@/context/organizer-context";
import { PersonalNote } from "@/data/system-data";
import { confirmAction, syncInBackground } from "@/lib/confirm";
import { addNote, deleteNote, updateNote } from "@/services/organizer-service";

type NoteDraft = Omit<PersonalNote, "id">;
const blankNote: NoteDraft = { title: "", body: "" };

export default function NotesScreen() {
  const { uid, notes, loading, error } = useOrganizer();
  const [visible, setVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<NoteDraft>(blankNote);
  const [formError, setFormError] = useState<string | null>(null);
  const openNew = () => { setEditingId(null); setDraft(blankNote); setFormError(null); setVisible(true); };
  const openEdit = (note: PersonalNote) => {
    const { id, ...value } = note;
    setEditingId(id); setDraft(value); setFormError(null); setVisible(true);
  };
  const save = () => {
    const title = draft.title.trim();
    if (!title) return setFormError("Escribe un título para la nota.");
    const value = { title, body: draft.body.trim() };
    syncInBackground(editingId ? updateNote(uid, editingId, value) : addNote(uid, value), "No se pudo guardar la nota.");
    setVisible(false);
  };
  const remove = (note: PersonalNote) => confirmAction("Eliminar nota", `¿Eliminar "${note.title}"?`, "Eliminar", () => {
    syncInBackground(deleteNote(uid, note.id), "No se pudo eliminar la nota.");
  });
  return (
    <Screen>
      <ScreenHeader title="Notas" subtitle="Guarda ideas y referencias en un solo lugar." action={<ActionPill icon="add" label="Nueva" onPress={openNew} />} />
      {error ? <Text style={styles.notice}>{error}</Text> : null}
      {loading ? <Text style={styles.notice}>Sincronizando tus notas…</Text> : null}
      {notes.length === 0 ? (
        <Card><EmptyState icon="document-text-outline" title="Sin notas guardadas" text="Captura información útil sin convertir cada idea en una tarea." /></Card>
      ) : [...notes].sort((a, b) => a.title.localeCompare(b.title)).map((note) => (
        <Card key={note.id} style={styles.noteCard}>
          <View style={styles.header}>
            <Text style={styles.title}>{note.title}</Text>
            <View style={styles.actions}>
              <IconButton icon="create-outline" label={`Editar ${note.title}`} onPress={() => openEdit(note)} />
              <IconButton icon="trash-outline" label={`Eliminar ${note.title}`} onPress={() => remove(note)} color={systemColors.danger} />
            </View>
          </View>
          {note.body ? <Text style={styles.body}>{note.body}</Text> : <Text style={styles.placeholder}>Sin contenido</Text>}
        </Card>
      ))}
      <FormSheet visible={visible} title={editingId ? "Editar nota" : "Nueva nota"} onClose={() => setVisible(false)}>
        <TextField label="TÍTULO" value={draft.title} onChangeText={(title) => setDraft({ ...draft, title })} placeholder="Idea o referencia" maxLength={120} />
        <TextField label="CONTENIDO" value={draft.body} onChangeText={(body) => setDraft({ ...draft, body })} placeholder="Escribe aquí…" maxLength={12000} multiline />
        {formError ? <Text style={styles.error}>{formError}</Text> : null}
        <PrimaryButton label={editingId ? "GUARDAR CAMBIOS" : "GUARDAR NOTA"} onPress={save} />
      </FormSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  notice: { color: systemColors.textMuted, fontSize: 13 },
  noteCard: { gap: 10 },
  header: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { flex: 1, color: systemColors.text, fontSize: 16, fontWeight: "600" },
  actions: { flexDirection: "row" },
  body: { color: systemColors.textMuted, fontSize: 14, lineHeight: 21 },
  placeholder: { color: systemColors.textFaint, fontSize: 13, fontStyle: "italic" },
  error: { color: systemColors.danger, fontSize: 13 },
});
