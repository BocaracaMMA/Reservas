// ./js/admin-metrics.js
import { auth, db } from './firebase-config.js';
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  collection, getDocs, doc, getDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showAlert } from './showAlert.js';

/* ====== Config / helpers ====== */
const ADMIN_WHITELIST = new Set([
  "vVUIH4IYqOOJdQJknGCjYjmKwUI3",
  "ScODWX8zq1ZXpzbbKk5vuHwSo7N2"
]);

const crTZ = 'America/Costa_Rica';
const todayISO = () => new Date().toLocaleDateString('en-CA',{timeZone:crTZ});
const monthsES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

function monthsBetween(d1, d2){
  // d1<=d2
  const y = d2.getFullYear() - d1.getFullYear();
  const m = d2.getMonth() - d1.getMonth();
  const total = y*12 + m + (d2.getDate() >= d1.getDate() ? 0 : -1);
  return Math.max(0,total);
}
function parseMaybeDate(v){
  if (!v) return null;
  // acepta ISO string o millis
  if (typeof v === 'number') return new Date(v);
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

/* ====== UI wiring (sidebar/logout) ====== */
document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.getElementById('toggleNav');
  const sidebar = document.getElementById('sidebar');
  toggleBtn?.addEventListener('click', ()=> sidebar?.classList.toggle('active'));

  document.getElementById('logoutSidebar')?.addEventListener('click', async (e)=>{
    e.preventDefault();
    try { await signOut(auth); location.href='index.html'; } catch {}
  });
  const fmt = new Intl.DateTimeFormat('es-CR', {
    hour:'2-digit', minute:'2-digit', second:'2-digit', timeZone: crTZ
  });
  const last = document.getElementById('lastUpdate');
  last.textContent = `Actualizado: ${fmt.format(new Date())}`;
});

/* ====== Auth gate ====== */
onAuthStateChanged(auth, async (user) => {
  if (!user) { location.href='index.html'; return; }

  // leer roles del doc
  const meSnap = await getDoc(doc(db,'users', user.uid));
  const roles = (meSnap.exists() && Array.isArray(meSnap.data().roles)) ? meSnap.data().roles : [];
  const isAdmin = roles.includes('admin') || ADMIN_WHITELIST.has(user.uid);

  if (!isAdmin) {
    showAlert('No autorizado', 'error');
    location.href='client-dashboard.html';
    return;
  }

  // Cargar métricas
  try { await buildMetrics(); }
  catch (e) {
    console.error(e);
    showAlert('No se pudieron cargar las métricas', 'error');
  }
});

