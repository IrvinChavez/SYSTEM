// Paleta "Sistema azul": fondo negro y azul eléctrico como color de acción.
// Todos los colores de la app salen de aquí; no escribas hex sueltos en las pantallas.
export const systemColors = {
  background: "#05070B",
  backgroundRaised: "#0A0E15",
  card: "#0D121C",
  cardAlt: "#121A28",
  border: "#1C2B45",
  borderMuted: "#141F33",
  primary: "#2F6BFF",
  primarySoft: "#11244A",
  surfaceActive: "#0B1830",
  accent: "#5C9DFF",
  // Eventos importados de Notion Calendar.
  highlight: "#38C6E8",
  text: "#EAF1FF",
  textMuted: "#8FA0BD",
  textFaint: "#62728F",
  success: "#65D6A0",
  warning: "#F2C46D",
  danger: "#FF6B81",
  overlay: "rgba(0, 0, 0, 0.8)",
};

// Resplandor azul para boxShadow / textShadow.
export const glow = (alpha: number) => `rgba(47, 107, 255, ${alpha})`;
