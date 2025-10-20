// ./js/admin-metrics.js
import { auth, db } from './firebase-config.js';
import { signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showAlert } from './showAlert.js';
import { gateAdminPage } from './role-guard.js';

/* ========= helpers DOM/nav ========= */
const ready = (fn)=>
  (document.readyState === 'loading')
    ? document.addEventListener('DOMContentLoaded', fn, { once:true })
    : fn();

function ensureNavCSS(){
  if (document.getElementById('nav-fallback-css')) return;
  const style = document.createElement('style');
  style.id = 'nav-fallback-css';
  style.textContent = `
    .hamburger-btn{position:fixed;right:16px;top:16px;z-index:10001}
    .sidebar{position:fixed;inset:0 auto 0 0;width:260px;height:100vh;
             transform:translateX(-100%);transition:transform .25s ease;z-index:10000}
    .sidebar.active{transform:translateX(0)}
  `;
  document.head.appendChild(style);
}
function bindSidebarOnce(){
  const btn = document.getElementById('toggleNav');
  const sb  = document.getElementById('sidebar');
  if (!btn || !sb || btn.dataset.bound) return;
  btn.addEventListener('click', ()=> sb.classList.toggle('active'));
  btn.dataset.bound = '1';
}
function bindLogoutOnce(){
  const a = document.getElementById('logoutSidebar');
  if (!a || a.dataset.bound) return;
  a.addEventListener('click', async (e)=>{
    e.preventDefault();
    try { await signOut(auth); location.href='index.html'; }
    catch { showAlert('Error al cerrar sesión','error'); }
  });
  a.dataset.bound = '1';
}

const crTZ = 'America/Costa_Rica';
const todayISO = () => new Date().toLocaleDateString('en-CA',{timeZone:crTZ});
const monthsES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

