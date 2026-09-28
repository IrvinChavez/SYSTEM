import { Alert, Platform } from "react-native";

// Alert.alert con botones no funciona en react-native-web, así que en web usamos window.confirm.
export function confirmAction(title: string, message: string, confirmLabel: string, onConfirm: () => void) {
  if (Platform.OS === "web") {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }

  Alert.alert(title, message, [
    { text: "Cancelar", style: "cancel" },
    { text: confirmLabel, style: "destructive", onPress: onConfirm },
  ]);
}

export function notify(title: string, message: string) {
  if (Platform.OS === "web") {
    window.alert(`${title}\n\n${message}`);
    return;
  }

  Alert.alert(title, message);
}

// Firestore aplica cada escritura al instante en su caché local y la sincroniza cuando hay conexión, pero la
// promesa solo se resuelve cuando responde el servidor. Por eso la UI nunca debe esperarla (sin internet
// quedaría cargando para siempre): se lanza aquí y solo se avisa si el servidor la rechaza.
export function syncInBackground(write: Promise<unknown>, errorMessage: string) {
  write.catch((error) => {
    console.warn(errorMessage, error);
    notify("Error de sincronización", errorMessage);
  });
}
