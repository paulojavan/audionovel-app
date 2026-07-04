"use client";

import { useEffect } from "react";

export function PwaOfflineNavigation() {
  useEffect(() => {
    function handleOfflineClick(event: MouseEvent) {
      if (navigator.onLine) return;
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.hasAttribute("download")) return;
      if (anchor.target && anchor.target !== "_self") return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || !isOfflineNavigablePath(url.pathname)) return;

      event.preventDefault();
      window.location.assign(url.href);
    }

    document.addEventListener("click", handleOfflineClick, true);
    return () => document.removeEventListener("click", handleOfflineClick, true);
  }, []);

  return null;
}

function isOfflineNavigablePath(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/novels" ||
    pathname.startsWith("/novels/") ||
    pathname.startsWith("/chapters/") ||
    pathname === "/biblioteca"
  );
}
