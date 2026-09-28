# SYSTEM — Hábitos estilo Solo Leveling

**SYSTEM** es una app móvil y web para construir hábitos convirtiéndolos en un juego de rol. Inspirada en *Solo Leveling*, cada hábito diario es una **misión**: al completarla ganas EXP, subes de nivel y de rango (E → S) y entrenas cinco estadísticas (Fuerza, Inteligencia, Vitalidad, Agilidad y Percepción). Un asistente con IA, "el Sistema", conoce tu progreso y tu agenda, y **acomoda tus misiones y eventos a tu horario** cuando le cuentas lo que quieres hacer.

> Proyecto de la materia Aplicaciones Móviles (DS42M, Unidad 2 — Conexiones): autenticación, base de datos en la nube y consumo de APIs externas.

---

## ¿Qué problema resuelve?

Mantener hábitos es difícil porque el progreso es invisible y el día a día se desordena. SYSTEM:

1. **Hace visible el progreso**: EXP, niveles, rangos, rachas de días perfectos y porcentaje semanal.
2. **Da una recompensa inmediata** al marcar cada misión, con subida de nivel incluida.
3. **Organiza el día**: agenda de clases/trabajo y una IA que reacomoda tus hábitos alrededor de tus compromisos, sin choques de horario.

## Funcionalidades

| Pantalla | Qué hace |
|---|---|
| **Ingreso / Registro** | Cuenta con **nombre de usuario y contraseña**. La sesión se conserva al cerrar la app. |
| **Inicio** | Estado del jugador (nivel, EXP, rango), accesos rápidos, mensaje del Sistema, misión diaria, resumen y próximo evento. |
| **Misiones** | Crear, editar y eliminar hábitos (hora, dificultad/EXP, estadística, ícono). Se reinician cada medianoche. |
| **Agenda** | Eventos de los próximos 7 días (clases, trabajo, exámenes). |
| **IA** | Chat con el Sistema que **propone cambios** (crear/mover/borrar misiones y eventos) que aplicas con un botón, avisando de choques de horario. Genera misiones para la estadística que elijas. Muestra una frase motivacional de una API externa. |
| **Perfil** | Foto de perfil (galería o cámara), estadísticas, racha, cambiar nombre, cerrar sesión, **eliminar cuenta** y política de privacidad. |

## Tecnologías

