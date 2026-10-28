import { Stack } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { systemColors } from "@/constants/system-colors";

// Página pública (sin sesión) con la política de privacidad: Google Play pide su URL al publicar la app.
const sections: { title: string; body: string }[] = [
  {
    title: "Qué datos guardamos",
    body: "Tu nombre de usuario, tu contraseña (gestionada por Firebase Authentication; nosotros nunca la vemos), nombre y foto opcional, tareas, proyectos, metas, notas, hábitos, eventos de agenda y el progreso diario de hábitos.",
  },
  {
    title: "Dónde se guardan",
    body: "En Google Firebase (Authentication y Cloud Firestore). Cada cuenta solo puede leer y modificar sus propios datos.",
  },
  {
    title: "Huella y Face ID (opcional)",
    body: "Si activas el ingreso con huella, tu usuario y contraseña se guardan cifrados solo en tu teléfono (Android Keystore / iOS Keychain) y solo se desbloquean con tu biometría. Tu huella o tu rostro nunca salen del teléfono: ni nosotros ni Firebase los recibimos.",
  },
  {
    title: "Calendario externo (opcional)",
    body: "Si conectas Notion Calendar, guardamos en tu cuenta la dirección secreta en formato iCal que pegues y copiamos a tu agenda los eventos con hora de los próximos 14 días (título, fecha, horario y lugar). Nuestro servidor descarga ese calendario solo para importarlo y no lo conserva. Nunca modificamos tu calendario. Al desconectarlo se borran el enlace y los eventos importados de hoy en adelante.",
  },
  {
    title: "Inteligencia artificial",
    body: "Cuando usas el asistente o el generador de hábitos, enviamos a Groq (proveedor del modelo de IA) tu mensaje y un resumen de tus tareas, proyectos, metas, hábitos y agenda para generar la respuesta. Las respuestas opcionales del cuestionario personal solo se incluyen si activas expresamente la personalización con IA; puedes revocar ese permiso en el cuestionario desde Perfil. No enviamos tus notas, contraseña ni foto.",
  },
  {
    title: "Cuestionario personal (opcional)",
    body: "Puedes responder preguntas sobre tus áreas de atención, rutinas, horarios, objetivos, obstáculos y prioridades de cuidado. Las respuestas se guardan en tu espacio privado de Firestore para adaptar tu planificación. Puedes omitir el cuestionario, editarlo o borrar tus respuestas desde Perfil. No solicitamos información médica ni es una evaluación.",
  },
  {
    title: "Frases motivacionales",
    body: "La frase del día se obtiene de la API pública de DummyJSON. Esa petición no incluye ningún dato tuyo.",
  },
  {
    title: "Lo que no hacemos",
    body: "No vendemos ni compartimos tus datos con terceros para publicidad, no mostramos anuncios y no rastreamos tu ubicación.",
  },
  {
    title: "Eliminar tu cuenta",
    body: "En Perfil → Zona de peligro → Eliminar cuenta puedes borrar tu cuenta y todos tus datos de forma permanente en cualquier momento.",
  },
  {
    title: "Contacto",
    body: "Para dudas sobre tus datos, escribe al correo de contacto que aparece en la ficha de la app en la tienda.",
  },
];

export default function PrivacyScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ title: "Política de privacidad" }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.tag}>[ SYSTEM ]</Text>
        <Text style={styles.title}>Política de privacidad</Text>
        <Text style={styles.updated}>Última actualización: 27 de octubre de 2026</Text>
        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.body}>{section.body}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: systemColors.background,
  },
  content: {
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
    padding: 20,
    gap: 16,
  },
  tag: {
    color: systemColors.accent,
    fontSize: 11,
    letterSpacing: 2,
  },
  title: {
    color: systemColors.text,
    fontSize: 26,
    fontWeight: "700",
  },
  updated: {
    color: systemColors.textFaint,
    fontSize: 12,
  },
  section: {
    gap: 6,
    borderWidth: 1,
    borderColor: systemColors.border,
    borderRadius: 12,
    backgroundColor: systemColors.card,
    padding: 14,
  },
  sectionTitle: {
    color: systemColors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  body: {
    color: systemColors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
});
