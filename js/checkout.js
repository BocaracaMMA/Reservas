// ./js/checkout.js
import { auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { showAlert } from './showAlert.js';

onAuthStateChanged(auth, user => { if (!user) location.href = './index.html'; });

const money = new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' });
const CART_KEY = 'miniStoreCart';
const SHIPPING = 2000;

const ckList = document.getElementById('ckList');
const ckTotal = document.getElementById('ckTotal');
const ckSubtotal = document.getElementById('ckSubtotal');
const ckShipping = document.getElementById('ckShipping');
const ckGrand = document.getElementById('ckGrand');
const ckPay = document.getElementById('ckPay');

function getCart(){ try{ return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch{ return []; } }
function setCart(arr){ localStorage.setItem(CART_KEY, JSON.stringify(arr)); render(); }

function render(){
  const cart = getCart();
  ckList.innerHTML = '';
  let subtotal = 0;

  cart.forEach((it, idx) => {
    subtotal += Number(it.price||0) * Number(it.qty||0);
    const row = document.createElement('div');
    row.className = 'checkout-item';
    const imgSrc = it.imageUrl || it.imageURL || './assets/placeholder-1x1.png';
    row.innerHTML = `
      <img src="${imgSrc}" alt="${it.title||''}" referrerpolicy="no-referrer">
      <div class="flex-grow-1">
        <div class="fw-semibold">${it.title||''}</div>
        <div style="color:#8b949e;">${money.format(Number(it.price||0))} × <span class="q">${it.qty||1}</span></div>
      </div>
      <div class="qty-ctrl">
        <button data-a="minus" data-i="${idx}"><i class="bi bi-dash"></i></button>
        <button data-a="plus"  data-i="${idx}"><i class="bi bi-plus"></i></button>
      </div>
      <button class="remove-btn" data-a="rm" data-i="${idx}"><i class="bi bi-x"></i></button>
    `;
    ckList.appendChild(row);
  });

  const total = subtotal + (cart.length ? SHIPPING : 0);
  ckSubtotal.textContent = money.format(subtotal);
  ckShipping.textContent = cart.length ? money.format(SHIPPING) : money.format(0);
  ckGrand.textContent = money.format(total);
  ckTotal.textContent = money.format(total);
}

// Eventos de la lista
ckList.addEventListener('click', (e)=>{
  const btn = e.target.closest('button'); if(!btn) return;
  const i = Number(btn.dataset.i), a = btn.dataset.a;
  const cart = getCart();
  if (a === 'minus') cart[i].qty = Math.max(1, Number(cart[i].qty || 1) - 1);
  if (a === 'plus')  cart[i].qty = Number(cart[i].qty || 1) + 1;
  if (a === 'rm')    cart.splice(i,1);
  setCart(cart);
});

// Botón demo de pago
ckPay.addEventListener('click', ()=>{
  if (!getCart().length) return showAlert('Tu carrito está vacío','error');
  showAlert('Esto es una demo visual del checkout.','success');
});

render();
