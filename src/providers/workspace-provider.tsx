"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";

import { api, IS_PROTOTYPE_DATA, type ApiResult } from "@/lib/api";
import { hasSession, setTokens, type TokenPair } from "@/lib/api/session";
import type { Snapshot } from "@/lib/types";

/* -------------------------------------------------------------------------- */
/* Overlays                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Record details open in a right-side drawer. Creation and state-change
 * workflows open in a modal. Only one overlay is ever on screen.
 */
export type Overlay =
  | { kind: "enterprise"; id: string }
  | { kind: "site-request"; id: string }
  | { kind: "job"; id: string }
  | { kind: "installer"; id: string }
  | { kind: "device"; id: string }
  | { kind: "incident"; id: string }
  | { kind: "staff"; id: string }
  | { kind: "notifications" }
  | { kind: "new-enterprise" }
  | { kind: "new-site"; enterpriseId?: string }
  | { kind: "new-job" }
  | { kind: "new-installer" }
  | { kind: "register-device"; siteId?: string }
  | { kind: "unblock-job"; id: string }
  | { kind: "site-lifecycle"; id: string; status: "active" | "decommissioned" }
  | { kind: "new-incident" }
  | { kind: "invite-staff" }
  | { kind: "support-grant"; enterpriseId?: string }
  | { kind: "revoke-grant"; id: string }
  | { kind: "site-decision"; id: string; decision: "Approved" | "Returned" }
  | { kind: "incident-transition"; id: string; transition: "Assign" | "Acknowledge" | "Resolve" | "Reopen" }
  | { kind: "enterprise-transition"; id: string; transition: "Suspend" | "Reactivate" }
  | { kind: "staff-transition"; id: string; transition: "Suspend" | "Restore" }
  | { kind: "installer-transition"; id: string; transition: "Suspend" | "Restore" }
  | { kind: "reassign-job"; id: string }
  | { kind: "link-gateway"; id: string }
  | { kind: "unlink-gateway"; id: string }
  | { kind: "accept-installation"; id: string }
  | { kind: "reissue-admin"; id: string };

/* -------------------------------------------------------------------------- */
/* Toasts                                                                      */
/* -------------------------------------------------------------------------- */

export interface ToastMessage {
  id: number;
  title: string;
  detail: string;
  tone: "success" | "blocked";
}

const DEFAULT_TOAST_DETAIL = "The change was recorded in the immutable audit history.";
const TOAST_LIFETIME = 3600;

/* -------------------------------------------------------------------------- */
/* Session                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Whether an operator is signed in. Demo mode has no sign-in and is always
 * "signed-in". Live mode starts "unknown" until the browser's stored tokens
 * have been read (they are not available during server rendering), so the
 * server and the first client render agree, and nothing is fetched until the
 * answer is known.
 */
export type SessionState = "unknown" | "signed-out" | "signed-in";

/* -------------------------------------------------------------------------- */
/* Context                                                                     */
/* -------------------------------------------------------------------------- */

interface RunOptions<T> {
  /** Toast shown when the platform accepted the change. */
  success: (data: T) => { title: string; detail?: string };
  /** Heading for a rejection. The platform supplies the explanation. */
  failureTitle: string;
  /** Runs after a successful change, typically to open the resulting record. */
  onSuccess?: (data: T, snapshot: Snapshot) => void;
  /** Keep the current overlay open instead of dismissing it. */
  keepOverlay?: boolean;
}

interface WorkspaceValue {
  snapshot: Snapshot | null;
  loading: boolean;
  loadError: string | null;
  pending: boolean;
  reload: () => Promise<void>;
  resetToSeed: () => Promise<void>;

  session: SessionState;
  /** Store the token pair from sign-in and load the first operational picture. */
  signIn: (tokens: TokenPair) => Promise<void>;
  /** End the session on the platform and locally, and drop the loaded picture. */
  signOut: () => Promise<void>;

  overlay: Overlay | null;
  openOverlay: (overlay: Overlay) => void;
  closeOverlay: () => void;

  toasts: ToastMessage[];
  pushToast: (title: string, detail?: string, tone?: ToastMessage["tone"]) => void;
  dismissToast: (id: number) => void;

  navOpen: boolean;
  setNavOpen: (open: boolean) => void;

  searchFocusSignal: number;
  focusGlobalSearch: () => void;

  /** Runs one API mutation and folds the result back into the workspace. */
  run: <T>(operation: () => Promise<ApiResult<T>>, options: RunOptions<T>) => Promise<boolean>;
}

