import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApp, getApps, initializeApp } from "firebase/app";
// @ts-expect-error: getReactNativePersistence solo existe en el build de React Native de firebase/auth.
import { getReactNativePersistence, initializeAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { firebaseConfig } from "./firebase-options";

const firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// La sesión se guarda en AsyncStorage para que el usuario no tenga que volver a ingresar.
export const firebaseAuth = initializeAuth(firebaseApp, {
  persistence: getReactNativePersistence(AsyncStorage),
});
export const firestore = getFirestore(firebaseApp);
