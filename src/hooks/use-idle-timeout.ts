import { useCallback, useEffect, useRef, useState } from "react";

const CHANNEL_NAME = "session-activity";
const STORAGE_KEY = "session:last-activity";
const STALE_REASON = "Sessão expirada por inatividade";

type Options = {
  /** tempo total de inatividade até o logout (ms) */
  timeoutMs?: number;
  /** antecedência do aviso antes do logout (ms) */
  warningMs?: number;
  onWarn: () => void;
  /** reason é informado quando a sessão já estava expirada ao abrir/voltar para a aba */
  onTimeout: (reason?: string) => void;
  enabled?: boolean;
};

/**
 * Monitora atividade do usuário e dispara aviso/logout por inatividade.
 * O relógio é compartilhado entre abas via BroadcastChannel (fallback: localStorage).
 * Ao iniciar e ao voltar para a aba, verifica o último registro de atividade
 * persistido: se já passou do tempo limite, encerra a sessão imediatamente.
 */
export function useIdleTimeout({
  timeoutMs = 10 * 60 * 1000,
  warningMs = 60 * 1000,
  onWarn,
  onTimeout,
  enabled = true,
}: Options) {
  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const outTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounce = useRef<number>(0);
  const channel = useRef<BroadcastChannel | null>(null);
  const [, setTick] = useState(0);

  const onWarnRef = useRef(onWarn);
  const onTimeoutRef = useRef(onTimeout);
  onWarnRef.current = onWarn;
  onTimeoutRef.current = onTimeout;

  const schedule = useCallback(
    (remainingMs?: number) => {
      if (warnTimer.current) clearTimeout(warnTimer.current);
      if (outTimer.current) clearTimeout(outTimer.current);
      const remaining = remainingMs ?? timeoutMs;
      warnTimer.current = setTimeout(() => onWarnRef.current(), Math.max(0, remaining - warningMs));
      outTimer.current = setTimeout(() => onTimeoutRef.current(), remaining);
    },
    [timeoutMs, warningMs],
  );

  const readLastActivity = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const ts = raw ? Number(raw) : NaN;
      return Number.isFinite(ts) ? ts : null;
    } catch {
      return null;
    }
  };

  /**
   * Verifica o último registro de atividade persistido.
   * Se já estiver expirado, encerra na hora; senão, agenda só o tempo restante.
   */
  const checkStale = useCallback(() => {
    const last = readLastActivity();
    if (last === null) {
      schedule();
      return;
    }
    const elapsed = Date.now() - last;
    if (elapsed >= timeoutMs) {
      onTimeoutRef.current(STALE_REASON);
      return;
    }
    schedule(timeoutMs - elapsed);
  }, [schedule, timeoutMs]);

  /** reseta o timer local e avisa as outras abas */
  const resetActivity = useCallback(
    (broadcast = true) => {
      schedule();
      if (!broadcast) return;
      const now = Date.now();
      try {
        channel.current?.postMessage(now);
      } catch {
        // canal indisponível
      }
      try {
        localStorage.setItem(STORAGE_KEY, String(now));
      } catch {
        // storage indisponível
      }
    },
    [schedule],
  );

  useEffect(() => {
    if (!enabled) return;

    if (typeof BroadcastChannel !== "undefined") {
      channel.current = new BroadcastChannel(CHANNEL_NAME);
      channel.current.onmessage = () => {
        schedule();
        setTick((t) => t + 1);
      };
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        schedule();
        setTick((t) => t + 1);
      }
    };
    window.addEventListener("storage", onStorage);

    const onVisibility = () => {
      if (document.visibilityState === "visible") checkStale();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const handler = () => {
      const now = Date.now();
      if (now - debounce.current < 1000) return;
      debounce.current = now;
      resetActivity(true);
    };

    const events = ["mousemove", "keydown", "click", "touchstart", "scroll"] as const;
    events.forEach((e) => window.addEventListener(e, handler, { passive: true }));

    checkStale();

    return () => {
      events.forEach((e) => window.removeEventListener(e, handler));
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisibility);
      if (warnTimer.current) clearTimeout(warnTimer.current);
      if (outTimer.current) clearTimeout(outTimer.current);
      channel.current?.close();
      channel.current = null;
    };
  }, [enabled, schedule, resetActivity, checkStale]);

  return { resetActivity };
}
