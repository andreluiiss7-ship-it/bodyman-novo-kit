const STORAGE_KEY = "site_utms";

const TRACKED_PARAMS = ["src", "sck", "utm_source", "utm_campaign", "utm_medium", "utm_content", "utm_term"] as const;

export interface StoredUtms {
  src?: string;
  sck?: string;
  utm_source?: string;
  utm_campaign?: string;
  utm_medium?: string;
  utm_content?: string;
  utm_term?: string;
}

export function captureUtmsFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const found: StoredUtms = {};
  let hasAny = false;

  for (const key of TRACKED_PARAMS) {
    const value = params.get(key);
    if (value) {
      found[key] = value;
      hasAny = true;
    }
  }

  if (hasAny) {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(found));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(found));
  }
}

export function getStoredUtms(): StoredUtms {
  const raw = sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
