// ./js/store.js
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  collection, onSnapshot, query, where
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showAlert } from './showAlert.js';

// Formateador de moneda
const money = new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' });

// DOM
const grid = document.getElementById('productsGrid');
const cartCount = document.getElementById('cartCount');

// Modal rápido (reutilizamos el de asistencia para no re-estructurar más)
let quickModal;
function ensureQuickModal(){
  if (quickModal) return quickModal;
  const wrap = document.createElement('div');
  wrap.className = 'asistencia-modal';
  wrap.innerHTML = `
    <div class="modal-content" style="max-width:420px;">
      <div class="product-modal-imgwrap"><img id="pmImg" alt=""></div>
      <h2 id="pmTitle" style="margin:.5rem 0;"></h2>
      <div id="pmPrice" style="font-weight:600; margin-bottom:.25rem;"></div>
      <div id="pmStock" style="font-size:.9rem; color:#8b949e; margin-bottom:.5rem;"></div>
      <div id="pmDesc" style="margin-bottom:.75rem;"></div>
      <div style="display:flex; gap:.5rem; align-items:center; justify-content:center;">
        <input id="pmQty" type="number" min="1" value="1"
          style="width:80px; background:#21262d; border:1px solid #30363d; color:#c9d1d9; border-radius:6px; padding:6px; text-align:center;">
        <button id="pmAdd" class="btn success">Agregar al carrito</button>
      </div>
      <button id="pmClose" class="btn error" style="margin-top:1rem;">Cerrar</button>
    </div>`;
  document.body.appendChild(wrap);
  quickModal = {
    root: wrap,
    img: wrap.querySelector('#pmImg'),
    title: wrap.querySelector('#pmTitle'),
    price: wrap.querySelector('#pmPrice'),
    stock: wrap.querySelector('#pmStock'),
    desc: wrap.querySelector('#pmDesc'),
    qty: wrap.querySelector('#pmQty'),
    add: wrap.querySelector('#pmAdd'),
    close: wrap.querySelector('#pmClose'),
  };
  quickModal.close.addEventListener('click', ()=> wrap.classList.remove('active'));
  return quickModal;
}

// Auth
onAuthStateChanged(auth, user => {
  if (!user) window.location.href = './index.html';
});

// Render productos activos
let productsCache = [];
onSnapshot(query(collection(db, 'products'), where('active','==', true)), snap => {
  productsCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderGrid();
});

// Helpers carrito
const CART_KEY = 'miniStoreCart';
const getCart = () => { try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch { return []; } };
const setCart = (arr) => { localStorage.setItem(CART_KEY, JSON.stringify(arr)); updateCartCount(); };
function updateCartCount(){ cartCount.textContent = getCart().reduce((a,i)=> a + Number(i.qty||0), 0); }
updateCartCount();

function renderGrid(){
  grid.innerHTML = '';
  productsCache
    .filter(p => (typeof p.stock === 'number' ? p.stock > 0 : true))
    .forEach(p => {
      const imgSrc =
        p.imageUrl || p.imageURL || p.image || './assets/placeholder-1x1.png';

      const card = document.createElement('div');
      card.className = 'product-card';
      card.innerHTML = `
        <div class="product-thumb">
          <img src="${imgSrc}" alt="${p.title || ''}" referrerpolicy="no-referrer">
        </div>
        <div class="info">
          <h3>${p.title || ''}</h3>
          <div class="prod-meta">
            <span class="price">${money.format(Number(p.price||0))}</span>
            ${typeof p.stock === 'number' ? `<span class="stock">${p.stock} en stock</span>` : ''}
          </div>
          <button class="btn-view" data-id="${p.id}">Ver</button>
        </div>
      `;
      card.querySelector('.btn-view').addEventListener('click', ()=> openQuick(p.id));
      grid.appendChild(card);
    });
}

function openQuick(id){
  const p = productsCache.find(x => x.id === id);
  if (!p) return;

  const M = ensureQuickModal();
  const imgSrc = p.imageUrl || p.imageURL || p.image || './assets/placeholder-1x1.png';
  M.img.src = imgSrc;
  M.title.textContent = p.title || '';
  M.price.textContent = money.format(Number(p.price||0));
  M.stock.textContent = (typeof p.stock==='number') ? `${p.stock} en stock` : '';
  M.desc.innerHTML = p.description || '';
  M.qty.value = '1';

  M.add.onclick = () => {
    const qty = Math.max(1, Math.min(Number(M.qty.value||1), Number(p.stock||9999)));
    const cart = getCart();
    const idx = cart.findIndex(x => x.id === p.id);
    if (idx >= 0) cart[idx].qty += qty;
    else cart.push({ id:p.id, title:p.title||'', price:Number(p.price||0), imageUrl:imgSrc, qty });
    setCart(cart);
    showAlert('Agregado al carrito','success');
    M.root.classList.remove('active');
  };

  M.root.classList.add('active');
}
