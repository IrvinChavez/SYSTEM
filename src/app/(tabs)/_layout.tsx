import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router/js-tabs";
import { ComponentProps } from "react";
import { ColorValue, useWindowDimensions } from "react-native";
import { LevelUpNotice } from "@/components/level-up-notice";
import { systemColors } from "@/constants/system-colors";
import { DiscoveryProvider } from "@/context/discovery-context";
import { OrganizerProvider } from "@/context/organizer-context";
import { PlayerProvider } from "@/context/player-context";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

// Ícono relleno en la pestaña activa y de contorno en las demás, para que se note dónde estás.
const tabIcon = (name: IoniconName, outline: IoniconName) => function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
  return <Ionicons name={focused ? name : outline} size={25} color={color as string} />;
};

export default function TabsLayout() {
  const { width } = useWindowDimensions();
  const desktop = width >= 920;

  return (
    <PlayerProvider>
      <OrganizerProvider>
        <DiscoveryProvider>
          <Tabs
            screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: systemColors.background },
          tabBarPosition: desktop ? "left" : "bottom",
          tabBarLabelPosition: desktop ? "beside-icon" : "below-icon",
          tabBarActiveTintColor: systemColors.accent,
          tabBarInactiveTintColor: systemColors.textMuted,
          tabBarActiveBackgroundColor: systemColors.surfaceActive,
          tabBarLabelStyle: { fontSize: desktop ? 14 : 11, fontWeight: "600" },
          tabBarStyle: {
            width: desktop ? 232 : undefined,
            height: desktop ? undefined : 68,
            paddingTop: desktop ? 20 : 4,
            paddingHorizontal: desktop ? 14 : 0,
            backgroundColor: systemColors.background,
            borderTopColor: systemColors.borderMuted,
            borderRightColor: systemColors.borderMuted,
          },
          tabBarItemStyle: { minHeight: 48, borderRadius: 10, marginBottom: 4 },
            }}
          >
          <Tabs.Screen name="index" options={{ title: "Inicio", tabBarIcon: tabIcon("home", "home-outline") }} />
          <Tabs.Screen name="agenda" options={{ title: "Planificación", tabBarIcon: tabIcon("calendar", "calendar-outline") }} />
          <Tabs.Screen name="tasks" options={{ title: "Tareas", tabBarIcon: tabIcon("checkmark-done", "checkmark-done-outline") }} />
          <Tabs.Screen name="projects" options={{ href: desktop ? undefined : null, title: "Proyectos", tabBarIcon: tabIcon("folder", "folder-outline") }} />
          <Tabs.Screen name="missions" options={{ title: "Hábitos", tabBarIcon: tabIcon("repeat", "repeat-outline") }} />
          <Tabs.Screen name="goals" options={{ href: desktop ? undefined : null, title: "Metas", tabBarIcon: tabIcon("flag", "flag-outline") }} />
          <Tabs.Screen name="notes" options={{ href: desktop ? undefined : null, title: "Notas", tabBarIcon: tabIcon("document-text", "document-text-outline") }} />
          <Tabs.Screen name="system" options={{ href: desktop ? undefined : null, title: "Asistente", tabBarIcon: tabIcon("sparkles", "sparkles-outline") }} />
            <Tabs.Screen name="profile" options={{ title: "Perfil", tabBarIcon: tabIcon("person-circle", "person-circle-outline") }} />
            <Tabs.Screen name="onboarding" options={{ href: null, title: "Conocerte" }} />
          </Tabs>
        </DiscoveryProvider>
      </OrganizerProvider>
      <LevelUpNotice />
    </PlayerProvider>
  );
}
