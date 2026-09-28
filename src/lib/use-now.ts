import { useEffect, useState } from "react";

// Hora actual que se refresca sola cada `intervalMs` (1 s para cronómetros, más para textos como "en 20 min").
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(interval);
  }, [intervalMs]);
  return now;
}
