"use client";

import { useEffect } from "react";
import { createSessionHeartbeatController } from "@/lib/session-heartbeat-controller";

export function SessionHeartbeat() {
  useEffect(() => {
    const controller = createSessionHeartbeatController({
      fetchSession: (signal) =>
        fetch("/api/auth/session", {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
          signal,
        }),
      requestLock:
        typeof navigator.locks?.request === "function"
          ? async (name, options, callback) => {
              await navigator.locks.request(name, options, callback);
            }
          : undefined,
    });
    const refreshSession = () => {
      void controller.refresh();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshSession();
      }
    };

    refreshSession();
    const intervalId = window.setInterval(refreshSession, 60_000);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      controller.cancel();
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return null;
}