/* ====== Core: buildMetrics ====== */
async function buildMetrics(){
  const usersSnap = await getDocs(collection(db,'users'));
  const users = usersSnap.docs.map(d => ({ id:d.id, ...d.data() }));

  // Totales
  const total = users.length;

  // Activos por expiryDate
  const today = new Date(todayISO());
  let activos = 0, inactivos = 0;

  // Roles
  let nAdmins=0, nProfes=0, nStudents=0;

  // Permanencia (meses desde createdAt)
  let sumMonths=0, contMonths=0;

  // Altas por mes (año actual)
  const year = new Date().getFullYear();
  const altasMes = Array(12).fill(0);

  // Género
  const genderCount = { male:0, female:0, other:0, unknown:0 };

  // Edad
  const ageBuckets = { '≤12':0, '13–17':0, '18–24':0, '25–34':0, '35–44':0, '45–54':0, '55–64':0, '65+':0 };
  let ageKnown = 0;

  users.forEach(u=>{
    // activos
    const exp = parseMaybeDate(u.expiryDate || u.expira || u.expire || null);
    if (exp){
      (exp >= today) ? activos++ : inactivos++;
    } else {
      inactivos++;
    }

    // roles
    const roles = Array.isArray(u.roles) ? u.roles : [];
    if (roles.includes('admin')) nAdmins++;
    if (roles.includes('professor')) nProfes++;
    if (roles.includes('student') || (!roles.includes('admin') && !roles.includes('professor'))) nStudents++;

    // permanencia
    const created = parseMaybeDate(u.createdAt);
    if (created){
      sumMonths += monthsBetween(created, today);
      contMonths++;
      if (created.getFullYear() === year) altasMes[created.getMonth()]++;
    }

    // género: 'genero'/'gender'
    const g = (u.genero || u.gender || '').toString().trim().toLowerCase();
    if (['m','male','masculino'].includes(g)) genderCount.male++;
    else if (['f','female','femenino'].includes(g)) genderCount.female++;
    else if (g) genderCount.other++; else genderCount.unknown++;

    // edad: ACEPTA birthDate (nuestro campo), dob, fechaNacimiento, nacimiento
    const dob = parseMaybeDate(u.birthDate || u.dob || u.fechaNacimiento || u.nacimiento);
    if (dob){
      const diff = today.getTime() - dob.getTime();
      const age = Math.floor(diff/ (365.25*24*60*60*1000));
      ageKnown++;
      if (age <= 12) ageBuckets['≤12']++;
      else if (age <= 17) ageBuckets['13–17']++;
      else if (age <= 24) ageBuckets['18–24']++;
      else if (age <= 34) ageBuckets['25–34']++;
      else if (age <= 44) ageBuckets['35–44']++;
      else if (age <= 54) ageBuckets['45–54']++;
      else if (age <= 64) ageBuckets['55–64']++;
      else ageBuckets['65+']++;
    }
  });

  // KPIs
  qs('#kpiTotal').textContent = total;
  qs('#kpiActivos').textContent = activos;
  qs('#kpiInactivos').textContent = inactivos;
  qs('#kpiAdmins').textContent = nAdmins;
  qs('#kpiProfes').textContent = nProfes;
  qs('#kpiStudents').textContent = nStudents;

  // nuevos 30 días
  const ms30 = 30*24*60*60*1000;
  const now = Date.now();
  const nuevos30 = users.filter(u=>{
    const c = parseMaybeDate(u.createdAt);
    return c && (now - c.getTime()) <= ms30;
  }).length;
  qs('#kpiNuevos').textContent = nuevos30;

  // permanencia promedio (meses)
  const promMeses = contMonths ? (sumMonths/contMonths) : 0;
  qs('#kpiPermanencia').textContent = promMeses.toFixed(1);

  // Charts
  qs('#yearBadge').textContent = year.toString();
  drawSignupChart(altasMes);
  drawGenderChart(genderCount);
  drawAgeChart(ageBuckets, ageKnown);
}

/* ====== Charts ====== */
function drawSignupChart(series){
  const ctx = document.getElementById('signupChart').getContext('2d');
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: monthsES,
      datasets: [{
        label: 'Altas',
        data: series,
        borderWidth: 2,
        tension: .25
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display:false } },
      scales: { y: { beginAtZero:true, ticks:{ precision:0 } } }
    }
  });
}

function drawGenderChart(counts){
  const unknownText = counts.unknown ? `Sin dato: ${counts.unknown}` : '';
  qs('#genderNote').textContent = unknownText;

  const ctx = document.getElementById('genderChart').getContext('2d');
  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Masculino','Femenino','Otro'],
      datasets: [{
        data: [counts.male, counts.female, counts.other]
      }]
    },
    options: {
      cutout: '65%',
      plugins: { legend: { position:'bottom' } }
    }
  });
}

function drawAgeChart(buckets, known){
  const labels = Object.keys(buckets);
  const data = labels.map(k => buckets[k]);
  if (!known) qs('#ageNote').textContent = 'Aún no hay fechas de nacimiento registradas.';
  const ctx = document.getElementById('ageChart').getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets:[{ label:'Usuarios', data, borderWidth:1 }]},
    options: {
      plugins: { legend: { display:false } },
      scales: { y: { beginAtZero:true, ticks:{ precision:0 } } }
    }
  });
}

/* ====== utils ====== */
function qs(sel){ return document.querySelector(sel); }
