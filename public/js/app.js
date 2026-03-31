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

  // Verificar estado de API al cargar página de verificación
  checkApiStatus();
});

async function checkApiStatus() {
  try {
    const res = await fetch('/api/config/status');
    const data = await res.json();

    const btns = document.querySelectorAll('[id^="btn-api-"]');
    btns.forEach(btn => {
      if (!data.apitude.configured) {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-warning');
        btn.title = 'API key no configurada - Configura APITUDE_API_KEY en .env';
      }
    });
  } catch (e) {
    // No es página de verificación, ignorar
  }
}

async function consultarAPI(fuente, beneficiarioId) {
  const btn = document.getElementById('btn-api-' + fuente);
  const resultDiv = document.getElementById('api-result-' + fuente);

  if (!btn || !resultDiv) return;

  // Estado loading
  const textoOriginal = btn.textContent;
  btn.textContent = 'Consultando...';
  btn.disabled = true;
  resultDiv.style.display = 'block';
  resultDiv.className = 'alert alert-info';
  resultDiv.textContent = 'Conectando con API de Apitude... Esto puede tomar hasta 30 segundos.';

  try {
    const res = await fetch('/api/consultar/' + fuente, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ beneficiario_id: beneficiarioId })
    });

    const data = await res.json();

    if (data.success) {
      resultDiv.className = 'alert alert-success';
      let html = '<strong>Verificado correctamente</strong><br>';

      if (fuente === 'registraduria' && data.data) {
        html += 'Nombre: ' + (data.data.name || '-') + '<br>';
        html += 'Estado: ' + (data.data.status || '-') + '<br>';
        html += 'Area: ' + (data.data.area || '-') + ', Ciudad: ' + (data.data.city || '-');
      } else if (fuente === 'adres' && data.data) {
        html += 'Nombres: ' + (data.data.nombres || '-') + ' ' + (data.data.apellidos || '-') + '<br>';
        if (data.data.estado_afiliacion) {
          html += 'EPS: ' + (data.data.estado_afiliacion.entidad || '-') + '<br>';
          html += 'Regimen: ' + (data.data.estado_afiliacion.regimen || '-') + '<br>';
          html += 'Estado: ' + (data.data.estado_afiliacion.estado || '-');
        }
      }

      resultDiv.innerHTML = html;
      // Recargar para actualizar estado
      setTimeout(() => location.reload(), 2000);
    } else {
      resultDiv.className = 'alert alert-error';
      resultDiv.textContent = 'Error: ' + (data.error || 'Error desconocido');
    }
  } catch (err) {
    resultDiv.className = 'alert alert-error';
    resultDiv.textContent = 'Error de conexion: ' + err.message;
  } finally {
    btn.textContent = textoOriginal;
    btn.disabled = false;
  }
}
