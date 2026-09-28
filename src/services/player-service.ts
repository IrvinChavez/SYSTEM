import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { firestore } from "@/config/firebase";
import {
  AgendaEvent,
  DailyProgress,
  emptyStats,
  Mission,
  MissionReward,
  PlayerProfile,
  starterMissions,
  statKeys,
  type StatKey,
} from "@/data/system-data";
import type { PlanAction } from "@/lib/plan";

// Estructura en Firestore:
// users/{uid}                          -> PlayerProfile
// users/{uid}/missions/{missionId}     -> Mission
// users/{uid}/dailyProgress/{dateKey}  -> DailyProgress
// users/{uid}/events/{eventId}         -> AgendaEvent

const userDoc = (uid: string) => doc(firestore, "users", uid);
const missionsCollection = (uid: string) => collection(firestore, "users", uid, "missions");
const progressCollection = (uid: string) => collection(firestore, "users", uid, "dailyProgress");
const eventsCollection = (uid: string) => collection(firestore, "users", uid, "events");

// Crea el perfil y las misiones iniciales solo si aún no existen. Es idempotente: al registrarse lo llaman
// tanto el formulario (con el nombre) como el PlayerProvider cuando el perfil no existe, y no importa cuál
// llegue primero.
export async function initPlayer(uid: string, username: string, name?: string) {
  await runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(userDoc(uid));

    if (snapshot.exists()) {
      if (name) transaction.update(userDoc(uid), { name });
      return;
    }

    const profile: PlayerProfile = { name: name || username || "Player", username, photo: null, totalXp: 0, stats: emptyStats };
    transaction.set(userDoc(uid), { ...profile, createdAt: serverTimestamp() });
    starterMissions.forEach((mission, index) => {
      transaction.set(doc(missionsCollection(uid), `starter-${index}`), { ...mission, createdAt: serverTimestamp() });
    });
  });
}

export function subscribeToProfile(uid: string, onChange: (profile: PlayerProfile | null) => void, onError: (error: Error) => void) {
  return onSnapshot(userDoc(uid), (snapshot) => {
    if (!snapshot.exists()) {
      onChange(null);
      return;
    }
    const data = snapshot.data();
    onChange({
      name: data.name ?? "Player",
      username: data.username ?? (typeof data.email === "string" ? data.email.split("@")[0] : ""),
      photo: typeof data.photo === "string" ? data.photo : null,
      totalXp: data.totalXp ?? 0,
      stats: { ...emptyStats, ...data.stats },
    });
  }, onError);
}

export function subscribeToMissions(uid: string, onChange: (missions: Mission[]) => void, onError: (error: Error) => void) {
  return onSnapshot(query(missionsCollection(uid), orderBy("time")), (snapshot) => {
    onChange(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as Mission)));
  }, onError);
}

export function subscribeToProgress(uid: string, fromDateKey: string, onChange: (history: DailyProgress[]) => void, onError: (error: Error) => void) {
  return onSnapshot(query(progressCollection(uid), where("dateKey", ">=", fromDateKey)), (snapshot) => {
    onChange(snapshot.docs.map((item) => {
      const data = item.data();
      return {
        dateKey: item.id,
        completedMissionIds: Array.isArray(data.completedMissionIds) ? data.completedMissionIds : [],
        rewards: parseRewards(data.rewards),
        totalMissions: data.totalMissions ?? 0,
      };
    }));
  }, onError);
}

export function subscribeToEvents(uid: string, fromDateKey: string, onChange: (events: AgendaEvent[]) => void, onError: (error: Error) => void) {
  return onSnapshot(query(eventsCollection(uid), where("date", ">=", fromDateKey), orderBy("date")), (snapshot) => {
    const events = snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as AgendaEvent));
    events.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
    onChange(events);
  }, onError);
}

function parseRewards(value: unknown): Record<string, MissionReward> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).flatMap(([id, reward]) => {
    const { xp, stat } = (reward ?? {}) as { xp?: unknown; stat?: unknown };
    return typeof xp === "number" && statKeys.includes(stat as StatKey) ? [[id, { xp, stat: stat as StatKey }]] : [];
  }));
}

