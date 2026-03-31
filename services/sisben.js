/**
 * Servicio de consulta SISBEN
 *
 * El portal del SISBEN (reportes.sisben.gov.co) está protegido por
 * Google reCAPTCHA v3 (key: 6Lfh6kwcAAAAANT-kyprjG-m2yGmDmfOCvXinRE6).
 *
 * NO es posible automatizar la consulta directamente sin resolver el captcha.
 * Este servicio provee:
 * 1. La URL para consulta manual asistida
 * 2. Estructura para parsear resultados si en el futuro se obtiene acceso API
 */

const SISBEN_URL = 'https://reportes.sisben.gov.co/dnp_sisbenconsulta';
const SISBEN_PORTAL_URL = 'https://portal.sisben.gov.co/Paginas/consulta-tu-grupo.html';

const TIPO_DOC_SISBEN = {
  'RC': '1',   // Registro Civil
  'TI': '2',   // Tarjeta de Identidad
  'CC': '3',   // Cédula de Ciudadanía
  'CE': '4',   // Cédula de Extranjería
  'PA': '5',   // Pasaporte
  'PPT': '12'  // PPT (Permiso por Protección Temporal)
};

/**
 * Genera la info necesaria para que el operador consulte manualmente
 */
function generarConsultaManual(tipoDocumento, numeroDocumento) {
  return {
    url: SISBEN_PORTAL_URL,
    urlDirecta: SISBEN_URL,
    tipoDocCodigo: TIPO_DOC_SISBEN[tipoDocumento] || '3',
    tipoDocNombre: tipoDocumento,
    numeroDocumento,
    instrucciones: [
      'Abrir el enlace de consulta SISBEN',
      `Seleccionar tipo de documento: ${tipoDocumento}`,
      `Ingresar número: ${numeroDocumento}`,
      'Resolver el captcha si aparece',
      'Anotar: Grupo (A/B/C/D), subgrupo y puntaje',
      'Registrar el resultado en el sistema'
    ],
    proteccion: 'reCAPTCHA v3 - Requiere consulta manual'
  };
}

/**
 * Parsea los datos que el operador ingresa manualmente del SISBEN
 */
function parsearResultadoSisben(datosTexto) {
  const resultado = {
    grupo: null,
    subgrupo: null,
    puntaje: null,
    departamento: null,
    municipio: null
  };

  if (!datosTexto) return resultado;

  // Intentar extraer grupo (A1, B3, C2, D1, etc.)
  const grupoMatch = datosTexto.match(/[Gg]rupo[:\s]*([A-D]\d?)/i);
  if (grupoMatch) {
    resultado.grupo = grupoMatch[1].charAt(0);
    resultado.subgrupo = grupoMatch[1];
  }

  // Intentar extraer puntaje
  const puntajeMatch = datosTexto.match(/[Pp]untaje[:\s]*([\d.,]+)/i);
  if (puntajeMatch) {
    resultado.puntaje = parseFloat(puntajeMatch[1].replace(',', '.'));
  }

  return resultado;
}

module.exports = { generarConsultaManual, parsearResultadoSisben, SISBEN_URL, SISBEN_PORTAL_URL, TIPO_DOC_SISBEN };
