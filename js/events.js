// ./js/events.js

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  collection,
  getDocs,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// formateador para fallback “día mes año”
const dateFmt = new Intl.DateTimeFormat('es-CR', {
  day:   'numeric',
  month: 'long',
  year:  'numeric'
});

/**
 * Recibe dos cadenas "YYYY-MM-DD", las parsea manualmente
 * y produce un rango:
 * - mismo mes → “18–19 julio 2025”
 * - distinto mes/año → “1 de mayo de 2025 – 31 de julio de 2025”
 */
function formatRange(start, end) {
  // PARSEO MANUAL: evita desfases por zona horaria
  const [y1, m1, d1] = start.split('-').map(Number);
  const [y2, m2, d2] = end.split('-').map(Number);
  const dt1 = new Date(y1, m1 - 1, d1);
  const dt2 = new Date(y2, m2 - 1, d2);

  // mismo mes y año?
  if (dt1.getMonth() === dt2.getMonth() && dt1.getFullYear() === dt2.getFullYear()) {
    const dayOpts = { day: 'numeric' };
    const monthYr = dt1.toLocaleDateString('es-CR', { month: 'long', year: 'numeric' });
    return `${dt1.toLocaleDateString('es-CR', dayOpts)}–${dt2.toLocaleDateString('es-CR', dayOpts)} ${monthYr}`;
  }
  // distinto mes/año: formateo completo para cada uno
  return `${dateFmt.format(dt1)} – ${dateFmt.format(dt2)}`;
}

// referencias a DOM
const grid     = document.getElementById('eventsGrid');
const modal    = document.getElementById('eventModal');
const titleEl  = document.getElementById('modalTitle');
const imgEl    = document.getElementById('modalImg');
const datesEl  = document.getElementById('modalDates');
const descEl   = document.getElementById('modalDesc');
const linkEl   = document.getElementById('modalLink');
const closeBtn = document.getElementById('modalClose');

/**
 * Renderiza un array de DocumentSnapshots en la grid
 */
function renderEvents(docs) {
  grid.innerHTML = '';
  docs.forEach(docSnap => {
    const e = docSnap.data();
    const imgSrc = e.imageURL ?? e.imageUrl ?? '';
    const start  = e.startDate  ?? e.from ?? '';
    const end    = e.endDate    ?? e.to   ?? '';
    const title  = e.title      ?? '';
    const desc   = e.description ?? '';
    const ticket = e.ticketURL  ?? e.ticketsUrl ?? '';

    const card = document.createElement('div');
    card.className = 'event-card';
    card.innerHTML = `
      <img src="${imgSrc}" alt="${title}">
      <div class="info">
        <h3>${title}</h3>
        <p>${start && end ? formatRange(start, end) : ''}</p>
      </div>`;
    card.addEventListener('click', () => openModal({ title, imgSrc, start, end, desc, ticket }));
    grid.appendChild(card);
  });
}

// al cargar
document.addEventListener('DOMContentLoaded', () => {
  // 1) solo usuarios autenticados
  onAuthStateChanged(auth, user => {
    if (!user) window.location.href = './index.html';
  });

  // 2) carga inicial
  (async () => {
    try {
      const coll = collection(db, 'events');
      const snap = await getDocs(coll);
      console.log('✅ getDocs("/events") →', snap.docs.map(d => d.id));
      renderEvents(snap.docs);
    } catch (err) {
      console.error('❌ Error con getDocs("/events"):', err);
    }
  })();

  // 3) escucha en tiempo real
  onSnapshot(collection(db, 'events'),
    snap => {
      console.log('🔄 onSnapshot("/events") →', snap.docs.map(d => d.id));
      renderEvents(snap.docs);
    },
    err => console.error('❌ onSnapshot("/events") error:', err)
  );
});

// abre el modal
function openModal({ title, imgSrc, start, end, desc, ticket }) {
  titleEl.textContent = title;
  imgEl.src           = imgSrc;
  datesEl.textContent = start && end ? formatRange(start, end) : '';
  descEl.innerHTML    = desc;
  linkEl.href         = ticket;
  modal.classList.add('active');

  // si no hay link → shake
  linkEl.onclick = e => {
    if (!ticket) {
      e.preventDefault();
      linkEl.classList.add('shake');
      setTimeout(() => linkEl.classList.remove('shake'), 500);
    }
  };
}

// cierra modal
closeBtn.addEventListener('click', () => modal.classList.remove('active'));
