// Permite que `node --test` resuelva el alias "@/..." del proyecto (tsconfig paths) al ejecutar TypeScript.
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";

const src = new URL("../src/", import.meta.url);

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      // fileURLToPath (no .pathname) para que rutas con espacios no queden como %20.
      const base = fileURLToPath(new URL(specifier.slice(2), src));
      const file = [".ts", ".tsx", "/index.ts"].map((ext) => base + ext).find((candidate) => existsSync(candidate));
      if (file) return nextResolve(pathToFileURL(file).href, context);
    }
    return nextResolve(specifier, context);
  },
});
