/**
 * IntersectionObserver global — marca elementos [data-reveal] com data-visible="true"
 * quando entram no viewport (uma vez só). O CSS cuida da transição.
 * Respeita prefers-reduced-motion (o próprio CSS já anula a transição nesse caso).
 */
export function mountReveal() {
  if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
    document.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => {
      el.dataset.visible = "true";
    });
    return;
  }

  const obs = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          (entry.target as HTMLElement).dataset.visible = "true";
          obs.unobserve(entry.target);
        }
      }
    },
    { rootMargin: "0px 0px -80px 0px", threshold: 0.05 }
  );

  document.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => obs.observe(el));
}
