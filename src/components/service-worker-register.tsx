"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let refreshing = false;

    navigator.serviceWorker
      .register("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      })
      .then((registration) => {
        registration.update().catch(() => undefined);

        if (registration.waiting) {
          window.dispatchEvent(new CustomEvent("pwa-update-available"));
        }

        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          if (!worker) return;

          let hasDispatched = false;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed") {
              if (navigator.serviceWorker.controller && !hasDispatched) {
                hasDispatched = true;
                window.dispatchEvent(new CustomEvent("pwa-update-available"));
              }
              if (!navigator.serviceWorker.controller) {
                window.dispatchEvent(new CustomEvent("pwa-update-available"));
              }
            }
          });
        });
      })
      .catch(() => undefined);

    const handleControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  return null;
}
