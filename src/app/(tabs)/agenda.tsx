import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { FieldGroup, FormSheet } from "@/components/form-sheet";
import { ActionPill, Card, Chip, EmptyState, IconButton, PrimaryButton, Screen, ScreenHeader, SectionHeading, TextField } from "@/components/ui";
import { systemColors } from "@/constants/system-colors";
import { usePlayer } from "@/context/player-context";
import { AgendaEvent, eventCategories } from "@/data/system-data";
import { confirmAction, syncInBackground } from "@/lib/confirm";
import { addDays, formatDateLabel, isValidTime, toDateKey } from "@/lib/dates";
import { addEvent, deleteEvent } from "@/services/player-service";

type EventDraft = Omit<AgendaEvent, "id">;

const nextDays = () => Array.from({ length: 7 }, (_, index) => toDateKey(addDays(new Date(), index)));

const newDraft = (): EventDraft => ({ title: "", date: toDateKey(), start: "09:00", end: "10:00", location: "", category: eventCategories[0] });

export default function AgendaScreen() {
  const { uid, events } = usePlayer();
  const [formVisible, setFormVisible] = useState(false);
  const [draft, setDraft] = useState<EventDraft>(newDraft);
  const [error, setError] = useState<string | null>(null);

  const openNew = () => {
    setDraft(newDraft());
    setError(null);
    setFormVisible(true);
  };

  // Los accesos rápidos de Inicio navegan con ?nuevo=<marca de tiempo> para abrir el formulario directamente.
  const { nuevo } = useLocalSearchParams<{ nuevo?: string }>();
  const [handledNuevo, setHandledNuevo] = useState<string | undefined>();
  if (nuevo && nuevo !== handledNuevo) {
    setHandledNuevo(nuevo);
    openNew();
  }

  const handleSave = () => {
    const title = draft.title.trim();
    if (!title) {
      setError("Ponle un título al evento.");
      return;
    }
    if (!isValidTime(draft.start) || !isValidTime(draft.end)) {
      setError("Las horas deben tener formato HH:MM (24 h).");
      return;
    }
    if (draft.end <= draft.start) {
      setError("La hora de fin debe ser posterior a la de inicio.");
      return;
    }

    syncInBackground(addEvent(uid, { ...draft, title, location: draft.location.trim() }), "No se pudo guardar el evento.");
    setFormVisible(false);
  };

  const handleDelete = (event: AgendaEvent) => {
    confirmAction("Eliminar evento", `¿Eliminar "${event.title}"?`, "Eliminar", () => {
      syncInBackground(deleteEvent(uid, event.id), "No se pudo eliminar el evento.");
    });
  };

  const groups = events.reduce<Record<string, AgendaEvent[]>>((result, event) => {
    (result[event.date] ??= []).push(event);
    return result;
  }, {});

  return (
    <Screen>
      <ScreenHeader
        title="AGENDA"
        subtitle="Clases, trabajo y compromisos de los próximos días."
        action={<ActionPill icon="add" label="Nuevo" onPress={openNew} />}
      />

      {events.length === 0 ? (
        <Card>
          <EmptyState icon="▦" title="Agenda vacía" text="Agrega tus clases con el botón Nuevo, o cuéntale tu horario a la IA." />
        </Card>
      ) : Object.entries(groups).map(([date, dayEvents]) => (
        <Card key={date}>
          <SectionHeading icon="▦" title={formatDateLabel(date).toUpperCase()} trailing={`${dayEvents.length}`} />
          <View style={styles.list}>
            {dayEvents.map((event) => (
              <View key={event.id} style={styles.event}>
                <View style={styles.timeColumn}>
                  <Text style={styles.time}>{event.start}</Text>
                  <Text style={styles.timeEnd}>{event.end}</Text>
                </View>
                <View style={styles.info}>
                  <Text style={styles.title}>{event.title}</Text>
                  {event.location ? <Text style={styles.location}>⌖ {event.location}</Text> : null}
                </View>
                <Text style={styles.category}>{event.category}</Text>
                <IconButton icon="trash-outline" label={`Eliminar ${event.title}`} onPress={() => handleDelete(event)} color={systemColors.danger} />
              </View>
            ))}
          </View>
        </Card>
      ))}

      <PrimaryButton label="＋ NUEVO EVENTO" variant="outline" onPress={openNew} />

      <FormSheet visible={formVisible} title="NUEVO EVENTO" onClose={() => setFormVisible(false)}>
        <TextField label="TÍTULO" value={draft.title} onChangeText={(title) => setDraft({ ...draft, title })} placeholder="Ej. Programación" maxLength={40} />
        <FieldGroup label="DÍA">
          {nextDays().map((date) => (
            <Chip key={date} label={formatDateLabel(date)} selected={draft.date === date} onPress={() => setDraft({ ...draft, date })} />
          ))}
        </FieldGroup>
        <View style={styles.timeRow}>
          <View style={styles.flex}>
            <TextField label="INICIO" value={draft.start} onChangeText={(start) => setDraft({ ...draft, start })} placeholder="09:00" keyboardType="numbers-and-punctuation" maxLength={5} />
          </View>
          <View style={styles.flex}>
            <TextField label="FIN" value={draft.end} onChangeText={(end) => setDraft({ ...draft, end })} placeholder="11:00" keyboardType="numbers-and-punctuation" maxLength={5} />
          </View>
        </View>
        <TextField label="LUGAR (OPCIONAL)" value={draft.location} onChangeText={(location) => setDraft({ ...draft, location })} placeholder="Aula 3" maxLength={40} />
        <FieldGroup label="CATEGORÍA">
          {eventCategories.map((category) => (
            <Chip key={category} label={category} selected={draft.category === category} onPress={() => setDraft({ ...draft, category })} />
          ))}
        </FieldGroup>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton label="GUARDAR EVENTO" onPress={handleSave} />
      </FormSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 6,
    marginTop: 10,
  },
  event: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 9,
    paddingLeft: 10,
    paddingVertical: 6,
    backgroundColor: systemColors.backgroundRaised,
  },
  timeColumn: {
    borderLeftWidth: 3,
    borderLeftColor: systemColors.primary,
    paddingLeft: 8,
  },
  time: {
    color: systemColors.text,
    fontSize: 12,
    fontWeight: "600",
  },
  timeEnd: {
    color: systemColors.textFaint,
    fontSize: 11,
    marginTop: 2,
  },
  info: {
    flex: 1,
  },
  title: {
    color: systemColors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  location: {
    color: systemColors.textMuted,
    fontSize: 11,
    marginTop: 3,
  },
  category: {
    color: systemColors.accent,
    fontSize: 8,
    backgroundColor: "#17325A",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 3,
    overflow: "hidden",
  },
  timeRow: {
    flexDirection: "row",
    gap: 12,
  },
  flex: {
    flex: 1,
  },
  error: {
    color: systemColors.danger,
    fontSize: 12,
  },
});
