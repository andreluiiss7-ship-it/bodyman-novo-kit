import QRCode from "qrcode";
import { getSelectedKit } from "./cart-state";
import { getStoredUtms } from "./utm-tracking";
import { OFFER } from "../data/offer";
import { getKit } from "../data/kits";
import { getShipping, DEFAULT_SHIPPING_ID } from "../data/shipping";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

function trackPixel(event: string, params?: Record<string, unknown>) {
  window.fbq?.("track", event, params);
}

function formatBRL(value: number) {
  return value.toFixed(2).replace(".", ",");
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function isValidCPF(raw: string): boolean {
  const cpf = onlyDigits(raw);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const digits = cpf.split("").map(Number);
  const calcCheckDigit = (length: number) => {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += digits[i] * (length + 1 - i);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return calcCheckDigit(9) === digits[9] && calcCheckDigit(10) === digits[10];
}

function formatPhoneInput(input: HTMLInputElement) {
  input.addEventListener("input", () => {
    const digits = onlyDigits(input.value).slice(0, 11);
    const ddd = digits.slice(0, 2);
    const rest = digits.slice(2);
    if (digits.length <= 2) {
      input.value = digits.length ? `(${ddd}` : "";
    } else if (rest.length <= 5) {
      input.value = `(${ddd}) ${rest}`;
    } else {
      input.value = `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5, 9)}`;
    }
  });
}

function formatCpfInput(input: HTMLInputElement) {
  input.addEventListener("input", () => {
    const digits = onlyDigits(input.value).slice(0, 11);
    input.value = digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  });
}

function formatCepInput(input: HTMLInputElement) {
  input.addEventListener("input", () => {
    const digits = onlyDigits(input.value).slice(0, 8);
    input.value = digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
  });
}

export function mountCheckout() {
  const modal = document.getElementById("checkout-modal");
  const backdrop = document.getElementById("checkout-backdrop");
  const panel = document.getElementById("checkout-panel");
  if (!modal || !backdrop || !panel) return;

  const steps: Record<string, HTMLElement> = {
    "1": document.getElementById("checkout-step-1")!,
    "2": document.getElementById("checkout-step-2")!,
    "3": document.getElementById("checkout-step-3")!,
    "4": document.getElementById("checkout-step-4")!,
  };

  const step1Form = steps["1"] as HTMLFormElement;
  const cpfInput = step1Form.querySelector<HTMLInputElement>('[name="cpf"]')!;
  const cpfError = step1Form.querySelector<HTMLElement>("[data-cpf-error]")!;
  const cepInput = step1Form.querySelector<HTMLInputElement>('[name="cep"]')!;
  const cepStatus = step1Form.querySelector<HTMLElement>("[data-cep-status]")!;
  const phoneInput = step1Form.querySelector<HTMLInputElement>('[name="telefone"]')!;
  const formError = step1Form.querySelector<HTMLElement>("[data-form-error]")!;

  function fieldErrorMessage(input: HTMLInputElement): string {
    if (input.validity.valueMissing) return "Preencha este campo.";
    if (input.validity.typeMismatch) return "Formato inválido.";
    return "Campo inválido.";
  }

  function clearFieldErrors() {
    step1Form.querySelectorAll<HTMLElement>("[data-error-for]").forEach((el) => {
      el.classList.add("hidden");
      el.textContent = "";
    });
    step1Form.querySelectorAll<HTMLInputElement>("input[required]").forEach((el) => {
      el.classList.remove("border-red-500", "focus:ring-red-500/40");
    });
  }

  function validateStep1Fields(): HTMLInputElement | null {
    let firstInvalid: HTMLInputElement | null = null;
    step1Form.querySelectorAll<HTMLInputElement>("input[required]:not([name='cpf'])").forEach((input) => {
      if (input.checkValidity()) return;
      input.classList.add("border-red-500", "focus:ring-red-500/40");
      const errEl = step1Form.querySelector<HTMLElement>(`[data-error-for="${input.name}"]`);
      if (errEl) {
        errEl.textContent = fieldErrorMessage(input);
        errEl.classList.remove("hidden");
      }
      if (!firstInvalid) firstInvalid = input;
    });
    return firstInvalid;
  }

  formatPhoneInput(phoneInput);
  formatCpfInput(cpfInput);
  formatCepInput(cepInput);
  cpfInput.addEventListener("input", () => {
    cpfError.classList.add("hidden");
    cpfInput.classList.remove("border-red-500", "focus:ring-red-500/40");
  });

  let orderId: string | null = null;
  let pollTimer: number | undefined;
  let selectedShippingId = DEFAULT_SHIPPING_ID;
  let selectedFragrance: string | null = null;

  const reviewImg = document.querySelector<HTMLImageElement>("[data-review-kit-image]");
  const defaultKitImageSrc = reviewImg?.getAttribute("src") ?? "";
  const fragranceError = document.querySelector<HTMLElement>("[data-fragrance-error]");

  function totals() {
    const kit = getKit(getSelectedKit());
    const shipping = getShipping(selectedShippingId);
    const subtotal = kit.price;
    const total = Math.round((subtotal + shipping.price) * 100) / 100;
    return { kit, shipping, subtotal, total };
  }

  function renderShippingCards() {
    document.querySelectorAll<HTMLElement>("[data-shipping-option]").forEach((btn) => {
      const isMatch = btn.dataset.shippingOption === selectedShippingId;
      btn.setAttribute("aria-checked", String(isMatch));
      btn.classList.toggle("border-[var(--wine)]", isMatch);
      btn.classList.toggle("bg-[var(--blush)]", isMatch);
      btn.classList.toggle("shadow-sm", isMatch);
      btn.classList.toggle("border-black/15", !isMatch);
      btn.classList.toggle("bg-white", !isMatch);
      const dot = btn.querySelector<HTMLElement>("[data-shipping-radio]");
      if (dot) dot.classList.toggle("opacity-100", isMatch);
      if (dot) dot.classList.toggle("opacity-0", !isMatch);
    });
  }

  function renderFragrancePicker() {
    const { kit } = totals();
    const picker = document.getElementById("fragrance-picker");
    if (picker) picker.classList.toggle("hidden", !kit.requiresFragrance);
    document.querySelectorAll<HTMLElement>("[data-fragrance-option]").forEach((btn) => {
      const isMatch = btn.dataset.fragranceOption === selectedFragrance;
      btn.setAttribute("aria-checked", String(isMatch));
      btn.classList.toggle("border-[var(--wine)]", isMatch);
      btn.classList.toggle("bg-[var(--blush)]", isMatch);
      btn.classList.toggle("border-black/15", !isMatch);
      btn.classList.toggle("bg-white", !isMatch);
    });
  }

  document.querySelectorAll<HTMLElement>("[data-fragrance-option]").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedFragrance = btn.dataset.fragranceOption || null;
      fragranceError?.classList.add("hidden");
      renderFragrancePicker();
      if (reviewImg) reviewImg.src = btn.dataset.fragranceThumb || defaultKitImageSrc;
    });
  });

  // Tilt 3D sutil só em desktop com mouse (não faz sentido em touch).
  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    document.querySelectorAll<HTMLElement>(".fragrance-card").forEach((card) => {
      card.addEventListener("mousemove", (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform = `perspective(700px) rotateX(${(-py * 5).toFixed(2)}deg) rotateY(${(px * 6).toFixed(2)}deg)`;
      });
      card.addEventListener("mouseleave", () => { card.style.transform = ""; });
    });
  }

  function renderLiveTotal() {
    const { kit, shipping, subtotal, total } = totals();
    const subEl = document.querySelector("[data-live-subtotal]");
    const freEl = document.querySelector("[data-live-shipping]");
    const totEl = document.querySelector("[data-live-total]");
    const ctaEl = document.querySelector("[data-step1-cta-total]");
    const freNameEl = document.querySelector("[data-live-shipping-name]");
    const freHintEl = document.querySelector("[data-live-shipping-hint]");
    if (subEl) subEl.textContent = `R$ ${formatBRL(subtotal)}`;
    if (freEl) freEl.textContent = shipping.price > 0 ? `R$ ${formatBRL(shipping.price)}` : "Grátis";
    if (freNameEl) freNameEl.textContent = shipping.name;
    if (totEl) totEl.textContent = `R$ ${formatBRL(total)}`;
    if (ctaEl) ctaEl.textContent = `R$ ${formatBRL(total)}`;
    if (freHintEl) {
      freHintEl.textContent =
        shipping.price > 0
          ? "Prefere economizar? Selecione Frete Grátis acima."
          : "Recomendamos o Frete Expresso pra receber em até 7 dias.";
    }
    // Sidebar (desktop) + header total badge
    const sidebarSub = document.querySelector("[data-sidebar-subtotal]");
    const sidebarFre = document.querySelector("[data-sidebar-shipping]");
    const sidebarFreName = document.querySelector("[data-sidebar-shipping-name]");
    const sidebarTot = document.querySelector("[data-sidebar-total]");
    const sidebarKitName = document.querySelector("[data-sidebar-kit-name]");
    const sidebarKitPer = document.querySelector("[data-sidebar-kit-per]");
    const sidebarKitQty = document.querySelector("[data-review-kit-qty]");
    const headerTot = document.querySelector("[data-header-total]");
    if (sidebarSub) sidebarSub.textContent = `R$ ${formatBRL(subtotal)}`;
    if (sidebarFre) sidebarFre.textContent = shipping.price > 0 ? `R$ ${formatBRL(shipping.price)}` : "Grátis";
    if (sidebarFreName) sidebarFreName.textContent = shipping.name;
    if (sidebarTot) sidebarTot.textContent = `R$ ${formatBRL(total)}`;
    if (sidebarKitName) sidebarKitName.textContent = kit.name;
    if (sidebarKitPer) sidebarKitPer.textContent = `R$ ${formatBRL(kit.perUnit)} por frasco`;
    if (sidebarKitQty) sidebarKitQty.textContent = String(kit.qty);
    if (headerTot) headerTot.textContent = `R$ ${formatBRL(total)}`;
  }

  function renderReview() {
    const { kit, shipping, subtotal, total } = totals();
    const nameEl = document.querySelector("[data-review-offer-name]");
    const qtyEl = document.querySelector("[data-review-qty]");
    const subEl = document.querySelector("[data-review-subtotal]");
    const freEl = document.querySelector("[data-review-shipping]");
    const freNameEl = document.querySelector("[data-review-shipping-name]");
    const totEl = document.querySelector("[data-review-total]");
    const addrEl = document.querySelector("[data-review-address]");
    if (nameEl) {
      nameEl.textContent = kit.requiresFragrance && selectedFragrance
        ? `${OFFER.name} — ${kit.name} (${selectedFragrance})`
        : `${OFFER.name} — ${kit.name}`;
    }
    if (qtyEl) qtyEl.textContent = `${kit.qty} × 100ml`;
    if (subEl) subEl.textContent = `R$ ${formatBRL(subtotal)}`;
    if (freNameEl) freNameEl.textContent = shipping.name;
    if (freEl) freEl.textContent = shipping.price > 0 ? `R$ ${formatBRL(shipping.price)}` : "Grátis";
    if (totEl) totEl.textContent = `R$ ${formatBRL(total)}`;
    if (addrEl) {
      const fd = new FormData(step1Form);
      const rua = fd.get("rua"), num = fd.get("numero"), bairro = fd.get("bairro"), cidade = fd.get("cidade"), uf = fd.get("uf");
      addrEl.textContent = [rua, num].filter(Boolean).join(", ") + ` — ${bairro}, ${cidade}/${uf}`;
    }
  }

  document.querySelectorAll<HTMLElement>("[data-shipping-option]").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedShippingId = btn.dataset.shippingOption || DEFAULT_SHIPPING_ID;
      renderShippingCards();
      renderLiveTotal();
    });
  });

  function showStep(id: keyof typeof steps) {
    Object.entries(steps).forEach(([key, el]) => el.classList.toggle("hidden", key !== id));
    panel!.scrollTop = 0;
  }

  function openModal() {
    modal!.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    document.querySelector<HTMLElement>(".stickycta")?.classList.add("is-covered");
    if (!orderId) showStep("1");
    selectedFragrance = null;
    fragranceError?.classList.add("hidden");
    if (reviewImg) reviewImg.src = defaultKitImageSrc;
    renderFragrancePicker();
    renderShippingCards();
    renderLiveTotal();
    requestAnimationFrame(() => {
      backdrop!.classList.remove("opacity-0");
      panel!.classList.remove("translate-y-full", "sm:translate-y-4", "sm:opacity-0");
    });
    const { kit, total } = totals();
    trackPixel("InitiateCheckout", {
      content_ids: [OFFER.id],
      content_type: "product",
      num_items: kit.qty,
      value: total,
      currency: "BRL",
    });
  }

  function closeModal() {
    backdrop!.classList.add("opacity-0");
    panel!.classList.add("translate-y-full", "sm:translate-y-4", "sm:opacity-0");
    document.querySelector<HTMLElement>(".stickycta")?.classList.remove("is-covered");
    window.setTimeout(() => {
      modal!.classList.add("hidden");
      document.body.style.overflow = "";
    }, 300);
  }

  document.querySelectorAll<HTMLElement>("[data-open-checkout]").forEach((btn) => {
    btn.addEventListener("click", openModal);
  });
  document.querySelectorAll<HTMLElement>("[data-close-checkout]").forEach((btn) => {
    btn.addEventListener("click", closeModal);
  });
  backdrop.addEventListener("click", closeModal);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal!.classList.contains("hidden")) closeModal();
  });

  cepInput.addEventListener("blur", async () => {
    const cep = onlyDigits(cepInput.value);
    if (cep.length !== 8) return;
    cepStatus.textContent = "Buscando endereço…";
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await resp.json();
      if (data.erro) {
        cepStatus.textContent = "CEP não encontrado. Preencha manualmente.";
        return;
      }
      (step1Form.querySelector('[name="rua"]') as HTMLInputElement).value = data.logradouro || "";
      (step1Form.querySelector('[name="bairro"]') as HTMLInputElement).value = data.bairro || "";
      (step1Form.querySelector('[name="cidade"]') as HTMLInputElement).value = data.localidade || "";
      (step1Form.querySelector('[name="uf"]') as HTMLInputElement).value = data.uf || "";
      cepStatus.textContent = "✓ Endereço encontrado";
      cepStatus.classList.add("text-[var(--pix)]");
      step1Form.querySelector<HTMLInputElement>('[name="numero"]')?.focus();
    } catch {
      cepStatus.textContent = "Não foi possível buscar o CEP agora.";
    }
  });

  step1Form.querySelectorAll<HTMLInputElement>("input[required]:not([name='cpf'])").forEach((input) => {
    input.addEventListener("input", () => {
      if (!input.checkValidity()) return;
      input.classList.remove("border-red-500", "focus:ring-red-500/40");
      step1Form.querySelector<HTMLElement>(`[data-error-for="${input.name}"]`)?.classList.add("hidden");
    });
  });

  step1Form.addEventListener("submit", (e) => {
    e.preventDefault();
    formError.classList.add("hidden");
    cpfError.classList.add("hidden");
    clearFieldErrors();

    const firstInvalid = validateStep1Fields();
    if (firstInvalid) {
      formError.textContent = "Preencha todos os campos obrigatórios.";
      formError.classList.remove("hidden");
      (firstInvalid as HTMLInputElement).scrollIntoView({ behavior: "smooth", block: "center" });
      (firstInvalid as HTMLInputElement).focus();
      return;
    }
    if (!isValidCPF(cpfInput.value)) {
      cpfError.classList.remove("hidden");
      cpfInput.classList.add("border-red-500", "focus:ring-red-500/40");
      cpfInput.scrollIntoView({ behavior: "smooth", block: "center" });
      cpfInput.focus();
      return;
    }
    const { kit: currentKit } = totals();
    if (currentKit.requiresFragrance && !selectedFragrance) {
      fragranceError?.classList.remove("hidden");
      document.getElementById("fragrance-picker")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    renderReview();
    const { total } = totals();
    trackPixel("Lead", { content_name: OFFER.name, value: total, currency: "BRL" });
    showStep("2");
  });

  document.querySelector("[data-edit-step1]")?.addEventListener("click", () => showStep("1"));

  document.querySelector("[data-generate-pix]")?.addEventListener("click", async () => {
    const btn = document.querySelector<HTMLButtonElement>("[data-generate-pix]")!;
    const label = document.querySelector("[data-generate-pix-label]")!;
    const paymentError = document.querySelector<HTMLElement>("[data-payment-error]")!;
    paymentError.classList.add("hidden");
    btn.disabled = true;
    label.textContent = "Gerando Pix…";

    const formData = new FormData(step1Form);
    const { total } = totals();

    try {
      const resp = await fetch("/api/criar-pix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kitIndex: getSelectedKit(),
          cliente: {
            nome: formData.get("nome"),
            email: formData.get("email"),
            telefone: onlyDigits(String(formData.get("telefone"))),
            cpf: onlyDigits(String(formData.get("cpf"))),
          },
          endereco: {
            cep: onlyDigits(String(formData.get("cep"))),
            rua: formData.get("rua"),
            numero: formData.get("numero"),
            complemento: formData.get("complemento"),
            bairro: formData.get("bairro"),
            cidade: formData.get("cidade"),
            uf: formData.get("uf"),
          },
          frete: selectedShippingId,
          fragrance: selectedFragrance,
          tracking: getStoredUtms(),
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Falha ao gerar o Pix.");

      orderId = data.orderId;
      const pixCode: string = data.pix.code;

      const qrDataUrl = await QRCode.toDataURL(pixCode, { margin: 1, width: 440 });
      (document.querySelector("[data-pix-qr]") as HTMLImageElement).src = qrDataUrl;
      (document.querySelector("[data-pix-code]") as HTMLInputElement).value = pixCode;
      const step3Total = document.querySelector("[data-step3-total]");
      if (step3Total) step3Total.textContent = `R$ ${formatBRL(total)}`;

      trackPixel("AddPaymentInfo", {
        content_ids: [OFFER.id],
        content_type: "product",
        value: total,
        currency: "BRL",
      });
      showStep("3");
      pollStatus();
    } catch (err) {
      paymentError.textContent = err instanceof Error ? err.message : "Erro inesperado. Tente novamente.";
      paymentError.classList.remove("hidden");
    } finally {
      btn.disabled = false;
      label.textContent = "Gerar Pix agora";
    }
  });

  document.querySelector("[data-copy-pix]")?.addEventListener("click", async () => {
    const input = document.querySelector<HTMLInputElement>("[data-pix-code]")!;
    await navigator.clipboard.writeText(input.value);
    const copyBtn = document.querySelector("[data-copy-pix]")!;
    const original = copyBtn.textContent;
    copyBtn.textContent = "Copiado ✓";
    setTimeout(() => (copyBtn.textContent = original), 2000);
  });

  function pollStatus() {
    if (!orderId) return;
    const { total } = totals();
    window.clearInterval(pollTimer);
    pollTimer = window.setInterval(async () => {
      try {
        const resp = await fetch(`/api/status-pedido?id=${orderId}`);
        if (!resp.ok) return;
        const data = await resp.json();
        if (data.status === "paid") {
          window.clearInterval(pollTimer);
          trackPixel("Purchase", {
            content_ids: [OFFER.id],
            content_type: "product",
            value: total,
            currency: "BRL",
          });
          document.querySelector("[data-success-order-id]")!.textContent = orderId;
          const trackLink = document.querySelector<HTMLAnchorElement>("[data-track-link]");
          if (trackLink) trackLink.href = `/rastrear-pedido?codigo=${orderId}`;
          showStep("4");
          orderId = null;
        }
      } catch {
        // silent retry on next tick
      }
    }, 4000);
  }
}
