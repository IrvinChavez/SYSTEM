import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { PersonalGoal, PersonalNote, PersonalProject, PersonalTask } from "@/data/system-data";
import {
  subscribeToGoals,
  subscribeToNotes,
  subscribeToProjects,
  subscribeToTasks,
} from "@/services/organizer-service";

type OrganizerContextValue = {
  uid: string;
  loading: boolean;
  error: string | null;
  tasks: PersonalTask[];
  projects: PersonalProject[];
  goals: PersonalGoal[];
  notes: PersonalNote[];
};

const OrganizerContext = createContext<OrganizerContextValue | null>(null);

export function OrganizerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid ?? "";
  return <OrganizerDataProvider key={uid || "signed-out"} uid={uid}>{children}</OrganizerDataProvider>;
}

function OrganizerDataProvider({ children, uid }: { children: ReactNode; uid: string }) {
  const [tasks, setTasks] = useState<PersonalTask[]>([]);
  const [projects, setProjects] = useState<PersonalProject[]>([]);
  const [goals, setGoals] = useState<PersonalGoal[]>([]);
  const [notes, setNotes] = useState<PersonalNote[]>([]);
  const [loading, setLoading] = useState(Boolean(uid));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    const readySubscriptions = new Set<string>();
    const failedSubscriptions = new Set<string>();
    const markReady = (name: string) => {
      readySubscriptions.add(name);
      if (readySubscriptions.size === 4) {
        setLoading(false);
        setError(failedSubscriptions.size ? "No se pudieron sincronizar todos tus datos. Revisa tu conexión y las reglas de Firestore." : null);
      }
    };
    const handleError = (name: string, reason: Error) => {
      console.warn("No se pudieron sincronizar los datos del organizador", reason);
      failedSubscriptions.add(name);
      setError("No se pudieron sincronizar todos tus datos. Revisa tu conexión y las reglas de Firestore.");
      markReady(name);
    };

    const subscriptions = [
      subscribeToTasks(uid, (items) => { setTasks(items); failedSubscriptions.delete("tasks"); markReady("tasks"); }, (reason) => handleError("tasks", reason)),
      subscribeToProjects(uid, (items) => { setProjects(items); failedSubscriptions.delete("projects"); markReady("projects"); }, (reason) => handleError("projects", reason)),
      subscribeToGoals(uid, (items) => { setGoals(items); failedSubscriptions.delete("goals"); markReady("goals"); }, (reason) => handleError("goals", reason)),
      subscribeToNotes(uid, (items) => { setNotes(items); failedSubscriptions.delete("notes"); markReady("notes"); }, (reason) => handleError("notes", reason)),
    ];
    return () => subscriptions.forEach((unsubscribe) => unsubscribe());
  }, [uid]);

  const value = useMemo(() => ({ uid, loading, error, tasks, projects, goals, notes }), [uid, loading, error, tasks, projects, goals, notes]);
  return <OrganizerContext.Provider value={value}>{children}</OrganizerContext.Provider>;
}

export function useOrganizer() {
  const context = useContext(OrganizerContext);
  if (!context) throw new Error("useOrganizer debe usarse dentro de <OrganizerProvider>");
  return context;
}
