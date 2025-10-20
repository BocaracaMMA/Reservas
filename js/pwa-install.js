// ./js/pwa-install.js
let deferredPrompt = null;

(function injectCSS(){
  if (document.getElementById("pwa-install-css")) return;
  const s = document.createElement("style");
  s.id = "pwa-install-css";
  s.textContent = `
    #installBanner{display:none;gap:.5rem;align-items:center;justify-content:center;margin:.75rem auto;}
    #installBanner.show{display:flex;}
    #installBanner .btn{padding:.45rem .75rem;border-radius:10px;border:1px solid #334155;background:#14532d;color:#e5e7eb;cursor:pointer}
    #installBanner .btn.secondary{background:#1f2937;border-color:#334155}
    #iosTip{position:fixed;inset:0;display:none;place-items:center;background:rgba(0,0,0,.45);z-index:9999}
    #iosTip.active{display:grid}
    #iosTip .card{width:min(92vw,440px);background:#0c131a;border:1px solid #22303d;border-radius:14px;padding:14px;color:#e5e7eb}
  `;
  document.head.appendChild(s);
})();

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  window.navigator.standalone === true;

const isIOS    = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isSafari = () => /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

function ensureUI(){
  if (document.getElementById("installBanner")) return;
  const host = document.querySelector(".logo-container") || document.querySelector("main") || document.body;
  const wrap = document.createElement("div");
  wrap.id = "installBanner";
  wrap.innerHTML = `
    <button id="btnInstall" class="btn">Instalar app</button>
    <button id="btnIosTip" class="btn secondary">¿iPhone?</button>
  `;
  host.insertAdjacentElement("afterend", wrap);

  const tip = document.createElement("div");
  tip.id = "iosTip";
  tip.innerHTML = `
    <div class="card">
      <h3 style="margin:0 0 .5rem 0;">Instalar en iPhone</h3>
      <p>1) Toca <strong>Compartir</strong> (icono de la flecha).</p>
      <p>2) Elige <strong>Añadir a pantalla de inicio</strong>.</p>
      <p>3) Confirma con <strong>Añadir</strong>.</p>
      <div style="text-align:right;margin-top:.75rem">
        <button id="closeIosTip" class="btn secondary">Cerrar</button>
      </div>
    </div>
  `;
  document.body.appendChild(tip);
  document.getElementById("btnIosTip").onclick   = () => tip.classList.add("active");
  document.getElementById("closeIosTip").onclick = () => tip.classList.remove("active");

  document.getElementById("btnInstall").onclick = async () => {
    // sólo funciona si tenemos el evento capturado y estamos en browser (no standalone)
    if (!deferredPrompt) {
      console.info('[PWA] Install no disponible todavía (sin beforeinstallprompt o ya consumido).');
      // opcional: mostrar un toast propio
      try { window.showAlert?.('La instalación no está disponible ahora', 'error'); } catch {}
      return;
    }
    try {
      document.getElementById("btnInstall").disabled = true;
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      console.info('[PWA] userChoice:', choice);
    } finally {
      deferredPrompt = null; // no se puede reutilizar
      wrap.classList.remove("show");
      setTimeout(()=> { document.getElementById("btnInstall").disabled = false; }, 1200);
    }
  };
}

function showBannerIfEligible(){
  const banner = document.getElementById("installBanner");
  if (!banner) return;
  // iOS Safari no tiene beforeinstallprompt → mostramos CTA manual
  if (isIOS() && isSafari() && !isStandalone()) {
    banner.classList.add("show");
    return;
  }
  // En Chrome/Android sólo mostramos si tenemos deferredPrompt listo y no estamos instalados
  if (deferredPrompt && !isStandalone()) {
    banner.classList.add("show");
  } else {
    banner.classList.remove("show");
  }
}

// REGISTRA EL LISTENER LO ANTES POSIBLE y sólo 1 vez
window.addEventListener("beforeinstallprompt", (e) => {
  console.info('[PWA] beforeinstallprompt disparado');
  e.preventDefault();
  deferredPrompt = e;        // almacenamos para click futuro
  ensureUI();
  showBannerIfEligible();    // ahora sí podemos mostrar el botón Install
}, { once:true });

// Cuando se instala, ocultamos
window.addEventListener("appinstalled", () => {
  console.info('[PWA] appinstalled');
  document.getElementById("installBanner")?.classList.remove("show");
});

// Montaje inicial de la UI + lógicas complementarias
document.addEventListener("DOMContentLoaded", () => {
  ensureUI();
  showBannerIfEligible(); // iOS/Safari cae por aquí

  // Al recuperar foco/visibilidad, re-evalúa (por si el BIP llegó estando en bg)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') showBannerIfEligible();
  });

  // Cuando el SW ya está listo, vuelve a evaluar
  navigator.serviceWorker?.ready?.then(()=> showBannerIfEligible());
});
