import {
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  User,
} from "firebase/auth";
import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { firebaseAuth } from "@/config/firebase";
import { loginIdentifierToEmail, normalizeUsername } from "@/lib/username";
import { deletePlayerData, initPlayer } from "@/services/player-service";

type AuthContextValue = {
  user: User | null;
  initializing: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(firebaseAuth.currentUser);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => onAuthStateChanged(firebaseAuth, (nextUser) => {
    setUser(nextUser);
    setInitializing(false);
  }), []);

  const value: AuthContextValue = {
    user,
    initializing,
    login: async (username, password) => {
      await signInWithEmailAndPassword(firebaseAuth, loginIdentifierToEmail(username), password);
    },
    register: async (rawUsername, password) => {
      const username = normalizeUsername(rawUsername);
      const credential = await createUserWithEmailAndPassword(firebaseAuth, loginIdentifierToEmail(username), password);
      await updateProfile(credential.user, { displayName: username });
      await initPlayer(credential.user.uid, username, username);
    },
    logout: () => signOut(firebaseAuth),
    // Requisito de Google Play: el usuario puede borrar su cuenta y sus datos desde la app.
    // Firebase exige un inicio de sesión reciente para borrar la cuenta, por eso se pide la contraseña.
    deleteAccount: async (password) => {
      const current = firebaseAuth.currentUser;
      if (!current?.email) throw new Error("No hay sesión activa.");
      await reauthenticateWithCredential(current, EmailAuthProvider.credential(current.email, password));
      await deletePlayerData(current.uid);
      await deleteUser(current);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  }
  return context;
}

// Traduce los códigos de Firebase Auth a mensajes para el usuario.
export function authErrorMessage(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";

  switch (code) {
    case "auth/invalid-email":
      return "El nombre de usuario no es válido.";
    case "auth/missing-password":
      return "Escribe tu contraseña.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Usuario o contraseña incorrectos.";
    case "auth/email-already-in-use":
      return "Ese nombre de usuario ya está ocupado. Elige otro.";
    case "auth/admin-restricted-operation":
      return "El registro de cuentas nuevas está cerrado.";
    case "auth/weak-password":
      return "La contraseña debe tener al menos 6 caracteres.";
    case "auth/too-many-requests":
      return "Demasiados intentos. Espera un momento e inténtalo de nuevo.";
    case "auth/network-request-failed":
      return "Sin conexión. Revisa tu internet.";
    case "auth/operation-not-allowed":
      return "El inicio con correo/contraseña no está habilitado en Firebase (Authentication → Sign-in method).";
    case "auth/invalid-api-key":
    case "auth/api-key-not-valid.-please-pass-a-valid-api-key.":
      return "La API key de Firebase no es válida. Revisa tu archivo .env.";
    default:
      return "Ocurrió un error inesperado. Inténtalo de nuevo.";
  }
}
