"use client";

import { useEffect } from "react";

// Registers public/sw.js so browsers treat the dashboard as installable
// (Feature 7). No-op on browsers without service worker support.
export default function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("Service worker registration failed:", err);
    });
  }, []);

  return null;
}