// Completa una misión: la agrega con arrayUnion (dos toques rápidos no se pisan), guarda la recompensa
// otorgada y suma EXP/estadística, todo en una escritura atómica.
export async function completeMission(uid: string, dateKey: string, mission: Mission, totalMissions: number) {
  const reward: MissionReward = { xp: mission.xp, stat: mission.stat };
  const batch = writeBatch(firestore);

  batch.set(doc(progressCollection(uid), dateKey), {
    dateKey,
    completedMissionIds: arrayUnion(mission.id),
    rewards: { [mission.id]: reward },
    totalMissions,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  batch.update(userDoc(uid), {
    totalXp: increment(reward.xp),
    [`stats.${reward.stat}`]: increment(1),
  });

  await batch.commit();
}

// Desmarca una misión restando exactamente lo que otorgó al completarse (no su EXP actual, que pudo editarse).
// `reward` es null para progreso guardado antes de que existiera el campo rewards: ahí se usa la misión actual.
export async function uncompleteMission(uid: string, dateKey: string, mission: Mission, reward: MissionReward | null, totalMissions: number) {
  const refund = reward ?? { xp: mission.xp, stat: mission.stat };
  const batch = writeBatch(firestore);

  batch.set(doc(progressCollection(uid), dateKey), {
    dateKey,
    completedMissionIds: arrayRemove(mission.id),
    rewards: { [mission.id]: deleteField() },
    totalMissions,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  batch.update(userDoc(uid), {
    totalXp: increment(-refund.xp),
    [`stats.${refund.stat}`]: increment(-1),
  });

  await batch.commit();
}

export async function addMission(uid: string, mission: Omit<Mission, "id">) {
  await addDoc(missionsCollection(uid), { ...mission, createdAt: serverTimestamp() });
}

export async function updateMission(uid: string, missionId: string, mission: Omit<Mission, "id">) {
  await updateDoc(doc(missionsCollection(uid), missionId), mission);
}

export async function deleteMission(uid: string, missionId: string) {
  await deleteDoc(doc(missionsCollection(uid), missionId));
}

export async function addEvent(uid: string, event: Omit<AgendaEvent, "id">) {
  await addDoc(eventsCollection(uid), { ...event, createdAt: serverTimestamp() });
}

export async function deleteEvent(uid: string, eventId: string) {
  await deleteDoc(doc(eventsCollection(uid), eventId));
}

export async function updatePlayerName(uid: string, name: string) {
  await setDoc(userDoc(uid), { name }, { merge: true });
}

export async function updatePlayerPhoto(uid: string, photo: string | null) {
  await setDoc(userDoc(uid), { photo }, { merge: true });
}

// Borra todos los datos del jugador (subcolecciones y perfil). Firestore no borra subcolecciones en cascada,
// así que se eliminan documento por documento en lotes de hasta 500 escrituras.
export async function deletePlayerData(uid: string) {
  const collections = [missionsCollection(uid), eventsCollection(uid), progressCollection(uid)];
  const refs = (await Promise.all(collections.map((ref) => getDocs(ref)))).flatMap((snapshot) => snapshot.docs.map((item) => item.ref));
  refs.push(userDoc(uid));

  for (let start = 0; start < refs.length; start += 500) {
    const batch = writeBatch(firestore);
    refs.slice(start, start + 500).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

// Aplica en una sola escritura atómica los cambios que la IA propuso y el jugador aprobó: o se guardan todos o ninguno.
export function applyPlan(uid: string, actions: PlanAction[]) {
  const batch = writeBatch(firestore);

  for (const action of actions) {
    switch (action.type) {
      case "add_mission":
        batch.set(doc(missionsCollection(uid)), { ...action.mission, createdAt: serverTimestamp() });
        break;
      case "update_mission":
        batch.update(doc(missionsCollection(uid), action.id), action.changes);
        break;
      case "delete_mission":
        batch.delete(doc(missionsCollection(uid), action.id));
        break;
      case "add_event":
        batch.set(doc(eventsCollection(uid)), { ...action.event, createdAt: serverTimestamp() });
        break;
      case "update_event":
        batch.update(doc(eventsCollection(uid), action.id), action.changes);
        break;
      case "delete_event":
        batch.delete(doc(eventsCollection(uid), action.id));
        break;
    }
  }

  return batch.commit();
}

export async function updateEvent(uid: string, eventId: string, event: Partial<Omit<AgendaEvent, "id">>) {
  await updateDoc(doc(eventsCollection(uid), eventId), event);
}
