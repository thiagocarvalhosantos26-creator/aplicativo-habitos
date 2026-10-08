import { useEffect, useRef, useState } from "react";
import { loadData } from "./storage";

// Registration remains the generated registerSW.js. No automatic reload listener.
export function usePwaUpdate(blocked: boolean) {
  const [available, setAvailable] = useState(false);
  const [failure, setFailure] = useState("");
  const blockedRef = useRef(blocked);
  blockedRef.current = blocked;
  const requested = useRef(false);
  const activatedPending = useRef(false);
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let disposed = false;
    let lastCheck = 0;
    const inspect = () => {
      navigator.serviceWorker
        .getRegistration(import.meta.env.BASE_URL)
        .then((reg) => {
          if (disposed) return;
          setAvailable(!!reg?.waiting || activatedPending.current);
          if (reg && Date.now() - lastCheck > 60000) {
            lastCheck = Date.now();
            void reg.update().catch(() => {});
          }
        })
        .catch(() => {});
    };
    const changed = () => {
      if (requested.current) {
        const current = loadData();
        if (!blockedRef.current && current.ok && !current.data.active)
          window.location.reload();
        else {
          // A workout may start between clicking Update and worker activation.
          requested.current = false;
          activatedPending.current = true;
          setAvailable(true);
        }
      } else inspect();
    };
    const timer = window.setInterval(inspect, 5000);
    inspect();
    window.addEventListener("focus", inspect);
    document.addEventListener("visibilitychange", inspect);
    navigator.serviceWorker.addEventListener("controllerchange", changed);
    return () => {
      disposed = true;
      clearInterval(timer);
      window.removeEventListener("focus", inspect);
      document.removeEventListener("visibilitychange", inspect);
      navigator.serviceWorker.removeEventListener("controllerchange", changed);
    };
  }, []);
  async function apply() {
    // Recheck persisted session immediately before activation, including another tab.
    const stored = loadData();
    if (blockedRef.current || !stored.ok || stored.data.active) return;
    if (activatedPending.current) {
      window.location.reload();
      return;
    }
    try {
      const reg = await navigator.serviceWorker.getRegistration(
        import.meta.env.BASE_URL,
      );
      const current = loadData();
      if (
        blockedRef.current ||
        !current.ok ||
        current.data.active ||
        !reg?.waiting
      )
        return;
      requested.current = true;
      reg.waiting.postMessage({ type: "SKIP_WAITING" });
    } catch {
      requested.current = false;
      setFailure(
        "Não foi possível carregar a atualização. Tente novamente com internet.",
      );
    }
  }
  return { available, apply, failure };
}
