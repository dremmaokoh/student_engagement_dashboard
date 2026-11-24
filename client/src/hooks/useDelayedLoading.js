import { useEffect, useState } from "react";

/**
 * Delays showing transient loading UI so quick requests never flash a spinner,
 * and keeps it mounted briefly while the exit transition runs.
 */
export function useDelayedLoading(active, { delay = 180, exitDelay = 180 } = {}) {
  const [mounted, setMounted] = useState(Boolean(active));
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let showTimer;
    let hideTimer;

    if (active) {
      setMounted(true);
      showTimer = window.setTimeout(() => setVisible(true), delay);
    } else {
      setVisible(false);
      hideTimer = window.setTimeout(() => setMounted(false), exitDelay);
    }

    return () => {
      if (showTimer) window.clearTimeout(showTimer);
      if (hideTimer) window.clearTimeout(hideTimer);
    };
  }, [active, delay, exitDelay]);

  return { mounted, visible };
}
