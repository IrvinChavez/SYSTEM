import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { DiscoveryProfile, subscribeToDiscovery } from "@/services/discovery-service";

type DiscoveryContextValue = {
  loading: boolean;
  error: string | null;
  discovery: DiscoveryProfile | null;
};

const DiscoveryContext = createContext<DiscoveryContextValue | null>(null);

export function DiscoveryProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid ?? "";
  return <DiscoveryDataProvider key={uid || "signed-out"} uid={uid}>{children}</DiscoveryDataProvider>;
}

function DiscoveryDataProvider({ children, uid }: { children: ReactNode; uid: string }) {
  const [discovery, setDiscovery] = useState<DiscoveryProfile | null>(null);
  const [loading, setLoading] = useState(Boolean(uid));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;

    return subscribeToDiscovery(
      uid,
      (profile) => {
        setDiscovery(profile);
        setLoading(false);
        setError(null);
      },
      (reason) => {
        console.warn("No se pudo sincronizar el cuestionario personal", reason);
        setError("No se pudieron sincronizar tus preferencias personales.");
        setLoading(false);
      },
    );
  }, [uid]);

  const value = useMemo(() => ({ loading, error, discovery }), [loading, error, discovery]);
  return <DiscoveryContext.Provider value={value}>{children}</DiscoveryContext.Provider>;
}

export function useDiscovery() {
  const context = useContext(DiscoveryContext);
  if (!context) throw new Error("useDiscovery debe usarse dentro de <DiscoveryProvider>");
  return context;
}
