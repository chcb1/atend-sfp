export const SESSION_ACTIVITY_KEY = "session:last-activity";
export const IDLE_TIMEOUT_MS = 10 * 60 * 1000;

export function markSessionActivity() {
  try {
    localStorage.setItem(SESSION_ACTIVITY_KEY, String(Date.now()));
  } catch {
    // Storage may be unavailable.
  }
}

export function clearSessionActivity() {
  try {
    localStorage.removeItem(SESSION_ACTIVITY_KEY);
  } catch {
    // Storage may be unavailable.
  }
}

export function remainingSessionTime(last: number | null, now: number, timeout = IDLE_TIMEOUT_MS) {
  return last === null ? timeout : Math.max(0, timeout - (now - last));
}

// session_id survives refreshes and focus events, unlike the access token.
export function sessionIdentity(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const claims = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof claims.session_id === "string" ? claims.session_id : null;
  } catch {
    return null;
  }
}

export function createSessionTransitionTracker() {
  let current: string | null = null;
  return (event: string, identity: string | null) => {
    if (event === "SIGNED_OUT") {
      current = null;
      return false;
    }
    if (event === "INITIAL_SESSION") {
      current = identity;
      return false;
    }
    if (event !== "SIGNED_IN" || !identity || identity === current) return false;
    current = identity;
    return true;
  };
}