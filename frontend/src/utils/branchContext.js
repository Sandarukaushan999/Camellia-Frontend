export const ACTIVE_BRANCH_STORAGE_KEY = "cv_active_branch_id";
export const ACTIVE_BRANCH_EVENT = "cv_active_branch_change";

function parseBranchId(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

export function getActiveBranchId(fallback = null) {
  try {
    const raw = localStorage.getItem(ACTIVE_BRANCH_STORAGE_KEY);
    const parsed = parseBranchId(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export function setActiveBranchId(branchId) {
  const normalized = parseBranchId(branchId);
  try {
    if (normalized === null) {
      localStorage.removeItem(ACTIVE_BRANCH_STORAGE_KEY);
    } else {
      localStorage.setItem(ACTIVE_BRANCH_STORAGE_KEY, String(normalized));
    }
    localStorage.setItem("cv_active_branch_updated_at", String(Date.now()));
  } catch {
    // ignore storage errors
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(ACTIVE_BRANCH_EVENT, {
        detail: { branchId: normalized },
      })
    );
  }

  return normalized;
}

export function onActiveBranchChange(handler) {
  if (typeof window === "undefined") {
    return () => {};
  }
  const wrapped = (event) => {
    const nextBranchId =
      event?.detail && Object.prototype.hasOwnProperty.call(event.detail, "branchId")
        ? event.detail.branchId
        : getActiveBranchId(null);
    handler(nextBranchId);
  };

  const onStorage = (event) => {
    if (
      event?.key === ACTIVE_BRANCH_STORAGE_KEY ||
      event?.key === "cv_active_branch_updated_at"
    ) {
      handler(getActiveBranchId(null));
    }
  };

  window.addEventListener(ACTIVE_BRANCH_EVENT, wrapped);
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener(ACTIVE_BRANCH_EVENT, wrapped);
    window.removeEventListener("storage", onStorage);
  };
}