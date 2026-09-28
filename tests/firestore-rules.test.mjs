import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { arrayRemove, arrayUnion, deleteField, doc, getDoc, increment, serverTimestamp, setDoc, updateDoc, writeBatch } from "firebase/firestore";

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

console.log("Flujos de la app (deben pasar):");
{ // initPlayer
  const b = writeBatch(db);
  b.set(doc(db, "users/alice"), { name: "alice", username: "alice", photo: null, totalXp: 0, stats: { STR: 0, INT: 0, VIT: 0, AGI: 0, PER: 0 }, createdAt: serverTimestamp() });
  b.set(doc(db, "users/alice/missions/starter-1"), { ...mission, createdAt: serverTimestamp() });
  await check("registro: perfil + misiones iniciales", b.commit(), "ok");
}
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
await check("borrar evento", updateDoc(doc(db, "users/alice/events/e1"), { title: "Clase 2" }), "ok");

console.log("Ataques y datos inválidos (deben fallar):");
await check("otro usuario lee mi perfil", getDoc(doc(other, "users/alice")), "fail");
await check("otro usuario escribe mis misiones", setDoc(doc(other, "users/alice/missions/x"), mission), "fail");
await check("sin sesión lee", getDoc(doc(anon, "users/alice")), "fail");
await check("foto de 1 MB", setDoc(doc(db, "users/alice"), { photo: "A".repeat(1000000) }, { merge: true }), "fail");
await check("nombre vacío", setDoc(doc(db, "users/alice"), { name: "" }, { merge: true }), "fail");
await check("misión con hora 25:00", setDoc(doc(db, "users/alice/missions/bad"), { ...mission, time: "25:00" }), "fail");
await check("misión con 9999 EXP", setDoc(doc(db, "users/alice/missions/bad"), { ...mission, xp: 9999 }), "fail");
await check("misión con stat inventada", setDoc(doc(db, "users/alice/missions/bad"), { ...mission, stat: "GOD" }), "fail");
await check("evento que termina antes de empezar", setDoc(doc(db, "users/alice/events/bad"), { ...event, end: "07:00" }), "fail");
await check("colección desconocida", setDoc(doc(db, "users/alice/hack/x"), { a: 1 }), "fail");
await check("progreso con id de fecha inválido", setDoc(doc(db, "users/alice/dailyProgress/hola"), { completedMissionIds: [], totalMissions: 1 }), "fail");

console.log(`\n${pass} pasaron, ${fail} fallaron`);
await env.cleanup();
process.exit(fail ? 1 : 0);
