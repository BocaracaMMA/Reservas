// ./js/profile.js — Perfil estilo “card”, skeleton y avatar por género
import { auth, db } from './firebase-config.js';
import { signOut, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showAlert } from './showAlert.js';

/* Sidebar básico */
function ensureSidebar(){
  if (!document.getElementById('sidebarBackdrop')){
    const b = document.createElement('div'); b.id='sidebarBackdrop'; b.className='sidebar-backdrop'; document.body.appendChild(b);
  }
}
function toggleSidebar(force){
  const sb=document.getElementById('sidebar'), btn=document.getElementById('toggleNav'), bd=document.getElementById('sidebarBackdrop');
  if(!sb||!btn) return;
  const open = (typeof force==='boolean')?force:!sb.classList.contains('active');
  if(open){ sb.classList.add('active'); btn.setAttribute('aria-expanded','true'); document.body.style.overflow='hidden'; bd?.classList.add('active'); }
  else{ sb.classList.remove('active'); btn.setAttribute('aria-expanded','false'); document.body.style.overflow=''; bd?.classList.remove('active'); }
}
(function bindSidebar(){
  ensureSidebar();
  const btn=document.getElementById('toggleNav'), sb=document.getElementById('sidebar'), bd=document.getElementById('sidebarBackdrop');
  if(!btn||!sb||btn.dataset.bound) return;
  const h=(e)=>{ e.preventDefault(); toggleSidebar(); };
  btn.addEventListener('click',h); btn.addEventListener('touchstart',h,{passive:false});
  window.addEventListener('keydown',(e)=>{ if(e.key==='Escape') toggleSidebar(false); });
  bd?.addEventListener('click',()=>toggleSidebar(false));
  sb.addEventListener('click',(e)=>{ if(e.target.closest('a[href]')) toggleSidebar(false); });
  btn.dataset.bound='1';
})();
document.getElementById('logoutSidebar')?.addEventListener('click', async (e)=>{
  e.preventDefault();
  try{ await signOut(auth); showAlert('Sesión cerrada','success'); }catch{ showAlert('Error al cerrar sesión','error'); }
  finally{ setTimeout(()=>location.href='index.html',800); }
});

/* Utilidades */
function crNow(){ return new Date(new Date().toLocaleString('en-US',{ timeZone:'America/Costa_Rica'})); }
function daysUntil(dateStr){
  if(!dateStr) return -9999;
  const [y,m,d]=dateStr.split('-').map(Number);
  const t=new Date(y,m-1,d);
  return Math.floor((t - crNow())/(1000*60*60*24));
}
function computeState(u){
  if(!u?.autorizado) return {label:'Vencida', cls:'error'};
  const left=daysUntil(u?.expiryDate);
  if(left<0) return {label:'Vencida', cls:'error'};
  if(left<=5) return {label:'Por Vencer', cls:'warn'};
  return {label:'Activa', cls:'success'};
}
function fmtDate(s){
  if(!s) return '—';
  try{ const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d).toLocaleDateString('es-CR',{year:'numeric',month:'long',day:'2-digit'});}catch{return s;}
}

/* Avatar por género (Bootstrap Icons) */
const GENDER_ICON = {
  masculino: 'bi-gender-male',
  femenino: 'bi-gender-female',
  no_binario: 'bi-gender-ambiguous',
  prefiero_no_decir: 'bi-person',
  otro: 'bi-person-bounding-box',
  no_especificado: 'bi-person'
};
function paintAvatar(gen){
  const wrap = document.getElementById('pfAvatar');
  if(!wrap) return;
  const i = wrap.querySelector('i');
  i.className = `bi ${GENDER_ICON[gen] || 'bi-person'}`;
}

/* Refs UI */
const sk  = document.getElementById('pfSkeleton');
const card= document.getElementById('pfCard');

const pfDisplay = document.getElementById('pfDisplay');
const pfEmail   = document.getElementById('pfEmail');
const pfPlan    = document.getElementById('pfPlan');
const pfStatus  = document.getElementById('pfStatus');

const pfMembresia = document.getElementById('pfMembresia');
const pfEstado    = document.getElementById('pfEstado');
const pfExpira    = document.getElementById('pfExpira');

const pfNombre  = document.getElementById('pfNombre');
const pfAp      = document.getElementById('pfApellidos');
const pfCorreo  = document.getElementById('pfCorreo');
const pfCedula  = document.getElementById('pfCedula');
const pfGenero  = document.getElementById('pfGenero');
const pfNac     = document.getElementById('pfNacimiento');

const btnEdit   = document.getElementById('pfEdit');
const form      = document.getElementById('editForm');
const efNombre  = document.getElementById('efNombre');
const efAp      = document.getElementById('efApellidos');
const efGenero  = document.getElementById('efGenero');
const efNac     = document.getElementById('efNacimiento');
const efCancel  = document.getElementById('efCancel');

let UID = null, ORIGINAL = {};

