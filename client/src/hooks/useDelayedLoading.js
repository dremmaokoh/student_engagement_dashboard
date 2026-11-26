import { useEffect, useState } from "react";

/**
 * Delays the first paint of a transient spinner so fast requests do not flash.
 * Unlike the previous implementation, the indicator is removed as soon as the
 * loading state ends: a hidden placeholder must never stay in document flow
 * while the real content is rendered.
 */
export function useDelayedLoading(active, { delay = 180 } = {}) {
  const [mounted, setMounted] = useState(Boolean(active));
  const [visible, setVisible] = useState(Boolean(active) && delay === 0);

  useEffect(() => {
    if (!active) {
      setVisible(false);
      setMounted(false);
      return undefined;
    }

    setMounted(true);
    if (delay === 0) {
      setVisible(true);
      return undefined;
    }

    setVisible(false);
    const showTimer = window.setTimeout(() => setVisible(true), delay);
    return () => window.clearTimeout(showTimer);
  }, [active, delay]);

  return { mounted, visible };
}
