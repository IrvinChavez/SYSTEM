import { deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { firestore } from "@/config/firebase";

export const lifeAreaOptions = [
  { value: "work", label: "Trabajo" },
  { value: "study", label: "Estudios" },
  { value: "home", label: "Hogar" },
  { value: "care", label: "Cuidado de otras personas" },
  { value: "health", label: "Bienestar" },
  { value: "projects", label: "Proyectos personales" },
  { value: "other", label: "Otra área" },
] as const;

export const frictionOptions = [
  { value: "too-much", label: "Demasiadas cosas a la vez" },
  { value: "unclear-start", label: "No sé por dónde empezar" },
  { value: "interruptions", label: "Interrupciones" },
  { value: "low-energy", label: "Energía variable" },
  { value: "consistency", label: "Mantener la constancia" },
  { value: "time", label: "Poco tiempo disponible" },
] as const;

export const careOptions = [
  { value: "rest", label: "Descanso y sueño" },
  { value: "meals", label: "Comidas y pausas" },
  { value: "relationships", label: "Tiempo con personas importantes" },
  { value: "free-time", label: "Tiempo libre sin tareas" },
  { value: "movement", label: "Movimiento y actividad física" },
] as const;

export type DiscoveryAnswers = {
  lifeAreas: string[];
  fixedCommitments: string;
  currentRoutine: string;
  nearTermGoal: string;
  futureGoal: string;
  focusWindow: "morning" | "midday" | "afternoon" | "evening" | "varies";
  frictionPoints: string[];
  supportStyle: "gentle" | "direct" | "structured";
  carePriorities: string[];
  completed: boolean;
  aiPersonalizationConsent: boolean;
};

export type DiscoveryProfile = DiscoveryAnswers & { updatedAt?: unknown };

export const emptyDiscovery: DiscoveryAnswers = {
  lifeAreas: [],
  fixedCommitments: "",
  currentRoutine: "",
  nearTermGoal: "",
  futureGoal: "",
  focusWindow: "varies",
  frictionPoints: [],
  supportStyle: "gentle",
  carePriorities: [],
  completed: false,
  aiPersonalizationConsent: false,
};

const discoveryDoc = (uid: string) => doc(firestore, "users", uid, "discovery", "profile");

export function subscribeToDiscovery(
  uid: string,
  onChange: (profile: DiscoveryProfile | null) => void,
  onError: (error: Error) => void,
) {
  return onSnapshot(discoveryDoc(uid), (snapshot) => {
    onChange(snapshot.exists() ? { ...emptyDiscovery, ...snapshot.data() } as DiscoveryProfile : null);
  }, onError);
}

export function saveDiscovery(uid: string, answers: DiscoveryAnswers) {
  return setDoc(discoveryDoc(uid), { ...answers, updatedAt: serverTimestamp() });
}

export function deleteDiscovery(uid: string) {
  return deleteDoc(discoveryDoc(uid));
}
