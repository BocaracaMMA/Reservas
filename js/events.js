// ./js/events.js

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  collection,
  getDocs,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Referencias DOM
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
    // Detecta ambos estilos de campo
    const imgSrc   = e.imageURL    ?? e.imageUrl    ?? '';
    const start    = e.startDate   ?? e.from        ?? '';
    const end      = e.endDate     ?? e.to          ?? '';
    const ticket   = e.ticketURL   ?? e.ticketsUrl  ?? '';
    const title    = e.title       ?? '';
    const desc     = e.description ?? '';

    const card = document.createElement('div');
    card.className = 'event-card';
    card.innerHTML = `
      <img src="${imgSrc}" alt="${title}">
      <div class="info">
        <h3>${title}</h3>
        <p>${start} → ${end}</p>
      </div>
    `;
    card.addEventListener('click', () => openModal({ title, imgSrc, start, end, desc, ticket }));
    grid.appendChild(card);
  });
}

// Al cargar la página
document.addEventListener('DOMContentLoaded', () => {
  onAuthStateChanged(auth, async user => {
    if (!user) {
      // No autenticado, redirige al login
      return window.location.href = './index.html';
    }

    // 1) Carga puntual
    try {
      const coll     = collection(db, 'events');
      const snap     = await getDocs(coll);
      console.log('✅ getDocs("/events") → IDs:', snap.docs.map(d => d.id));
      renderEvents(snap.docs);
    } catch (err) {
      console.error('❌ Error con getDocs("/events"):', err);
    }

    // 2) Escucha en tiempo real
    const collRT = collection(db, 'events');
    onSnapshot(collRT, snap => {
      console.log('🔄 onSnapshot("/events") → IDs:', snap.docs.map(d => d.id));
      renderEvents(snap.docs);
    }, err => {
      console.error('❌ onSnapshot("/events") error:', err);
    });
  });
});

// Abre el modal con la info del evento
function openModal({ title, imgSrc, start, end, desc, ticket }) {
  titleEl.textContent   = title;
  imgEl.src             = imgSrc;
  datesEl.textContent   = `${start} → ${end}`;
  descEl.textContent    = desc;
  linkEl.href           = ticket;
  modal.classList.add('active');
}

// Cierra el modal
closeBtn.addEventListener('click', () => {
  modal.classList.remove('active');
});
