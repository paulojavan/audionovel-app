"use client";

import { useSyncExternalStore } from "react";
import { isOfflineCryptoSupported } from "@/lib/offline-crypto";

function subscribe() {
  return () => {};
}

function getServerSnapshot() {
  return false;
}

export function useOfflineCryptoSupported() {
  return useSyncExternalStore(subscribe, isOfflineCryptoSupported, getServerSnapshot);
}
