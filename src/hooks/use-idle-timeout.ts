import { useCallback, useEffect, useRef, useState } from "react";

const CHANNEL_NAME = "session-activity";
const STORAGE_KEY = "session:last-activity";

type Options = {
  /** tempo total de inatividade até o logout (ms) */
  timeoutMs?: number;
  /** antecedência do aviso antes do logout (ms) */
  warningMs?: number;
  onWarn: () => void;
  onTimeout: () => void;
  enabled?: boolean;
};

/**
 * Monitora atividade do usuário e dispara aviso/logout por inatividade.
 * O relógio é compartilhado entre abas via BroadcastChannel (fallback: localStorage).
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

  const schedule = useCallback(() => {
    if (warnTimer.current) clearTimeout(warnTimer.current);
    if (outTimer.current) clearTimeout(outTimer.current);
    warnTimer.current = setTimeout(() => onWarnRef.current(), Math.max(0, timeoutMs - warningMs));
    outTimer.current = setTimeout(() => onTimeoutRef.current(), timeoutMs);
  }, [timeoutMs, warningMs]);

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

    const handler = () => {
      const now = Date.now();
      if (now - debounce.current < 1000) return;
      debounce.current = now;
      resetActivity(true);
    };

    const events = ["mousemove", "keydown", "click", "touchstart", "scroll"] as const;
    events.forEach((e) => window.addEventListener(e, handler, { passive: true }));

    schedule();

    return () => {
      events.forEach((e) => window.removeEventListener(e, handler));
      window.removeEventListener("storage", onStorage);
      if (warnTimer.current) clearTimeout(warnTimer.current);
      if (outTimer.current) clearTimeout(outTimer.current);
      channel.current?.close();
      channel.current = null;
    };
  }, [enabled, schedule, resetActivity]);

  return { resetActivity };
}
