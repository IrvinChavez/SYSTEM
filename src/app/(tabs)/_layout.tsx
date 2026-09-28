import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router/js-tabs";
import { ComponentProps } from "react";
import { ColorValue } from "react-native";
import { LevelUpNotice } from "@/components/level-up-notice";
import { systemColors } from "@/constants/system-colors";
import { PlayerProvider } from "@/context/player-context";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

// Ícono relleno en la pestaña activa y de contorno en las demás, para que se note dónde estás.
const tabIcon = (name: IoniconName, outline: IoniconName) => function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
  return <Ionicons name={focused ? name : outline} size={25} color={color as string} />;
};

export default function TabsLayout() {
  return (
    <PlayerProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: systemColors.background },
          tabBarActiveTintColor: systemColors.accent,
          tabBarInactiveTintColor: systemColors.textMuted,
          tabBarActiveBackgroundColor: systemColors.surfaceActive,
          tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
          tabBarStyle: {
            height: 64,
            paddingTop: 4,
            backgroundColor: systemColors.background,
            borderTopColor: systemColors.borderMuted,
          },
        }}
      >
        <Tabs.Screen name="index" options={{ title: "Inicio", tabBarIcon: tabIcon("home", "home-outline") }} />
        <Tabs.Screen name="missions" options={{ title: "Misiones", tabBarIcon: tabIcon("checkbox", "checkbox-outline") }} />
        <Tabs.Screen name="agenda" options={{ title: "Agenda", tabBarIcon: tabIcon("calendar", "calendar-outline") }} />
        <Tabs.Screen name="system" options={{ title: "IA", tabBarIcon: tabIcon("sparkles", "sparkles-outline") }} />
        <Tabs.Screen name="profile" options={{ title: "Perfil", tabBarIcon: tabIcon("person-circle", "person-circle-outline") }} />
      </Tabs>
      <LevelUpNotice />
    </PlayerProvider>
  );
}
