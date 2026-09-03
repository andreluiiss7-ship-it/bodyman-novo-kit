const COUNTDOWN_SECONDS = 15 * 60;
const STORAGE_KEY = "site_countdown_deadline";

function getDeadline(): number {
  const stored = sessionStorage.getItem(STORAGE_KEY);
  const now = Date.now();
  if (stored) {
    const deadline = Number(stored);
    if (deadline > now) return deadline;
  }
  const deadline = now + COUNTDOWN_SECONDS * 1000;
  sessionStorage.setItem(STORAGE_KEY, String(deadline));
  return deadline;
}

export function mountCountdown(selector: string) {
  const els = document.querySelectorAll<HTMLElement>(selector);
  if (!els.length) return;

  function render() {
    let deadline = getDeadline();
    let remaining = Math.max(0, Math.floor((deadline - Date.now()) / 1000));
    if (remaining === 0) {
      sessionStorage.removeItem(STORAGE_KEY);
      deadline = getDeadline();
      remaining = COUNTDOWN_SECONDS;
    }
    const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
    const ss = String(remaining % 60).padStart(2, "0");
    els.forEach((el) => (el.textContent = `${mm}:${ss}`));
  }

  render();
  setInterval(render, 1000);
}
