// ./js/modal-utils.js
// Utilidad para mostrar modales Bootstrap 5 de manera programática

let modalEl, modal, els;

function ensure() {
  if (modal) return;
  modalEl = document.getElementById('appModal');
  if (!modalEl) {
    console.warn('[modal-utils] #appModal no encontrado');
    return;
  }
  modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  els = {
    header: modalEl.querySelector('.modal-header'),
    title:  modalEl.querySelector('.modal-title'),
    icon:   modalEl.querySelector('.modal-icon'),
    msg:    modalEl.querySelector('.modal-message'),
    btnOk:  modalEl.querySelector('[data-role="confirm"]'),
    btnNo:  modalEl.querySelector('[data-role="cancel"]'),
  };
}

// variant: 'danger' | 'success' | 'info' | 'warning'
function applyVariant(variant='info') {
  els.header.classList.remove('gradient-danger','gradient-success','gradient-info','gradient-warning');
  els.btnOk.classList.remove('btn-danger','btn-success','btn-primary','btn-warning');

  if (variant === 'danger') {
    els.header.classList.add('gradient-danger');
    els.btnOk.classList.add('btn-danger');
    els.icon.className = 'fas fa-exclamation-triangle modal-icon d-block mb-3 text-danger';
  } else if (variant === 'success') {
    els.header.classList.add('gradient-success');
    els.btnOk.classList.add('btn-success');
    els.icon.className = 'fas fa-check-circle modal-icon d-block mb-3 text-success';
  } else if (variant === 'warning') {
    els.header.classList.add('gradient-warning');
    els.btnOk.classList.add('btn-warning');
    els.icon.className = 'fas fa-triangle-exclamation modal-icon d-block mb-3 text-warning';
  } else {
    els.header.classList.add('gradient-info');
    els.btnOk.classList.add('btn-primary');
    els.icon.className = 'fas fa-circle-info modal-icon d-block mb-3 text-primary';
  }
}

/**
 * Abre un modal de confirmación.
 * @returns Promise<boolean> true si confirman, false si cancelan/cerran
 */
export function confirmDialog({
  title='Confirmar',
  message='¿Desea continuar?',
  confirmText='Confirmar',
  cancelText='Cancelar',
  variant='danger'
} = {}) {
  ensure();
  if (!modal) return Promise.resolve(false);

  applyVariant(variant);
  els.title.textContent = title;
  els.msg.innerHTML = message;
  els.btnOk.innerHTML = `<i class="fas fa-check me-2"></i>${confirmText}`;
  els.btnNo.innerHTML = `<i class="fas fa-times me-2"></i>${cancelText}`;

  return new Promise(resolve => {
    const onOk = () => { cleanup(); resolve(true); };
    const onNo = () => { cleanup(); resolve(false); };
    const onHide = () => { cleanup(); resolve(false); };

    function cleanup(){
      els.btnOk.removeEventListener('click', onOk);
      els.btnNo.removeEventListener('click', onNo);
      modalEl.removeEventListener('hidden.bs.modal', onHide);
    }

    els.btnOk.addEventListener('click', onOk);
    els.btnNo.addEventListener('click', onNo);
    modalEl.addEventListener('hidden.bs.modal', onHide);

    modal.show();
  });
}

/** Modal informativo simple */
export function infoDialog({
  title='Información',
  message='',
  okText='Entendido',
  variant='info'
} = {}) {
  ensure();
  if (!modal) return Promise.resolve();

  applyVariant(variant);
  els.title.textContent = title;
  els.msg.innerHTML = message;
  els.btnOk.innerHTML = `<i class="fas fa-check me-2"></i>${okText}`;
  els.btnNo.classList.add('d-none');

  return new Promise(resolve => {
    const onOk = () => { cleanup(); resolve(); };
    const onHide = () => { cleanup(); resolve(); };

    function cleanup(){
      els.btnOk.removeEventListener('click', onOk);
      modalEl.removeEventListener('hidden.bs.modal', onHide);
      els.btnNo.classList.remove('d-none');
    }
    els.btnOk.addEventListener('click', onOk);
    modalEl.addEventListener('hidden.bs.modal', onHide);

    modal.show();
  });
}
