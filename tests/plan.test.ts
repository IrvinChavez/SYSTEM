/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";
import type { AgendaEvent, Mission } from "@/data/system-data";
import { describeAction, findConflicts, parseJsonObject, sanitizeActions, sanitizeMission, stripMarkdown } from "@/lib/plan";

const missions: Mission[] = [{ id: "starter-1", title: "Entrenamiento", time: "07:00", icon: "◇", xp: 35, stat: "STR" }];
const events: AgendaEvent[] = [{ id: "ev1", title: "Programación", date: "2026-09-28", start: "15:00", end: "18:00", location: "", category: "CLASE" }];
const snapshot = { missions, events, today: "2026-09-27" };

test("sanitizeActions: acepta acciones válidas", () => {
  const actions = sanitizeActions([
    { type: "add_mission", title: "Inglés", time: "19:30", xp: 20, stat: "INT", icon: "▤" },
    { type: "update_mission", id: "starter-1", time: "20:15" },
    { type: "add_event", title: "Trabajo", date: "2026-09-28", start: "08:00", end: "14:00", category: "TRABAJO" },
    { type: "update_event", id: "ev1", start: "16:00" },
    { type: "delete_event", id: "ev1" },
  ], snapshot);
  assert.deepEqual(actions.map((action) => action.type), ["add_mission", "update_mission", "add_event", "update_event", "delete_event"]);
});

test("sanitizeActions: rechaza ids inventados, horas y fechas inválidas", () => {
  const actions = sanitizeActions([
    { type: "update_mission", id: "no-existe", time: "10:00" },
    { type: "delete_event", id: "inventado" },
    { type: "update_mission", id: "starter-1", time: "25:00" },
    { type: "update_mission", id: "starter-1", time: "07:00" },
    { type: "add_event", title: "Pasado", date: "2020-01-01", start: "08:00", end: "09:00" },
    { type: "add_event", title: "Al revés", date: "2026-09-28", start: "10:00", end: "09:00" },
    { type: "add_event", title: "", date: "2026-09-28", start: "08:00", end: "09:00" },
    { type: "update_event", id: "ev1", end: "14:00" },
    { type: "hackear_todo" },
    null,
    "texto",
  ], snapshot);
  assert.deepEqual(actions, []);
});

test("sanitizeActions: no toca eventos importados del calendario externo", () => {
  const imported: AgendaEvent = { id: "cal-1", title: "Cálculo", date: "2026-09-28", start: "07:00", end: "09:00", location: "", category: "CLASE", source: "calendar" };
  const actions = sanitizeActions([
    { type: "update_event", id: "cal-1", start: "10:00" },
    { type: "delete_event", id: "cal-1" },
  ], { ...snapshot, events: [...events, imported] });
  assert.deepEqual(actions, []);
});

test("sanitizeActions: tolera basura y limita cantidad", () => {
  assert.deepEqual(sanitizeActions("no es arreglo", snapshot), []);
  assert.deepEqual(sanitizeActions(undefined, snapshot), []);
  const many = Array.from({ length: 50 }, (_, i) => ({ type: "add_mission", title: `M${i}`, time: "08:00" }));
  assert.equal(sanitizeActions(many, snapshot).length, 12);
});

test("sanitizeMission: corrige valores fuera de rango", () => {
  assert.deepEqual(sanitizeMission({ title: "  Correr  ", time: "99:99", xp: 9999, stat: "DIOS", icon: "💀" }, "VIT"), {
    title: "Correr", time: "08:00", xp: 20, stat: "VIT", icon: "✚",
  });
  assert.equal(sanitizeMission({ title: "x".repeat(100) }, "INT")?.title.length, 40);
  assert.equal(sanitizeMission({ title: "" }, "INT"), null);
});

test("findConflicts: detecta choques solo con lo nuevo o movido", () => {
  const add = (start: string, end: string, date = "2026-09-28") => ({ type: "add_event" as const, event: { title: "Trabajo", date, start, end, location: "", category: "OTRO" } });
  assert.equal(findConflicts([add("15:00", "19:00")], events).length, 1);
  assert.equal(findConflicts([add("18:00", "19:00")], events).length, 0, "tocarse en el borde no es choque");
  assert.equal(findConflicts([add("15:00", "19:00", "2026-09-29")], events).length, 0);
  assert.equal(findConflicts([{ type: "delete_event", id: "ev1", before: events[0] }, add("15:00", "19:00")], events).length, 0);
  assert.equal(findConflicts([], [...events, { ...events[0], id: "ev2" }]).length, 0, "choques previos no se reportan de nuevo");
});

test("describeAction", () => {
  assert.equal(describeAction({ type: "update_mission", id: "starter-1", before: missions[0], changes: { time: "20:15" } }), "Mover misión Entrenamiento: 07:00 → 20:15");
});

test("parseJsonObject: nunca lanza excepción", () => {
  assert.deepEqual(parseJsonObject('{"reply":"hola","actions":[]}'), { reply: "hola", actions: [] });
  assert.deepEqual(parseJsonObject('Claro: {"reply":"hola"} ¡listo!'), { reply: "hola" });
  assert.equal(parseJsonObject("{roto"), null);
  assert.equal(parseJsonObject("sin json"), null);
  assert.equal(parseJsonObject("[1,2]"), null);
});

test("stripMarkdown", () => {
  assert.equal(stripMarkdown("**Hola** `x`\n## Título\n* uno"), "Hola x\nTítulo\n- uno");
});
