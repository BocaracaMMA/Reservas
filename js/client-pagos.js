// ./js/client-pagos.js
import { auth, db, storage } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp, collection, addDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";
import { showAlert } from './showAlert.js';

/* ======= Sidebar mínimo ======= */
(function sidebar(){
  const btn = document.getElementById('toggleNav');
  const sb  = document.getElementById('sidebar');
  if (!btn || !sb) return;

  const back = document.createElement('div');
  back.id = 'sidebarBackdrop'; back.className = 'sidebar-backdrop';
  document.body.appendChild(back);

  const toggle = (open)=> {
    const will = typeof open==='boolean' ? open : !sb.classList.contains('active');
    sb.classList.toggle('active', will);
    back.classList.toggle('active', will);
    document.body.style.overflow = will ? 'hidden' : '';
  };
  btn.addEventListener('click', ()=> toggle());
  back.addEventListener('click', ()=> toggle(false));
  sb.addEventListener('click', e=>{ if (e.target.closest('a[href]')) toggle(false); });

  document.getElementById('logoutSidebar')?.addEventListener('click', async (e)=>{
    e.preventDefault();
    try{ await signOut(auth); } finally { location.href = 'index.html'; }
  });
})();

/* ======= Refs UI ======= */
const sessionEmail = document.getElementById('sessionEmail');
const form     = document.getElementById('payForm');
const nameEl   = document.getElementById('pfName');
const idEl     = document.getElementById('pfCedula');
const mtdEl    = document.getElementById('payMethod');
const amtEl    = document.getElementById('payAmount');
const monEl    = document.getElementById('payMonth');
const codeEl   = document.getElementById('payCode');
const fileIn   = document.getElementById('payFile');
const fileName = document.getElementById('fileName');
const drop     = document.getElementById('drop');
const sendBtn  = document.getElementById('sendBtn');
const payStatus= document.getElementById('payStatus');

const prevWrap = document.getElementById('previewWrap');
const prevImg  = document.getElementById('previewImg');
let prevURL    = null;

/* ======= Drag & drop + vista previa ======= */
function clearPreview(){
  if (prevURL) { URL.revokeObjectURL(prevURL); prevURL = null; }
  prevImg.src = ''; prevWrap.hidden = true;
}
function showPreview(file){
  clearPreview();
  if (!file) return;
  prevURL = URL.createObjectURL(file);
  prevImg.src = prevURL;
  prevWrap.hidden = false;
}
function updateFileName(){
  const f = fileIn.files?.[0];
  fileName.textContent = f?.name || '';
  showPreview(f || null);
}

drop.addEventListener('click', ()=> fileIn.click());
drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('drag'); });
drop.addEventListener('dragleave', ()=> drop.classList.remove('drag'));
drop.addEventListener('drop', e => {
  e.preventDefault(); drop.classList.remove('drag');
  if (e.dataTransfer.files?.[0]) { fileIn.files = e.dataTransfer.files; updateFileName(); }
});
fileIn.addEventListener('change', updateFileName);

/* ======= Util ======= */
const WA_NUMBER = '50664289694'; // ← número de la academia
const fmtMonth = (ym) => {
  if (!ym) return '—';
  const [y,m] = ym.split('-').map(Number);
  return new Date(y, m-1, 1).toLocaleDateString('es-CR', { month:'long', year:'numeric' });
};

/* ======= Prefill usuario ======= */
onAuthStateChanged(auth, async user=>{
  if (!user){ location.href = 'index.html'; return; }
  sessionEmail.textContent = `Sesión: ${user.email || '—'}`;

  // Mes actual por defecto
  try{
    const now = new Date();
    monEl.value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  }catch{}

  try{
    const docSnap = await getDoc(doc(db,'users', user.uid));
    const u = docSnap.exists() ? docSnap.data() : {};
    if (u.nombre) nameEl.value = u.nombre;
    if (u.cedula) idEl.value   = u.cedula;
  }catch(e){ console.warn('No se pudo precargar perfil', e); }
});

/* ======= Submit ======= */
form.addEventListener('submit', async (e)=>{
  e.preventDefault();

  if (!fileIn.files?.[0]) { showAlert('Adjunta la imagen del comprobante.','error'); return; }
  if (!nameEl.value.trim() || !idEl.value.trim() || !mtdEl.value || !amtEl.value || !monEl.value){
    showAlert('Completa todos los campos obligatorios.','error'); return;
  }

  try{
    sendBtn.disabled = true; payStatus.classList.add('show');

    const user = auth.currentUser;
    const file = fileIn.files[0];

    // Ruta: payments/<uid>/<yyyy>/<mm>/<ts>_<name>
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth()+1).padStart(2,'0');
    const ts = now.getTime();
    const safeName = file.name.replace(/[^\w.\-]/g,'_');
    const path = `payments/${user.uid}/${yyyy}/${mm}/${ts}_${safeName}`;

    // Subir a Storage
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file, { contentType: file.type || 'image/jpeg' });
    const url = await getDownloadURL(storageRef);

    // Registrar en Firestore
    const payDoc = await addDoc(collection(db,'payments'), {
      uid: user.uid,
      nombre: nameEl.value.trim(),
      cedula: idEl.value.trim(),
      metodo: mtdEl.value,
      monto: Number(amtEl.value),
      mesPagado: monEl.value,              // YYYY-MM
      mesPagadoHuman: fmtMonth(monEl.value),
      codigo: codeEl.value.trim() || null,
      filePath: path,
      fileURL: url,
      createdAt: serverTimestamp()
    });

    // Abrir WhatsApp con mensaje
    const texto = [
      `*Nuevo comprobante de pago*`,
      `Nombre: ${nameEl.value.trim()}`,
      `Cédula: ${idEl.value.trim()}`,
      `Método: ${mtdEl.value}`,
      `Monto: ${amtEl.value}`,
      `Mes: ${fmtMonth(monEl.value)}`,
      codeEl.value.trim() ? `Código: ${codeEl.value.trim()}` : null,
      `Archivo: ${url}`,
      `ID registro: ${payDoc.id}`
    ].filter(Boolean).join('\n');

    window.location.href = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(texto)}`;

    showAlert('Comprobante enviado a WhatsApp.','success');
    form.reset(); updateFileName(); // limpia preview
  }catch(err){
    console.error(err);
    showAlert('No se pudo subir/enviar el comprobante.','error');
  }finally{
    payStatus.classList.remove('show');
    sendBtn.disabled = false;
  }
});

window.addEventListener('beforeunload', clearPreview);