function monthsBetween(d1, d2){
  const y = d2.getFullYear() - d1.getFullYear();
  const m = d2.getMonth() - d1.getMonth();
  const total = y*12 + m + (d2.getDate() >= d1.getDate() ? 0 : -1);
  return Math.max(0,total);
}
function parseMaybeDate(v){
  if (!v) return null;
  if (typeof v === 'number') return new Date(v);
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

/* ========= init protegido (no bloqueante) ========= */
ready(() => {
  ensureNavCSS();
  bindSidebarOnce();
  bindLogoutOnce();
  if (window.lucide) { try { window.lucide.createIcons(); } catch{} }

  // No bloqueamos el shell: si no es admin, role-guard redirige internamente
  gateAdminPage()
    .then(initProtected)
    .catch(()=>{/* role-guard se encarga de redirigir */});
});

async function initProtected(){
  // “Última actualización”
  const fmt = new Intl.DateTimeFormat('es-CR', {
    hour:'2-digit', minute:'2-digit', second:'2-digit', timeZone: crTZ
  });
  const last = document.getElementById('lastUpdate');
  if (last) last.textContent = `Actualizado: ${fmt.format(new Date())}`;

  try {
    await buildMetrics();
  } catch (e) {
    console.error(e);
    showAlert('No se pudieron cargar las métricas', 'error');
  }
}

/* ========= Core: métricas ========= */
async function buildMetrics(){
  const usersSnap = await getDocs(collection(db,'users'));
  const users = usersSnap.docs.map(d => ({ id:d.id, ...d.data() }));

  const total = users.length;
  const today = new Date(todayISO());

  let activos = 0, inactivos = 0;
  let nAdmins=0, nProfes=0, nStudents=0;

  let sumMonths=0, contMonths=0;
  const year = new Date().getFullYear();
  const altasMes = Array(12).fill(0);

  const genderCount = { male:0, female:0, other:0, unknown:0 };
  const ageBuckets = { '≤12':0, '13–17':0, '18–24':0, '25–34':0, '35–44':0, '45–54':0, '55–64':0, '65+':0 };
  let ageKnown = 0;

  users.forEach(u=>{
    const exp = parseMaybeDate(u.expiryDate || u.expira || u.expire || null);
    if (exp){ (exp >= today) ? activos++ : inactivos++; } else { inactivos++; }

    const roles = Array.isArray(u.roles) ? u.roles : [];
    if (roles.includes('admin')) nAdmins++;
    if (roles.includes('professor')) nProfes++;
    if (roles.includes('student') || (!roles.includes('admin') && !roles.includes('professor'))) nStudents++;

    const created = parseMaybeDate(u.createdAt);
    if (created){
      sumMonths += monthsBetween(created, today);
      contMonths++;
      if (created.getFullYear() === year) altasMes[created.getMonth()]++;
    }

    const g = (u.genero || u.gender || '').toString().trim().toLowerCase();
    if (['m','male','masculino'].includes(g)) genderCount.male++;
    else if (['f','female','femenino'].includes(g)) genderCount.female++;
    else if (g) genderCount.other++; else genderCount.unknown++;

    const dob = parseMaybeDate(u.birthDate || u.dob || u.fechaNacimiento || u.nacimiento);
    if (dob){
      const age = Math.floor((today - dob) / (365.25*24*60*60*1000));
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

  qs('#kpiTotal')?.replaceChildren(document.createTextNode(total));
  qs('#kpiActivos')?.replaceChildren(document.createTextNode(activos));
  qs('#kpiInactivos')?.replaceChildren(document.createTextNode(inactivos));
  qs('#kpiAdmins')?.replaceChildren(document.createTextNode(nAdmins));
  qs('#kpiProfes')?.replaceChildren(document.createTextNode(nProfes));
  qs('#kpiStudents')?.replaceChildren(document.createTextNode(nStudents));

  const ms30 = 30*24*60*60*1000;
  const now = Date.now();
  const nuevos30 = users.reduce((acc,u)=>{
    const c = parseMaybeDate(u.createdAt);
    return acc + (c && (now - c.getTime()) <= ms30 ? 1 : 0);
  }, 0);
  qs('#kpiNuevos')?.replaceChildren(document.createTextNode(nuevos30));

  const promMeses = contMonths ? (sumMonths/contMonths) : 0;
  qs('#kpiPermanencia')?.replaceChildren(document.createTextNode(promMeses.toFixed(1)));

  qs('#yearBadge')?.replaceChildren(document.createTextNode(year.toString()));
  drawSignupChart(altasMes);
  drawGenderChart(genderCount);
  drawAgeChart(ageBuckets, ageKnown);
}

/* ========= Charts (con destrucción segura) ========= */
const _charts = {};  // id -> instancia

function destroyChart(id){
  try { _charts[id]?.destroy?.(); } catch {}
  _charts[id] = null;
}

function drawSignupChart(series){
  const canvas = document.getElementById('signupChart');
  if (!canvas || typeof Chart === 'undefined') return;
  destroyChart('signup');
  _charts.signup = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: { labels: monthsES, datasets: [{ label: 'Altas', data: series, borderWidth: 2, tension: .25 }] },
    options: {
      responsive: true,
      plugins: { legend: { display:false } },
      scales: { y: { beginAtZero:true, ticks:{ precision:0 } } }
    }
  });
}

function drawGenderChart(counts){
  const canvas = document.getElementById('genderChart');
  if (!canvas || typeof Chart === 'undefined') return;
  destroyChart('gender');
  const note = qs('#genderNote'); if (note) note.textContent = counts.unknown ? `Sin dato: ${counts.unknown}` : '';
  _charts.gender = new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: { labels: ['Masculino','Femenino','Otro'], datasets: [{ data: [counts.male, counts.female, counts.other] }] },
    options: { cutout: '65%', plugins: { legend: { position:'bottom' } } }
  });
}

function drawAgeChart(buckets, known){
  const canvas = document.getElementById('ageChart');
  if (!canvas || typeof Chart === 'undefined') return;
  destroyChart('age');
  const labels = Object.keys(buckets);
  const data = labels.map(k => buckets[k]);
  const note = qs('#ageNote'); if (note) note.textContent = known ? '' : 'Aún no hay fechas de nacimiento registradas.';
  _charts.age = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: { labels, datasets:[{ label:'Usuarios', data, borderWidth:1 }]},
    options: { plugins: { legend: { display:false } }, scales: { y: { beginAtZero:true, ticks:{ precision:0 } } } }
  });
}

/* ========= utils ========= */
function qs(sel){ return document.querySelector(sel); }
