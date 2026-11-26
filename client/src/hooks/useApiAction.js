import { useCallback } from "react";
import { useToast } from "../components/common/ToastProvider.jsx";

function resolveMessage(value, result, fallback) {
  if (typeof value === "function") {
    return value(result);
  }
  if (value != null) {
    return value;
  }
  return fallback;
}

/**
 * Wraps an async action with consistent toast feedback.
 *
 *   const run = useApiAction();
 *   await run(() => apiRequest(...), {
 *     loading: "Saving…",
 *     success: (data) => `Saved ${data.name}.`,
 *     error: (err) => err.message,
 *   });
 *
 * A loading toast is updated in place on completion so it never stacks twice.
 */
export function useApiAction() {
  const toast = useToast();

  return useCallback(
    async (action, options = {}) => {
      const { loading, success, error, successType = "success", rethrow = false } = options;
      const loadingId = loading ? toast.loading(loading) : null;

      try {
        const data = await action();
        const message = resolveMessage(success, data, null);
        if (loadingId != null) {
          if (message) {
            toast.update(loadingId, { type: successType, message });
          } else {
            toast.dismiss(loadingId);
          }
        } else if (message) {
          toast[successType](message);
        }
        return { ok: true, data };
      } catch (err) {
        const message = resolveMessage(error, err, err?.message || "The request failed. Please try again.");
        if (loadingId != null) {
          toast.update(loadingId, { type: "error", message });
        } else {
          toast.error(message);
        }
        if (rethrow) throw err;
        return { ok: false, error: err };
      }
    },
    [toast],
  );
}
