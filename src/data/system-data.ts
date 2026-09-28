export type StatKey = "STR" | "INT" | "VIT" | "AGI" | "PER";

export type Mission = {
  id: string;
  title: string;
  time: string;
  icon: string;
  xp: number;
  stat: StatKey;
};

export type AgendaEvent = {
  id: string;
  title: string;
  date: string;
  start: string;
  end: string;
  location: string;
  category: string;
};

export type PlayerStats = Record<StatKey, number>;

export type PlayerProfile = {
  name: string;
  username: string;
  // Foto de perfil como data URI JPEG de 256 px (cabe de sobra en el documento de Firestore).
  photo: string | null;
  totalXp: number;
  stats: PlayerStats;
};

// Lo que otorgó cada misión completada ese día, para restar exactamente lo mismo si se desmarca
// (aunque la misión se haya editado después).
export type MissionReward = { xp: number; stat: StatKey };

export type DailyProgress = {
  dateKey: string;
  completedMissionIds: string[];
  rewards: Record<string, MissionReward>;
  totalMissions: number;
};

export const statInfo: Record<StatKey, { label: string; icon: string; description: string }> = {
  STR: { label: "Fuerza", icon: "◆", description: "Ejercicio y actividad física" },
  INT: { label: "Inteligencia", icon: "▤", description: "Estudio, lectura y proyectos" },
  VIT: { label: "Vitalidad", icon: "✚", description: "Sueño, alimentación y salud" },
  AGI: { label: "Agilidad", icon: "➶", description: "Organización y productividad" },
  PER: { label: "Percepción", icon: "◉", description: "Meditación y bienestar mental" },
};

export const statKeys = Object.keys(statInfo) as StatKey[];

export const emptyStats: PlayerStats = { STR: 0, INT: 0, VIT: 0, AGI: 0, PER: 0 };

export const difficultyOptions = [
  { label: "Fácil", xp: 10 },
  { label: "Normal", xp: 20 },
  { label: "Difícil", xp: 35 },
  { label: "Élite", xp: 50 },
];

export const missionIcons = ["☼", "◇", "▣", "▤", "⌂", "▥", "◆", "✚", "➶", "◉", "♫", "☾"];

export const eventCategories = ["CLASE", "TRABAJO", "EXAMEN", "PERSONAL", "OTRO"];

// Misiones con las que arranca cada cuenta nueva.
export const starterMissions: Omit<Mission, "id">[] = [
  { title: "Levantarse temprano", time: "06:30", icon: "☼", xp: 20, stat: "VIT" },
  { title: "Entrenamiento", time: "07:00", icon: "◇", xp: 35, stat: "STR" },
  { title: "Universidad / Trabajo", time: "09:00", icon: "▣", xp: 20, stat: "AGI" },
  { title: "Estudio / Proyecto", time: "16:00", icon: "▤", xp: 35, stat: "INT" },
  { title: "Ordenar espacio", time: "20:00", icon: "⌂", xp: 10, stat: "AGI" },
  { title: "Lectura", time: "21:00", icon: "▥", xp: 20, stat: "INT" },
];

// Sugerencias del Sistema agrupadas por la estadística que entrenan.
export const suggestedMissions: Record<StatKey, Omit<Mission, "id">[]> = {
  STR: [
    { title: "100 flexiones", time: "07:00", icon: "◆", xp: 35, stat: "STR" },
    { title: "Correr 5 km", time: "06:45", icon: "➶", xp: 50, stat: "STR" },
  ],
  INT: [
    { title: "Leer 20 páginas", time: "21:00", icon: "▥", xp: 20, stat: "INT" },
    { title: "Repasar apuntes", time: "18:00", icon: "▤", xp: 20, stat: "INT" },
  ],
  VIT: [
    { title: "Beber 2 L de agua", time: "12:00", icon: "✚", xp: 10, stat: "VIT" },
    { title: "Dormir antes de las 23:00", time: "22:30", icon: "☾", xp: 20, stat: "VIT" },
  ],
  AGI: [
    { title: "Planear el día siguiente", time: "21:30", icon: "▣", xp: 10, stat: "AGI" },
    { title: "Bandeja de entrada en cero", time: "10:00", icon: "➶", xp: 20, stat: "AGI" },
  ],
  PER: [
    { title: "Meditar 10 minutos", time: "07:30", icon: "◉", xp: 20, stat: "PER" },
    { title: "Escribir en el diario", time: "22:00", icon: "♫", xp: 10, stat: "PER" },
  ],
};
