import { useEffect, useState } from "react";
import { biometricSupport, storedBiometricUsername, type BiometricSupport } from "@/services/biometric-service";

// Si el teléfono tiene huella / Face ID configurada y qué usuario (si alguno) tiene el ingreso con huella activo.
export function useBiometrics() {
  const [support, setSupport] = useState<BiometricSupport>({ available: false, label: "huella" });
  const [savedUsername, setSavedUsername] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    void Promise.all([biometricSupport(), storedBiometricUsername()]).then(([nextSupport, username]) => {
      if (!active) return;
      setSupport(nextSupport);
      setSavedUsername(username);
    });
    return () => {
      active = false;
    };
  }, [version]);

  return { support, savedUsername, refresh: () => setVersion((current) => current + 1) };
}
