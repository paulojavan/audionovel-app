"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
      .then(() => {
        if (!("caches" in window)) return undefined;
        return caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("audio-novel-br-app")).map((key) => caches.delete(key))));
      })
      .catch(() => undefined);
  }, []);

  return null;
}