function startLoading(){ card?.classList.add('hidden'); sk?.classList.remove('hidden'); }
function stopLoading(){ sk?.classList.add('hidden'); if(card){ card.classList.remove('hidden'); card.classList.add('reveal'); setTimeout(()=>card.classList.remove('reveal'),400);} }

/* Carga */
onAuthStateChanged(auth, async user=>{
  if(!user){ location.href='./index.html'; return; }
  UID = user.uid;
  try{
    startLoading();
    const snap = await getDoc(doc(db,'users',UID));
    const u = snap.exists() ? snap.data() : {};

    const nombre = u.nombre || '—';
    const ap     = u.apellidos || '—';
    const correo = u.correo || user.email || '—';
    const plan   = u.membresia || u.membershipType || 'General';
    const expiry = u.expiryDate || '—';
    const state  = computeState(u);

    pfDisplay.textContent = `${nombre} ${ap}`.trim();
    pfEmail.textContent   = correo;
    pfPlan.textContent    = plan;  pfPlan.className = 'tag info';
    pfStatus.textContent  = state.label; pfStatus.className = `tag ${state.cls}`;

    pfMembresia.textContent = plan;
    pfEstado.textContent    = state.label;
    pfExpira.textContent    = fmtDate(expiry);

    pfNombre.textContent = nombre;
    pfAp.textContent     = ap;
    pfCorreo.textContent = correo;
    pfCedula.textContent = u.cedula || u.cedulaExtranjera || '—';
    pfGenero.textContent = (u.genero || u.gender)
      ? ({masculino:'Masculino', femenino:'Femenino', no_binario:'No binario', prefiero_no_decir:'Prefiero no decir', otro:'Otro', no_especificado:'Prefiero no decir'}[(u.genero||u.gender)] || '—')
      : '—';
    pfNac.textContent = u.birthDate ? fmtDate(u.birthDate) : '—';

    // Avatar por género
    paintAvatar(u.genero || u.gender || 'no_especificado');

    // Prefill edición
    efNombre.value = nombre === '—' ? '' : nombre;
    efAp.value     = ap === '—' ? '' : ap;
    efGenero.value = (u.genero || u.gender || '');
    efNac.value    = u.birthDate || '';

    ORIGINAL = { nombre: efNombre.value, apellidos: efAp.value, genero: efGenero.value, birthDate: efNac.value };
  }catch(e){
    console.error(e); showAlert('No se pudo cargar el perfil','error');
  }finally{ stopLoading(); }
});

/* Edición */
btnEdit?.addEventListener('click', ()=>{ if(!form) return; form.hidden = !form.hidden; if(!form.hidden) efNombre?.focus(); });
efCancel?.addEventListener('click', ()=>{ if(form) form.hidden = true; });

form?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  if(!UID) return;

  const vNombre = efNombre.value.trim();
  const vAp     = efAp.value.trim();
  const vGenero = efGenero.value;
  const vNac    = efNac.value;

  const payload = {};
  const put=(k,v)=>{ if(v!==ORIGINAL[k]) payload[k]=v; };
  put('nombre', vNombre);
  put('apellidos', vAp);
  if (vGenero !== ORIGINAL.genero) payload.genero = vGenero;
  put('birthDate', vNac);

  if(!Object.keys(payload).length){ showAlert('No hay cambios por guardar.','success'); form.hidden=true; return; }

  try{
    await setDoc(doc(db,'users',UID), payload, { merge:true });

    // actualizar auth displayName si cambió
    if ((payload.nombre || payload.apellidos) && auth.currentUser){
      const n = payload.nombre ?? ORIGINAL.nombre ?? '';
      const a = payload.apellidos ?? ORIGINAL.apellidos ?? '';
      try{ await updateProfile(auth.currentUser, { displayName:`${n} ${a}`.trim() }); }catch{}
    }

    // reflejar en UI
    if('nombre' in payload){ pfNombre.textContent = payload.nombre || '—'; }
    if('apellidos' in payload){ pfAp.textContent = payload.apellidos || '—'; }
    if('genero' in payload){
      pfGenero.textContent = payload.genero
        ? ({masculino:'Masculino', femenino:'Femenino', no_binario:'No binario', prefiero_no_decir:'Prefiero no decir', otro:'Otro', no_especificado:'Prefiero no decir'}[payload.genero] || '—')
        : '—';
      paintAvatar(payload.genero || 'no_especificado');
    }
    if('birthDate' in payload){ pfNac.textContent = payload.birthDate ? fmtDate(payload.birthDate) : '—'; }

    pfDisplay.textContent = `${pfNombre.textContent} ${pfAp.textContent}`.trim();
    ORIGINAL = { ...ORIGINAL, ...payload };
    showAlert('Perfil actualizado','success');
    form.hidden = true;
  }catch(err){
    console.error(err);
    showAlert(err?.code==='permission-denied' ? 'Permisos insuficientes.' : 'No se pudo actualizar el perfil.','error');
  }
});