| Capa | Tecnología |
|---|---|
| App (Android, iOS y web) | [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/), React Native 0.86, React 19, TypeScript, Expo Router (rutas por archivos) |
| Autenticación | Firebase Authentication |
| Base de datos | Cloud Firestore (tiempo real, con caché local) |
| IA | [Groq Cloud](https://console.groq.com) — modelo `openai/gpt-oss-120b`, llamado desde una ruta de servidor propia |
| API externa | [DummyJSON Quotes](https://dummyjson.com/docs/quotes) — frase del día |
| Imágenes | `expo-image`, `expo-image-picker`, `expo-image-manipulator` |
| Pruebas | `node:test` (lógica) + Firebase Emulator con `@firebase/rules-unit-testing` (reglas de seguridad) |
| Publicación | Vercel (web + API con dominio propio) y EAS Build (APK / Play Store) |

## Arquitectura

```
┌───────────────────────┐        ┌──────────────────────────┐
│  App (Android / web)   │──────▶│ Firebase Auth + Firestore │  datos del jugador
│  Expo Router + React   │        └──────────────────────────┘
│                        │        ┌──────────────────────────┐        ┌──────────┐
│                        │──────▶│  /api/ai  (servidor)      │──────▶│ Groq API │
│                        │ token  │  verifica sesión Firebase │  key   └──────────┘
│                        │        └──────────────────────────┘
│                        │──────▶  DummyJSON (frase del día, sin datos del usuario)
└───────────────────────┘
```

```
src/
  app/                       Pantallas y rutas (Expo Router)
    _layout.tsx              AuthProvider + rutas protegidas (Stack.Protected)
    login.tsx, register.tsx  Ingreso con usuario y contraseña
    privacidad.tsx           Política de privacidad (pública)
    (tabs)/                  Inicio, Misiones, Agenda, IA (system.tsx), Perfil
    api/ai+api.ts            Ruta de SERVIDOR: proxy seguro hacia Groq
  context/                   auth-context (sesión) y player-context (datos en tiempo real)
  services/                  player-service (Firestore), ai-service (IA), quote-service (API de frases)
  lib/                       Lógica pura y probada: niveles, rachas, fechas, usuario, validación de la IA
  components/                UI compartida (chat, avatar, formularios, fila de misión…)
  data/                      Tipos, misiones iniciales y sugeridas
tests/                       Pruebas unitarias y de reglas de Firestore
assets/art/                  Ilustraciones originales en SVG (fuente de assets/images/)
firestore.rules              Reglas de seguridad de la base de datos
api/index.js, vercel.json    Despliegue en Vercel
eas.json                     Compilación de la app Android/iOS
```

### Modelo de datos (Firestore)

```
users/{uid}                          name, username, photo, totalXp, stats{STR,INT,VIT,AGI,PER}
users/{uid}/missions/{id}            title, time, icon, xp, stat
users/{uid}/events/{id}              title, date, start, end, location, category
users/{uid}/dailyProgress/{fecha}    completedMissionIds[], rewards{id:{xp,stat}}, totalMissions
```

### Reglas del juego

- Subir del nivel *n* al *n+1* cuesta `n × 100` EXP.
- Rangos: **E** (1–4), **D** (5–9), **C** (10–19), **B** (20–34), **A** (35–49), **S** (50+).
- Dificultad de misión: Fácil 10 · Normal 20 · Difícil 35 · Élite 50 EXP. Cada misión suma 1 punto a su estadística.
- **Día perfecto** = todas las misiones completadas; la **racha** cuenta días perfectos seguidos.

## Decisiones de diseño importantes

- **La key de la IA nunca sale del servidor.** La app llama a `/api/ai` con el token de sesión de Firebase; esa ruta verifica la firma del token con las llaves públicas de Google, limita tamaño y frecuencia de peticiones (20/min por usuario) y solo entonces llama a Groq con `GROQ_API_KEY`.
- **La IA propone, el usuario decide.** Todo lo que devuelve el modelo se valida en `src/lib/plan.ts`: no acepta ids inventados, horas o fechas inválidas ni valores fuera de rango. Los choques de horario se calculan en código, no se confía en el modelo. Los cambios aprobados se guardan en **una sola escritura atómica**.
- **Funciona sin conexión.** Firestore aplica cada cambio al instante en caché y lo sincroniza después. Por eso la interfaz **nunca espera** a que el servidor confirme una escritura (`syncInBackground` en `src/lib/confirm.ts`); solo avisa si el servidor la rechaza.
- **EXP a prueba de trampas.** Cada día guarda cuánta EXP otorgó cada misión; al desmarcarla se resta exactamente eso, aunque la misión se haya editado después. Las listas se actualizan con `arrayUnion`/`arrayRemove` para que dos toques rápidos no se pisen.
- **Usuario en lugar de correo.** Firebase Auth solo acepta correos, así que `usuario` se guarda como `usuario@jugadores.system-app.com` de forma invisible. Firebase garantiza que no haya dos usuarios iguales. Las cuentas antiguas con correo pueden seguir entrando escribiendo el correo.
- **Fotos sin Firebase Storage.** La foto se recorta y reduce a 256 px JPEG (~20 KB) y se guarda en el documento del usuario, así no se necesita el plan de pago de Firebase.
- **Fechas en hora local**, no UTC (en México, `toISOString()` cambiaría de día a las 18:00).

## Cómo correrlo

Requisitos: Node 20+ y un proyecto de Firebase con **Authentication → Correo/contraseña** habilitado y Firestore creado.

```bash
npm install --include=dev        # --include=dev por si tu terminal tiene NODE_ENV=production
echo "GROQ_API_KEY=gsk_..." > .env.local   # tu key de https://console.groq.com/keys (.env ya trae Firebase)
npm start                        # abre con Expo Go (QR), en emulador, o pulsa "w" para web
```

### Variables de entorno

| Archivo | Variable | ¿Secreta? | Uso |
|---|---|---|---|
| `.env` (sí se sube a git) | `EXPO_PUBLIC_FIREBASE_*` | No — la seguridad la dan las reglas | Conexión a Firebase |
| `.env` | `EXPO_PUBLIC_API_URL` | No | Solo en el APK: tu dominio, para llegar a `/api/ai` |
| `.env.local` (no se sube) | `GROQ_API_KEY` | **Sí** | Solo la lee el servidor |
| `.env.local` | `GROQ_MODEL` | No | Opcional, por defecto `openai/gpt-oss-120b` |
| `.env.local` / Vercel | `AI_ALLOWED_USERS` | No | Uso personal: usuarios que pueden usar la IA (`irvin,otro`). Vacío = todos |
| `.env` | `EXPO_PUBLIC_SIGNUP_OPEN` | No | Uso personal: `false` oculta el registro en la app |

## Scripts

| Comando | Qué hace |
|---|---|
| `npm start` | Servidor de desarrollo (app + rutas `/api`) |
| `npm run check` | TypeScript + ESLint + pruebas unitarias |
| `npm test` | Pruebas de la lógica (niveles, rachas, fechas, usuario, validación de la IA) |
| `npm run test:rules` | Prueba las reglas de Firestore en el emulador local (requiere Java) |
| `npm run deploy:rules` | Publica `firestore.rules` en Firebase |

## Publicación

### Web con tu dominio (Vercel, gratis)

1. Sube el proyecto a un repositorio **privado** de GitHub e impórtalo en [vercel.com](https://vercel.com) (*Add New → Project*). No cambies nada en *Build settings*: `vercel.json` ya configura el build (`expo export -p web`) y la función que sirve la web y `/api/ai`.
2. En *Settings → Environment Variables* agrega `GROQ_API_KEY` y `EXPO_PUBLIC_FIREBASE_PROJECT_ID` (y `AI_ALLOWED_USERS` si es de uso personal). Luego *Deployments → Redeploy*.
3. En *Settings → Domains* agrega tu dominio y crea en tu proveedor de DNS el registro que indique Vercel (normalmente `A @ 76.76.21.21` para el dominio raíz o `CNAME` a `cname.vercel-dns.com` para un subdominio). El HTTPS se configura solo.

### Uso personal (que nadie más use tu app)

1. Entra a tu dominio y **crea tu cuenta**.
2. En Firebase Console → *Authentication → Settings → User actions*, desactiva **Enable create (sign-up)**. Esto bloquea el registro de verdad, incluso para quien use la API de Firebase directamente.
3. En Vercel agrega `AI_ALLOWED_USERS=tu_usuario` para que solo tú gastes la cuota de Groq.
4. Opcional: `EXPO_PUBLIC_SIGNUP_OPEN=false` en `.env` para ocultar la pantalla de registro.

### App Android (EAS Build)

1. `npm install -g eas-cli` y `eas login` (cuenta gratuita de Expo).
2. En `.env` pon `EXPO_PUBLIC_API_URL=https://tudominio.com` (la web debe estar publicada primero: la app usa su `/api/ai`).
3. `eas build -p android --profile preview` → genera un **APK** que se instala directo en cualquier Android.
4. Para Google Play: `eas build -p android --profile production` (genera `.aab`) y súbelo en Play Console. La URL de privacidad es `https://tudominio.com/privacidad`.

## Limitaciones conocidas

- Sin correo real, **la contraseña no se puede recuperar**; hay que crear otra cuenta.
- La EXP la calcula el cliente: un usuario con conocimientos técnicos podría modificar sus propios números (solo los suyos). Para un ranking entre jugadores habría que moverlo a Cloud Functions.
- El límite de peticiones de la IA es por instancia del servidor, no global.
- No hay notificaciones push de recordatorio.

## Créditos

- Ilustraciones: originales, creadas para este proyecto en `assets/art/` (inspiradas en la estética de *Solo Leveling*, sin usar arte oficial). Se pueden reemplazar conservando los nombres de archivo en `assets/images/`.
- *Solo Leveling* es obra de Chugong; este es un proyecto escolar sin fines de lucro y sin afiliación.
