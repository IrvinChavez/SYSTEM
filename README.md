# SYSTEM — Organización personal

**SYSTEM** es una aplicación de organización personal para web, Android e iOS. Reúne tareas, proyectos, metas, notas, hábitos y agenda; ofrece una vista diaria clara y un asistente de IA que pregunta antes de planificar y propone cambios para que la persona los revise. La interfaz mantiene una paleta oscura y usa lavanda solo para acciones y estados seleccionados.

> Proyecto de la materia Aplicaciones Móviles (DS42M, Unidad 2 — Conexiones): autenticación, base de datos en la nube y consumo de APIs externas.

---

## ¿Qué problema resuelve?

SYSTEM ayuda a mantener una visión realista del día y evita depender de una agenda genérica:

1. **Muestra primero** prioridades, compromisos próximos y hábitos del día.
2. **Separa** tareas, proyectos, metas y notas para dar seguimiento sin inventar fechas ni avances.
3. **Sincroniza** los datos de la cuenta entre web y móvil con Firestore.
4. **Asiste al planificar**: la IA usa el contexto disponible y deja las propuestas bajo control de la persona.

## Funcionalidades

| Pantalla | Qué hace |
|---|---|
| **Ingreso / Registro** | Cuenta con **nombre de usuario y contraseña**, o **registro e ingreso con huella / Face ID** (Android e iOS). La sesión se conserva al cerrar la app. |
| **Inicio** | Fecha, tareas prioritarias, próximos compromisos, progreso de hábitos y accesos a proyectos, metas, notas y asistente. |
| **Planificar** | Agenda vertical de los próximos días, duración de eventos, temporizador de actividad y conexión opcional con Notion Calendar. |
| **Tareas** | Crear, editar, priorizar y completar tareas; añadir una fecha solo cuando se conoce, estimación y proyecto asociado. |
| **Hábitos** | Registrar hábitos diarios y su hora; el seguimiento se reinicia a medianoche. Las cuentas nuevas no reciben rutinas inventadas. |
| **Proyectos / Metas / Notas** | Guardar resultado esperado y siguiente acción de proyectos, seguimiento de metas a corto/medio/largo plazo, y notas personales. |
| **Asistente** | Entrevista breve, planificación diaria/semanal, vaciado de pendientes y revisiones. Puede proponer cambios en tareas, hábitos y agenda; la persona los aprueba antes de guardarlos. Las notas no se envían al proveedor de IA. |
| **Perfil** | Nombre, foto, resumen de tareas/proyectos/metas, cuestionario opcional para conocer rutina y propósitos, consentimiento separado para personalización con IA, seguridad biométrica, cierre y eliminación de cuenta, y política de privacidad. |

## Tecnologías

