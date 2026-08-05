import { useEffect } from "react";

const activeLocks = new Set<symbol>();
let previousBodyOverflow: string | null = null;

function acquireBodyScrollLock(): () => void {
  const token = Symbol("body-scroll-lock");

  if (activeLocks.size === 0) {
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }

  activeLocks.add(token);

  return () => {
    if (!activeLocks.delete(token)) return;

    if (activeLocks.size === 0) {
      document.body.style.overflow = previousBodyOverflow ?? "";
      previousBodyOverflow = null;
    }
  };
}

export function useBodyScrollLock(): void {
  useEffect(() => acquireBodyScrollLock(), []);
}
