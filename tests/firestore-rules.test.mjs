import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { arrayRemove, arrayUnion, deleteDoc, deleteField, doc, getDoc, increment, serverTimestamp, setDoc, updateDoc, writeBatch } from "firebase/firestore";

const env = await initializeTestEnvironment({ projectId: "demo-system", firestore: { rules: readFileSync(new URL("../firestore.rules", import.meta.url), "utf8"), host: "127.0.0.1", port: 8089 } });
const db = env.authenticatedContext("alice").firestore();
const other = env.authenticatedContext("bob").firestore();
const anon = env.unauthenticatedContext().firestore();
let pass = 0, fail = 0;
async function check(name, promise, expect) {
  try { await (expect === "ok" ? assertSucceeds(promise) : assertFails(promise)); pass++; console.log("  ✓", name); }
  catch (e) { fail++; console.log("  ✗", name, "→", e.message.split("\n")[0]); }
}
const mission = { title: "Entrenamiento", time: "07:00", icon: "◇", xp: 35, stat: "STR" };
const event = { title: "Clase", date: "2026-09-28", start: "08:00", end: "14:00", location: "Aula 3", category: "CLASE" };
const task = { title: "Entregar reporte", description: "Revisar el borrador", status: "pending", priority: "high", dueDate: null, estimateMinutes: 30, projectId: null };
const project = { title: "Curso de inglés", purpose: "Completar el curso", status: "active", nextAction: "Hacer la primera lección", deadline: null };
const goal = { title: "Leer más", measure: "10 páginas por semana", nextStep: "Elegir el libro", horizon: "short", targetDate: null, status: "active" };
const note = { title: "Idea", body: "Preparar una lista de referencias." };
const discovery = {
  lifeAreas: ["study", "projects"],
  fixedCommitments: "Clases de lunes a viernes por la mañana.",
  currentRoutine: "Leo antes de dormir.",
  nearTermGoal: "Terminar el curso.",
  futureGoal: "Cambiar de área profesional.",
  focusWindow: "morning",
  frictionPoints: ["too-much", "unclear-start"],
  supportStyle: "structured",
  carePriorities: ["rest", "free-time"],
  completed: true,
  aiPersonalizationConsent: false,
};

console.log("Flujos de la app (deben pasar):");
{ // initPlayer
  const b = writeBatch(db);
  b.set(doc(db, "users/alice"), { name: "alice", username: "alice", photo: null, totalXp: 0, stats: { STR: 0, INT: 0, VIT: 0, AGI: 0, PER: 0 }, createdAt: serverTimestamp() });
  await check("registro: perfil sin hábitos inventados", b.commit(), "ok");
}
await check("crear un hábito según la rutina real", setDoc(doc(db, "users/alice/missions/starter-1"), { ...mission, createdAt: serverTimestamp() }), "ok");
{ // completeMission
  const b = writeBatch(db);
  b.set(doc(db, "users/alice/dailyProgress/2026-09-27"), { dateKey: "2026-09-27", completedMissionIds: arrayUnion("starter-1"), rewards: { "starter-1": { xp: 35, stat: "STR" } }, totalMissions: 6, updatedAt: serverTimestamp() }, { merge: true });
  b.update(doc(db, "users/alice"), { totalXp: increment(35), "stats.STR": increment(1) });
  await check("completar misión", b.commit(), "ok");
}
{ // uncompleteMission
  const b = writeBatch(db);
  b.set(doc(db, "users/alice/dailyProgress/2026-09-27"), { dateKey: "2026-09-27", completedMissionIds: arrayRemove("starter-1"), rewards: { "starter-1": deleteField() }, totalMissions: 6, updatedAt: serverTimestamp() }, { merge: true });
  b.update(doc(db, "users/alice"), { totalXp: increment(-35), "stats.STR": increment(-1) });
  await check("desmarcar misión", b.commit(), "ok");
  const p = (await getDoc(doc(db, "users/alice/dailyProgress/2026-09-27"))).data();
  const u = (await getDoc(doc(db, "users/alice"))).data();
  const ok = p.completedMissionIds.length === 0 && Object.keys(p.rewards).length === 0 && u.totalXp === 0 && u.stats.STR === 0;
  ok ? (pass++, console.log("  ✓ datos correctos tras desmarcar (EXP 0, rewards vacío)")) : (fail++, console.log("  ✗ datos tras desmarcar", p, u));
}
await check("crear misión", setDoc(doc(db, "users/alice/missions/m2"), { ...mission, title: "Leer", createdAt: serverTimestamp() }), "ok");
await check("crear evento", setDoc(doc(db, "users/alice/events/e1"), { ...event, createdAt: serverTimestamp() }), "ok");
{ // applyPlan
  const b = writeBatch(db);
  b.update(doc(db, "users/alice/missions/starter-1"), { time: "20:15" });
  b.set(doc(db, "users/alice/missions/m3"), { title: "Inglés", time: "19:30", icon: "▤", xp: 20, stat: "INT", createdAt: serverTimestamp() });
  b.update(doc(db, "users/alice/events/e1"), { start: "09:00" });
  b.delete(doc(db, "users/alice/missions/m2"));
  await check("aplicar plan de la IA (batch)", b.commit(), "ok");
}
await check("cambiar foto (30 KB)", setDoc(doc(db, "users/alice"), { photo: "data:image/jpeg;base64," + "A".repeat(30000) }, { merge: true }), "ok");
await check("quitar foto", setDoc(doc(db, "users/alice"), { photo: null }, { merge: true }), "ok");
await check("cambiar nombre", setDoc(doc(db, "users/alice"), { name: "Jin-Woo" }, { merge: true }), "ok");
await check("conectar calendario", setDoc(doc(db, "users/alice"), { calendarUrl: "https://calendar.google.com/calendar/ical/x/private-y/basic.ics" }, { merge: true }), "ok");
await check("desconectar calendario", setDoc(doc(db, "users/alice"), { calendarUrl: null }, { merge: true }), "ok");
await check("evento importado del calendario", setDoc(doc(db, "users/alice/events/cal-0123456789abcdef"), { ...event, source: "calendar", syncedAt: serverTimestamp() }), "ok");
await check("borrar evento", updateDoc(doc(db, "users/alice/events/e1"), { title: "Clase 2" }), "ok");
await check("crear tarea", setDoc(doc(db, "users/alice/tasks/t1"), task), "ok");
await check("crear proyecto", setDoc(doc(db, "users/alice/projects/p1"), project), "ok");
await check("crear meta", setDoc(doc(db, "users/alice/goals/g1"), goal), "ok");
await check("crear nota", setDoc(doc(db, "users/alice/notes/n1"), note), "ok");
await check("guardar cuestionario personal", setDoc(doc(db, "users/alice/discovery/profile"), { ...discovery, updatedAt: serverTimestamp() }), "ok");
await check("editar cuestionario y autorizar personalización", setDoc(doc(db, "users/alice/discovery/profile"), { ...discovery, aiPersonalizationConsent: true, updatedAt: serverTimestamp() }), "ok");