| Capa | Tecnología |
|---|---|
| App (Android, iOS y web) | [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/), React Native 0.88, React 19.3, TypeScript, Expo Router (rutas por archivos) |
| Autenticación | Firebase Authentication |
| Base de datos | Cloud Firestore (tiempo real, con caché local) |
| IA | [Groq Cloud](https://console.groq.com) — modelo `openai/gpt-oss-120b`, llamado desde una ruta de servidor propia |
| API externa | [DummyJSON Quotes](https://dummyjson.com/docs/quotes) — frase del día |
| Calendario | Notion Calendar vía la dirección iCal secreta de Google Calendar (también iCloud / Outlook), descargada por `/api/calendar` |
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
    (tabs)/                  Inicio, Planificar, Tareas, Hábitos, Perfil y rutas secundarias
    api/ai+api.ts            Ruta de SERVIDOR: proxy seguro hacia Groq
    api/calendar+api.ts      Ruta de SERVIDOR: descarga el .ics de tu calendario (hosts permitidos)
  server/                    Código compartido de las rutas /api (verificación de sesión, límite de peticiones)
  context/                   auth-context, player-context y organizer-context (datos en tiempo real)
  services/                  player-service, organizer-service (Firestore), ai-service y quote-service
  lib/                       Lógica pura y probada: niveles, rachas, fechas y duraciones, lector .ics, usuario, validación de la IA
  components/                UI compartida (chat, avatar, formularios, fila de misión…)
  data/                      Tipos de tareas, proyectos, metas, notas, eventos y hábitos
tests/                       Pruebas unitarias y de reglas de Firestore
assets/art/                  Ilustraciones originales en SVG (fuente de assets/images/)
firestore.rules              Reglas de seguridad de la base de datos
api/index.js, vercel.json    Despliegue en Vercel
eas.json                     Compilación de la app Android/iOS
```

### Modelo de datos (Firestore)

```
users/{uid}                          name, username, photo, calendarUrl, totalXp, stats{STR,INT,VIT,AGI,PER}
users/{uid}/missions/{id}            title, time, icon, xp, stat
users/{uid}/events/{id}              title, date, start, end, location, category, source? ("calendar" = importado)
users/{uid}/dailyProgress/{fecha}    completedMissionIds[], rewards{id:{xp,stat}}, totalMissions
users/{uid}/tasks/{id}               title, description, status, priority, dueDate?, estimateMinutes?, projectId?
users/{uid}/projects/{id}            title, purpose, status, nextAction, deadline?
users/{uid}/goals/{id}               title, measure, nextStep, horizon, targetDate?, status
users/{uid}/notes/{id}               title, body
users/{uid}/discovery/profile        rutinas, áreas, objetivos y preferencias de apoyo; permiso de IA explícito
```

### Progreso de hábitos existente

Las cuentas existentes conservan sus hábitos y el progreso histórico: cada hábito mantiene su dificultad/EXP y estadística, y el perfil conserva niveles y rachas. Las cuentas nuevas empiezan sin hábitos precargados; cada quien registra su propia rutina.

## Decisiones de diseño importantes

- **La key de la IA nunca sale del servidor.** La app llama a `/api/ai` con el token de sesión de Firebase; esa ruta verifica la firma del token con las llaves públicas de Google, limita tamaño y frecuencia de peticiones (20/min por usuario) y solo entonces llama a Groq con `GROQ_API_KEY`.
- **La IA propone, la persona decide.** El contexto y las propuestas se validan en `src/lib/plan.ts`: no acepta ids inventados, horas o fechas inválidas ni valores fuera de rango. Los cambios aprobados se guardan en una escritura atómica.
- **Personalización voluntaria.** El cuestionario no es una evaluación y se puede omitir, editar o borrar. Sus respuestas se quedan fuera de las peticiones a la IA salvo que la persona active explícitamente el consentimiento; no se piden datos médicos.
- **Sincronización transparente.** Las ediciones comunes se reflejan en la caché local y se sincronizan en segundo plano (`syncInBackground` en `src/lib/confirm.ts`), con aviso si el servidor las rechaza. Las propuestas del asistente muestran que están guardándose y solo se marcan sincronizadas después de la confirmación del servidor; si fallan, se pueden reintentar.
- **EXP a prueba de trampas.** Cada día guarda cuánta EXP otorgó cada misión; al desmarcarla se resta exactamente eso, aunque la misión se haya editado después. Las listas se actualizan con `arrayUnion`/`arrayRemove` para que dos toques rápidos no se pisen.
- **Usuario en lugar de correo.** Firebase Auth solo acepta correos, así que `usuario` se guarda como `usuario@jugadores.system-app.com` de forma invisible. Firebase garantiza que no haya dos usuarios iguales. Las cuentas antiguas con correo pueden seguir entrando escribiendo el correo.
- **Fotos sin Firebase Storage.** La foto se recorta y reduce a 256 px JPEG (~20 KB) y se guarda en el documento del usuario, así no se necesita el plan de pago de Firebase.
- **Fechas en hora local**, no UTC (en México, `toISOString()` cambiaría de día a las 18:00).

### Notion Calendar

Notion Calendar no tiene API pública: sus eventos viven en tu cuenta de Google Calendar. En **Agenda → Notion Calendar → Conectar** pegas la *dirección secreta en formato iCal* de ese calendario (Google Calendar web → Configuración → tu calendario → Integrar el calendario). Desde ahí:

- Se sincroniza al abrir la app, cada 15 min mientras está abierta y con el botón **Sincronizar**. Copia los eventos con hora de los próximos 14 días, incluidas las clases que se repiten (lunes y miércoles…), excepciones y clases movidas.
- Los eventos importados tienen id estable (`cal-<hash>`), así que sincronizar varias veces o desde dos teléfonos no duplica nada. Se muestran con la etiqueta NOTION y un candado: se editan en Notion Calendar, y la IA tiene prohibido moverlos o borrarlos (lo valida `src/lib/plan.ts`), solo acomoda tus misiones alrededor.
- `/api/calendar` solo descarga de `calendar.google.com`, `*.icloud.com` y Outlook, para que no pueda usarse como proxy hacia cualquier sitio.

### Huella / Face ID

Firebase Auth no maneja huellas (y la huella nunca sale del teléfono). Lo que hace `src/services/biometric-service.ts` es guardar usuario y contraseña en `expo-secure-store` con `requireAuthentication`: la llave vive en Android Keystore / iOS Keychain y solo la desbloquea tu biometría.

- **Registrarme con huella**: solo eliges usuario; la app genera una contraseña aleatoria de 24 caracteres (`expo-crypto`) y la guarda protegida. En Perfil → Seguridad → *Ver mi contraseña* la puedes consultar (con huella) para respaldarla.
- **Ingreso con contraseña + "Activar ingreso con huella"**: pide la huella antes de entrar y la guarda solo si el ingreso funciona.
- Si agregas o quitas huellas del teléfono, el sistema invalida la llave a propósito: la app la borra y pide entrar con contraseña.
- Solo Android/iOS (en web no aparece). En iPhone, Face ID no funciona en Expo Go: necesita un development build o el APK/IPA de EAS.

## Tokens visuales

Los colores de móvil y web salen de `src/constants/system-colors.ts`:

| Token | Color | Uso |
|---|---|---|
| `background` / `backgroundRaised` | `#121212` / `#1A1A1A` | Fondos |
| `card` / `cardAlt` | `#242424` / `#2D2D2D` | Tarjetas y elementos elevados |
| `border` / `borderMuted` | `#3A3A3A` / `#2D2D2D` | Bordes |
| `primary` / `accent` | `#8B9CF6` | Acciones, selección y enlaces |
| `text` / `textMuted` / `textFaint` | `#F5F5F5` / `#A3A3A3` / `#707070` | Texto |
| `success` / `warning` / `danger` | `#6FCF97` / `#E6B566` / `#E57373` | Estados |

## Cómo correrlo

Requisitos: Node 20+ y un proyecto de Firebase con **Authentication → Correo/contraseña** habilitado y Firestore creado.

```bash
npm ci --legacy-peer-deps       # instalación reproducible desde el lockfile
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

- Sin correo real, **la contraseña no se puede recuperar**; hay que crear otra cuenta. En cuentas creadas con huella, si pierdes el teléfono sin haber respaldado la contraseña (Perfil → Ver mi contraseña), pierdes la cuenta.
- La EXP la calcula el cliente: un usuario con conocimientos técnicos podría modificar sus propios números (solo los suyos). Para un ranking entre jugadores habría que moverlo a Cloud Functions.
- El límite de peticiones de la IA es por instancia del servidor, no global.
- No hay notificaciones push de recordatorio.
- El calendario es de **una sola vía** (Notion Calendar → app): lo que crees en la app o con la IA no aparece en Notion Calendar. Escribir allá requeriría OAuth de Google Calendar.
- Los eventos de todo el día no se importan (chocarían con todo en la agenda), y las repeticiones mensuales complejas (p. ej. "el segundo martes") solo importan la primera fecha.

## Créditos

- Ilustraciones: originales, creadas para este proyecto en `assets/art/` (inspiradas en la estética de *Solo Leveling*, sin usar arte oficial). Se pueden reemplazar conservando los nombres de archivo en `assets/images/`.
- *Solo Leveling* es obra de Chugong; este es un proyecto escolar sin fines de lucro y sin afiliación.
