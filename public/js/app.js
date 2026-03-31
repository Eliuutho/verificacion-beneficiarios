document.addEventListener('DOMContentLoaded', () => {
  // Mostrar/ocultar aviso de PPT en formulario
  const tipoDocSelect = document.getElementById('tipoDocSelect');
  const pptNotice = document.getElementById('pptNotice');

  if (tipoDocSelect && pptNotice) {
    function togglePptNotice() {
      pptNotice.style.display = tipoDocSelect.value === 'PPT' ? 'block' : 'none';
    }
    tipoDocSelect.addEventListener('change', togglePptNotice);
    togglePptNotice();
  }
});
