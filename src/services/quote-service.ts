// API externa: DummyJSON (https://dummyjson.com/docs/quotes). Pública, sin API key y con CORS habilitado,
// así que funciona igual en Android, iOS y web. Para cambiar de proveedor basta con reemplazar esta función
// manteniendo el tipo Quote.
const QUOTES_API_URL = process.env.EXPO_PUBLIC_QUOTES_API_URL ?? "https://dummyjson.com/quotes/random";

export type Quote = {
  text: string;
  author: string;
};

const fallbackQuote: Quote = {
  text: "La disciplina es el puente entre tus objetivos y la realidad.",
  author: "Jim Rohn",
};

export async function fetchRandomQuote(): Promise<{ quote: Quote; fromApi: boolean }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(QUOTES_API_URL, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    if (typeof data.quote !== "string" || typeof data.author !== "string") {
      throw new Error("Respuesta inesperada de la API de frases");
    }

    return { quote: { text: data.quote, author: data.author }, fromApi: true };
  } catch (error) {
    console.warn("No se pudo obtener la frase de la API externa.", error);
    return { quote: fallbackQuote, fromApi: false };
  } finally {
    clearTimeout(timeout);
  }
}