console.log("Ataques y datos inválidos (deben fallar):");
await check("otro usuario lee mi perfil", getDoc(doc(other, "users/alice")), "fail");
await check("otro usuario escribe mis misiones", setDoc(doc(other, "users/alice/missions/x"), mission), "fail");
await check("sin sesión lee", getDoc(doc(anon, "users/alice")), "fail");
await check("foto de 1 MB", setDoc(doc(db, "users/alice"), { photo: "A".repeat(1000000) }, { merge: true }), "fail");
await check("nombre vacío", setDoc(doc(db, "users/alice"), { name: "" }, { merge: true }), "fail");
await check("perfil con campo no reconocido", setDoc(doc(db, "users/alice"), { isAdmin: true }, { merge: true }), "fail");
await check("perfil con estadística negativa", setDoc(doc(db, "users/alice"), { "stats.STR": -1 }, { merge: true }), "fail");
await check("misión con hora 25:00", setDoc(doc(db, "users/alice/missions/bad"), { ...mission, time: "25:00" }), "fail");
await check("misión con 9999 EXP", setDoc(doc(db, "users/alice/missions/bad"), { ...mission, xp: 9999 }), "fail");
await check("misión con stat inventada", setDoc(doc(db, "users/alice/missions/bad"), { ...mission, stat: "GOD" }), "fail");
await check("evento que termina antes de empezar", setDoc(doc(db, "users/alice/events/bad"), { ...event, end: "07:00" }), "fail");
await check("enlace de calendario gigante", setDoc(doc(db, "users/alice"), { calendarUrl: "https://" + "a".repeat(2000) }, { merge: true }), "fail");
await check("evento con origen inventado", setDoc(doc(db, "users/alice/events/bad"), { ...event, source: "hack" }), "fail");
await check("otro usuario crea una tarea en mi cuenta", setDoc(doc(other, "users/alice/tasks/x"), task), "fail");
await check("otro usuario lee mi cuestionario", getDoc(doc(other, "users/alice/discovery/profile")), "fail");
await check("tarea con estado inválido", setDoc(doc(db, "users/alice/tasks/bad"), { ...task, status: "done" }), "fail");
await check("tarea con campo no reconocido", setDoc(doc(db, "users/alice/tasks/bad-field"), { ...task, isAdmin: true }), "fail");
await check("cuestionario con área inventada", setDoc(doc(db, "users/alice/discovery/bad"), { ...discovery, lifeAreas: ["admin"], updatedAt: serverTimestamp() }), "fail");
await check("cuestionario con campo no reconocido", setDoc(doc(db, "users/alice/discovery/profile"), { ...discovery, privateData: "x", updatedAt: serverTimestamp() }), "fail");
await check("proyecto con fecha inválida", setDoc(doc(db, "users/alice/projects/bad"), { ...project, deadline: "mañana" }), "fail");
await check("meta con horizonte inválido", setDoc(doc(db, "users/alice/goals/bad"), { ...goal, horizon: "algún día" }), "fail");
await check("nota demasiado larga", setDoc(doc(db, "users/alice/notes/bad"), { ...note, body: "x".repeat(12001) }), "fail");
await check("colección desconocida", setDoc(doc(db, "users/alice/hack/x"), { a: 1 }), "fail");
await check("progreso con id de fecha inválido", setDoc(doc(db, "users/alice/dailyProgress/hola"), { completedMissionIds: [], totalMissions: 1 }), "fail");
await check("borrar cuestionario propio", deleteDoc(doc(db, "users/alice/discovery/profile")), "ok");

console.log(`\n${pass} pasaron, ${fail} fallaron`);
await env.cleanup();
process.exit(fail ? 1 : 0);
