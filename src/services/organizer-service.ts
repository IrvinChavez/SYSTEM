import { addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, query, updateDoc, where, writeBatch } from "firebase/firestore";
import { firestore } from "@/config/firebase";
import { PersonalGoal, PersonalNote, PersonalProject, PersonalTask } from "@/data/system-data";

const userCollection = (uid: string, name: string) => collection(firestore, "users", uid, name);

function subscribe<T extends { id: string }>(
  uid: string,
  name: string,
  onChange: (items: T[]) => void,
  onError: (error: Error) => void,
) {
  return onSnapshot(userCollection(uid, name), (snapshot) => {
    onChange(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as T)));
  }, onError);
}

export const subscribeToTasks = (uid: string, onChange: (items: PersonalTask[]) => void, onError: (error: Error) => void) =>
  subscribe<PersonalTask>(uid, "tasks", onChange, onError);
export const subscribeToProjects = (uid: string, onChange: (items: PersonalProject[]) => void, onError: (error: Error) => void) =>
  subscribe<PersonalProject>(uid, "projects", onChange, onError);
export const subscribeToGoals = (uid: string, onChange: (items: PersonalGoal[]) => void, onError: (error: Error) => void) =>
  subscribe<PersonalGoal>(uid, "goals", onChange, onError);
export const subscribeToNotes = (uid: string, onChange: (items: PersonalNote[]) => void, onError: (error: Error) => void) =>
  subscribe<PersonalNote>(uid, "notes", onChange, onError);

export const addTask = (uid: string, value: Omit<PersonalTask, "id">) => addDoc(userCollection(uid, "tasks"), value);
export const updateTask = (uid: string, id: string, value: Omit<PersonalTask, "id">) => updateDoc(doc(userCollection(uid, "tasks"), id), value);
export const deleteTask = (uid: string, id: string) => deleteDoc(doc(userCollection(uid, "tasks"), id));

export const addProject = (uid: string, value: Omit<PersonalProject, "id">) => addDoc(userCollection(uid, "projects"), value);
export const updateProject = (uid: string, id: string, value: Omit<PersonalProject, "id">) => updateDoc(doc(userCollection(uid, "projects"), id), value);
export async function deleteProject(uid: string, id: string) {
  const relatedTasks = await getDocs(query(userCollection(uid, "tasks"), where("projectId", "==", id)));
  const writes = relatedTasks.docs;
  for (let start = 0; start < writes.length; start += 450) {
    const batch = writeBatch(firestore);
    writes.slice(start, start + 450).forEach((task) => batch.update(task.ref, { projectId: null }));
    if (start + 450 >= writes.length) batch.delete(doc(userCollection(uid, "projects"), id));
    await batch.commit();
  }
  if (writes.length === 0) await deleteDoc(doc(userCollection(uid, "projects"), id));
}

export const addGoal = (uid: string, value: Omit<PersonalGoal, "id">) => addDoc(userCollection(uid, "goals"), value);
export const updateGoal = (uid: string, id: string, value: Omit<PersonalGoal, "id">) => updateDoc(doc(userCollection(uid, "goals"), id), value);
export const deleteGoal = (uid: string, id: string) => deleteDoc(doc(userCollection(uid, "goals"), id));

export const addNote = (uid: string, value: Omit<PersonalNote, "id">) => addDoc(userCollection(uid, "notes"), value);
export const updateNote = (uid: string, id: string, value: Omit<PersonalNote, "id">) => updateDoc(doc(userCollection(uid, "notes"), id), value);
export const deleteNote = (uid: string, id: string) => deleteDoc(doc(userCollection(uid, "notes"), id));