const WorkspaceContext = createContext<WorkspaceValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [session, setSession] = useState<SessionState>(IS_PROTOTYPE_DATA ? "signed-in" : "unknown");
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [navOpen, setNavOpen] = useState(false);
  const [searchFocusSignal, setSearchFocusSignal] = useState(0);
  const toastSeq = useRef(0);
  const pathname = usePathname();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSnapshot(await api.getSnapshot());
      setLoadError(null);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "The operational snapshot could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  /* Live mode: the stored tokens decide the session once the browser is running. */
  useEffect(() => {
    if (!IS_PROTOTYPE_DATA) setSession(hasSession() ? "signed-in" : "signed-out");
  }, []);

  /*
   * The first load waits for a session and never runs on the sign-in screen,
   * so a visitor who is not signed in causes no backend traffic at all. One
   * load per session: sign-in requests it directly, and the route change that
   * follows must not request a second one.
   */
  const onLoginRoute = pathname === "/login";
  const shouldLoad = session === "signed-in" && !onLoginRoute;
  const loadRequested = useRef(false);
  useEffect(() => {
    if (!shouldLoad || loadRequested.current) return;
    loadRequested.current = true;
    void load();
  }, [shouldLoad, load]);

  const signIn = useCallback(
    async (tokens: TokenPair) => {
      setTokens(tokens);
      setSession("signed-in");
      loadRequested.current = true;
      await load();
    },
    [load]
  );

  const signOut = useCallback(async () => {
    loadRequested.current = false;
    await api.signOut();
    setSnapshot(null);
    setSession("signed-out");
  }, []);

  const resetToSeed = useCallback(async () => {
    setSnapshot(await api.resetSnapshot());
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts(current => current.filter(item => item.id !== id));
  }, []);

  const pushToast = useCallback(
    (title: string, detail = DEFAULT_TOAST_DETAIL, tone: ToastMessage["tone"] = "success") => {
      toastSeq.current += 1;
      const id = toastSeq.current;
      setToasts(current => [...current, { id, title, detail, tone }]);
      window.setTimeout(() => dismissToast(id), TOAST_LIFETIME);
    },
    [dismissToast]
  );

  const closeOverlay = useCallback(() => setOverlay(null), []);
  const openOverlay = useCallback((next: Overlay) => setOverlay(next), []);
  const focusGlobalSearch = useCallback(() => setSearchFocusSignal(value => value + 1), []);

  const run = useCallback(
    async <T,>(operation: () => Promise<ApiResult<T>>, options: RunOptions<T>) => {
      setPending(true);
      try {
        const result = await operation();

        // A rejection can still carry a snapshot: blocking a duplicate gateway
        // identity opens an incident, so the workspace must re-render.
        if (result.snapshot) setSnapshot(result.snapshot);
        if (!options.keepOverlay) closeOverlay();

        if (!result.ok) {
          pushToast(options.failureTitle, result.message, "blocked");
          return false;
        }

        const toast = options.success(result.data);
        pushToast(toast.title, toast.detail);
        options.onSuccess?.(result.data, result.snapshot);
        return true;
      } finally {
        setPending(false);
      }
    },
    [closeOverlay, pushToast]
  );

  /* Navigation drawer state lives on <body> so the stylesheet can drive it. */
  useEffect(() => {
    document.body.classList.toggle("menu-open", navOpen);
    return () => document.body.classList.remove("menu-open");
  }, [navOpen]);

  /* Escape closes the overlay, then the mobile navigation. "/" focuses search. */
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const tag = document.activeElement?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

      if (event.key === "Escape") {
        if (overlay) closeOverlay();
        else setNavOpen(false);
      }

      if (event.key === "/" && !typing) {
        event.preventDefault();
        focusGlobalSearch();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [overlay, closeOverlay, focusGlobalSearch]);

  const value = useMemo<WorkspaceValue>(
    () => ({
      snapshot,
      loading,
      loadError,
      pending,
      reload: load,
      resetToSeed,
      session,
      signIn,
      signOut,
      overlay,
      openOverlay,
      closeOverlay,
      toasts,
      pushToast,
      dismissToast,
      navOpen,
      setNavOpen,
      searchFocusSignal,
      focusGlobalSearch,
      run
    }),
    [
      snapshot,
      loading,
      loadError,
      pending,
      load,
      resetToSeed,
      session,
      signIn,
      signOut,
      overlay,
      openOverlay,
      closeOverlay,
      toasts,
      pushToast,
      dismissToast,
      navOpen,
      searchFocusSignal,
      focusGlobalSearch,
      run
    ]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used inside a WorkspaceProvider");
  }
  return context;
}

/**
 * The operational picture, for views that only render once it has loaded.
 * The workspace shell holds back rendering until the snapshot is present.
 */
export function useSnapshot(): Snapshot {
  const { snapshot } = useWorkspace();
  if (!snapshot) {
    throw new Error("useSnapshot was called before the operational snapshot loaded");
  }
  return snapshot;
}
