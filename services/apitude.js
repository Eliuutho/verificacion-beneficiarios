/**
 * Servicio de integración con Apitude API
 * Documentación: https://apitude.co/es/docs/services/
 *
 * Provee acceso a:
 * - Registraduría Nacional (registraduria-co): Validación de cédula/RC
 * - ADRES/FOSYGA (adres-co): Consulta de afiliación EPS/BDUA
 */

const API_BASE = 'https://apitude.co/api/v1.0/requests';
const API_KEY = process.env.APITUDE_API_KEY || '';

const DOCUMENT_TYPE_MAP = {
  'RC': 'registro-civil',
  'TI': 'tarjeta-identidad',
  'CC': 'cedula',
  'CE': 'cedula-extranjeria',
  'PA': 'pasaporte',
  'PPT': 'ppt'
};

async function makeRequest(service, body) {
  if (!API_KEY) {
    return { success: false, error: 'API_KEY de Apitude no configurada. Configura APITUDE_API_KEY en .env' };
  }

  try {
    // Paso 1: Crear solicitud (POST)
    const createRes = await fetch(`${API_BASE}/${service}/`, {
      method: 'POST',
      headers: {
        'x-api-key': API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      return { success: false, error: `Error al crear solicitud: ${createRes.status} - ${errText}` };
    }

    const createData = await createRes.json();
    const requestId = createData.request_id;

    if (!requestId) {
      return { success: false, error: 'No se recibió request_id de Apitude' };
    }

    // Paso 2: Polling del resultado (GET) - max 30 segundos
    const maxAttempts = 15;
    for (let i = 0; i < maxAttempts; i++) {
      await sleep(2000);

      const pollRes = await fetch(`${API_BASE}/${service}/${requestId}/`, {
        method: 'GET',
        headers: { 'x-api-key': API_KEY }
      });

      if (!pollRes.ok) continue;

      const pollData = await pollRes.json();

      if (pollData.result && pollData.result.status !== undefined) {
        if (pollData.result.status === 200) {
          return { success: true, data: pollData.result.data, raw: pollData };
        } else if (pollData.result.status === 404) {
          return { success: false, error: 'No se encontraron resultados para este documento', code: 404 };
        } else if (pollData.result.status === 400) {
          return { success: false, error: 'Datos de entrada inválidos', code: 400 };
        } else {
          return { success: false, error: `Servicio respondió con estado: ${pollData.result.status}`, code: pollData.result.status };
        }
      }
    }

    return { success: false, error: 'Tiempo de espera agotado. Intenta nuevamente.' };
  } catch (err) {
    return { success: false, error: `Error de conexión: ${err.message}` };
  }
}

/**
 * Consulta Registraduría - Validación de documento
 * Solo aplica para RC, TI, CC (documentos colombianos)
 */
async function consultarRegistraduria(numeroDocumento, fechaExpedicion) {
  return makeRequest('registraduria-co', {
    document_number: numeroDocumento,
    date_expedition: fechaExpedicion || ''
  });
}

/**
 * Consulta ADRES - Afiliación EPS / BDUA
 * Aplica para todos los tipos de documento
 */
async function consultarAdres(tipoDocumento, numeroDocumento) {
  const docType = DOCUMENT_TYPE_MAP[tipoDocumento] || 'cedula';
  return makeRequest('adres-co', {
    document_type: docType,
    document_number: numeroDocumento
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { consultarRegistraduria, consultarAdres, DOCUMENT_TYPE_MAP };
