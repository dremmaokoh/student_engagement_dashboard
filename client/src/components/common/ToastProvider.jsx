import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import "../../styles/toast.css";

const ToastContext = createContext(null);

const MAX_VISIBLE = 4;

const DEFAULT_DURATION = {
  success: 4000,
  info: 4000,
  warning: 6000,
  error: 7000,
  loading: 0,
};

const DEFAULT_TITLE = {
  success: "Success",
  info: "Good to know",
  warning: "Warning",
  error: "Something went wrong",
  loading: "Working on it",
};

const ICONS = {
  success: (
    <path d="M20 6 9 17l-5-5" />
  ),
  error: (
    <>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </>
  ),
  warning: (
    <>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </>
  ),
  loading: (
    <path d="M21 12a9 9 0 1 1-6.2-8.6" />
  ),
};

function ToastIcon({ type }) {
  return (
    <svg
      className={`toast__icon toast__icon--${type}${type === "loading" ? " toast__icon--spin" : ""}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[type] || ICONS.info}
    </svg>
  );
}

function ToastItem({ toast, onDismiss }) {
  const [paused, setPaused] = useState(false);
  const remainingRef = useRef(toast.duration ?? 0);

  const revision = toast.revision || 0;
  const duration = toast.duration ?? 0;

  React.useEffect(() => {
    remainingRef.current = duration;
  }, [duration, revision]);

  React.useEffect(() => {
    if (!duration || paused) {
      return undefined;
    }
    const started = Date.now();
    const timer = window.setTimeout(() => onDismiss(toast.id), remainingRef.current);
    return () => {
      window.clearTimeout(timer);
      remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - started));
    };
  }, [toast.id, duration, revision, paused, onDismiss]);

  const role = toast.type === "error" ? "alert" : "status";
  const live = toast.type === "error" ? "assertive" : "polite";

  return (
    <div
      className={`toast toast--${toast.type}`}
      role={role}
      aria-live={live}
      aria-atomic="true"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <ToastIcon type={toast.type} />
      <div className="toast__body">
        <p className="toast__title">{toast.title || DEFAULT_TITLE[toast.type] || "Notice"}</p>
        {toast.message ? <p className="toast__message">{toast.message}</p> : null}
      </div>
      <button
        type="button"
        className="toast__close"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
      >
        ×
      </button>
      {duration > 0 ? <span className="toast__progress" style={{ animationDuration: `${duration}ms` }} /> : null}
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);
  const revisions = useRef(new Map());
  const typesById = useRef(new Map());
  const activeIds = useRef(new Set());

  const dismiss = useCallback((id) => {
    activeIds.current.delete(id);
    typesById.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback((type, message, options = {}) => {
    const id = options.id ?? nextId.current++;
    const resolvedType = type || "info";
    const revision = (revisions.current.get(id) || 0) + 1;
    revisions.current.set(id, revision);
    typesById.current.set(id, resolvedType);
    activeIds.current.add(id);
    const entry = {
      id,
      type: resolvedType,
      title: options.title || DEFAULT_TITLE[resolvedType],
      message: typeof message === "string" || message == null ? message : String(message),
      duration: options.duration ?? DEFAULT_DURATION[resolvedType] ?? 4000,
      revision,
    };
    setToasts((current) => {
      const next = [entry, ...current.filter((toast) => toast.id !== id)].slice(0, MAX_VISIBLE);
      const visibleIds = new Set(next.map((toast) => toast.id));
      activeIds.current.forEach((activeId) => {
        if (!visibleIds.has(activeId)) {
          activeIds.current.delete(activeId);
          typesById.current.delete(activeId);
        }
      });
      return next;
    });
    return id;
  }, []);

  const toast = useMemo(
    () => ({
      success: (message, options) => push("success", message, options),
      error: (message, options) => push("error", message, options),
      info: (message, options) => push("info", message, options),
      warning: (message, options) => push("warning", message, options),
      loading: (message, options) => push("loading", message, options),
      // Uses refs rather than the current render's state so an async action
      // can update its loading toast even after the provider re-rendered.
      update: (id, next) => {
        if (id == null || !activeIds.current.has(id)) return id;
        if (typeof next === "string") {
          return push("success", next, { id });
        }
        return push(next?.type || typesById.current.get(id) || "success", next?.message ?? "", {
          id,
          title: next?.title,
          duration: next?.duration,
        });
      },
      dismiss,
    }),
    [dismiss, push],
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-viewport" aria-label="Notifications">
        {toasts.map((entry) => (
          <ToastItem key={entry.id} toast={entry} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside a ToastProvider");
  }
  return context;
}
