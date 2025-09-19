// checkout.js — robusto (evita "Cannot set properties of null")

(function () {
  // ---------- Utils ----------
  const currencyFmt = new Intl.NumberFormat('es-CR', {
    style: 'currency', currency: 'CRC', minimumFractionDigits: 2
  });

  const $ = (sel) => document.querySelector(sel);
  const setText = (sel, value) => {
    const el = $(sel);
    if (!el) {
      console.warn('[checkout] No se encontró el selector:', sel);
      return;
    }
    el.textContent = value;
  };
  const on = (el, evt, fn) => el && el.addEventListener(evt, fn, { passive: true });

  // ---------- Carrito ----------
  // Ajusta si tu carrito vive en Firestore; aquí usamos LocalStorage como fallback.
function readCart() {
  const KEYS = ['miniStoreCart', 'cart']; // lee primero el que usa store.js
  for (const key of KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;

      const data = JSON.parse(raw);
      // Soporta dos formatos: [{...}] o { items:[...] }
      const itemsArr = Array.isArray(data) ? data
        : Array.isArray(data.items) ? data.items : [];

      const items = itemsArr.map(it => ({
        name: it.title || it.name || 'Producto',
        price: Number(it.price) || 0,
        qty: Number(it.qty) || 1,
      }));

      const total = items.reduce((a, i) => a + i.price * i.qty, 0);
      return { items, total, _key: key };
    } catch (e) {
      console.warn('[checkout] carrito ilegible en', key, e);
    }
  }
  return { items: [], total: 0, _key: 'miniStoreCart' };
}

// Asegura re-render cuando cambie cualquiera de las dos claves
window.addEventListener('storage', (ev) => {
  if (ev.key === 'miniStoreCart' || ev.key === 'cart') {
    renderCartItems?.();
    renderTotals?.();
  }
});


  function renderTotals() {
    const { total } = readCart();
    const pretty = currencyFmt.format(total || 0);

    setText('#cartTotal', pretty);
    setText('#sinpeAmount', pretty);
    setText('#totalToSend', pretty);
  }

  // (Opcional) Render básico de items si lo deseas
  function renderCartItems() {
    const { items } = readCart();
    const wrap = $('#cartList');
    if (!wrap) return;

    wrap.innerHTML = '';
    if (!items.length) {
      wrap.innerHTML = '<p class="text-white-50 m-0">Tu carrito está vacío.</p>';
      return;
    }

    items.forEach((it) => {
      const li = document.createElement('div');
      li.className = 'd-flex align-items-center justify-content-between text-white';
      li.style.padding = '.35rem 0';
      const name = (it.name || 'Producto');
      const qty = Number(it.qty) || 1;
      const price = currencyFmt.format((Number(it.price) || 0) * qty);
      li.innerHTML = `
        <span class="text-white-70">${name} × ${qty}</span>
        <strong>${price}</strong>
      `;
      wrap.appendChild(li);
    });
  }

  // ---------- Formulario ----------
  async function createOrderFlow({ name, phone, file, total }) {
    // Sustituye por tu lógica real (Storage + Firestore)
    // - Subir comprobante a Storage
    // - Guardar documento en "orders" con estado "En revisión"
    console.log('[checkout] createOrderFlow()', { name, phone, total, file });
    await new Promise((r) => setTimeout(r, 250)); // pequeña simulación
  }

  function bindForm() {
    const btn = $('#btnCreateOrder');
    on(btn, 'click', async (e) => {
      e.preventDefault();

      const name = ($('#inputName') || {}).value || '';
      const phone = ($('#inputPhone') || {}).value || '';
      const fileInput = $('#inputReceipt');
      const file = fileInput && fileInput.files && fileInput.files[0];

      const { total } = readCart();

      if (total <= 0) {
        alert('Tu carrito está vacío.');
        return;
      }
      if (!name.trim() || !phone.trim() || !file) {
        alert('Completa tu nombre, teléfono SINPE y adjunta el comprobante.');
        return;
      }

      try {
        await createOrderFlow({ name, phone, file, total });
        alert('¡Listo! Tu orden fue creada con estado "En revisión".');
        // Opcional: limpiar carrito y redirigir
        // localStorage.removeItem('cart');
        // location.href = './gracias.html';
      } catch (err) {
        console.error('[checkout] Error creando orden:', err);
        alert('Ocurrió un error creando la orden. Intenta de nuevo.');
      }
    });
  }

  // ---------- Init ----------
  document.addEventListener('DOMContentLoaded', () => {
    renderCartItems();
    renderTotals();
    bindForm();
  });

  // Si las cantidades cambian en otra pestaña, actualiza
  window.addEventListener('storage', (ev) => {
    if (ev.key === 'cart') {
      renderCartItems();
      renderTotals();
    }
  });
})();
