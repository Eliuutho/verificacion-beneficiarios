const express = require('express');
const router = express.Router();
const { consultarRegistraduria, consultarAdres } = require('../services/apitude');
const { generarConsultaManual } = require('../services/sisben');
const { getDb } = require('../db/schema');

// Consulta automática Registraduría via Apitude
router.post('/consultar/registraduria', async (req, res) => {
  const { beneficiario_id } = req.body;
  const db = getDb();
  const beneficiario = db.prepare('SELECT * FROM beneficiarios WHERE id = ?').get(beneficiario_id);

  if (!beneficiario) {
    db.close();
    return res.json({ success: false, error: 'Beneficiario no encontrado' });
  }

  if (beneficiario.tipo_documento === 'PPT') {
    db.close();
    return res.json({ success: false, error: 'PPT no aplica para consulta en Registraduría' });
  }

  const resultado = await consultarRegistraduria(beneficiario.numero_documento);

  // Guardar resultado en verificaciones
  const estado = resultado.success ? 'verificado' : 'no_encontrado';
  const datosStr = resultado.success ? JSON.stringify(resultado.data) : '';
  const obs = resultado.success
    ? `Nombre: ${resultado.data.name || ''}, Estado: ${resultado.data.status || ''}, Area: ${resultado.data.area || ''}, Ciudad: ${resultado.data.city || ''}`
    : resultado.error;

  db.prepare(`
    UPDATE verificaciones SET estado = ?, datos_respuesta = ?, observaciones = ?, verificado_por = ?, fecha_verificacion = datetime('now')
    WHERE beneficiario_id = ? AND fuente = 'registraduria'
  `).run(estado, datosStr, obs, 'API-Apitude', beneficiario_id);

  db.prepare(`INSERT INTO historial (beneficiario_id, accion, detalle, usuario) VALUES (?, ?, ?, ?)`)
    .run(beneficiario_id, 'consulta_api', `Registraduría: ${estado} - ${obs}`, 'API-Apitude');

  db.close();
  res.json({ success: resultado.success, estado, data: resultado.data || null, error: resultado.error || null });
});

// Consulta automática ADRES via Apitude
router.post('/consultar/adres', async (req, res) => {
  const { beneficiario_id } = req.body;
  const db = getDb();
  const beneficiario = db.prepare('SELECT * FROM beneficiarios WHERE id = ?').get(beneficiario_id);

  if (!beneficiario) {
    db.close();
    return res.json({ success: false, error: 'Beneficiario no encontrado' });
  }

  const resultado = await consultarAdres(beneficiario.tipo_documento, beneficiario.numero_documento);

  const estado = resultado.success ? 'verificado' : 'no_encontrado';
  const datosStr = resultado.success ? JSON.stringify(resultado.data) : '';

  let obs = '';
  if (resultado.success && resultado.data) {
    const d = resultado.data;
    obs = `Nombres: ${d.nombres || ''} ${d.apellidos || ''}, EPS: ${d.estado_afiliacion?.entidad || ''}, Régimen: ${d.estado_afiliacion?.regimen || ''}, Estado: ${d.estado_afiliacion?.estado || ''}`;
  } else {
    obs = resultado.error;
  }

  db.prepare(`
    UPDATE verificaciones SET estado = ?, datos_respuesta = ?, observaciones = ?, verificado_por = ?, fecha_verificacion = datetime('now')
    WHERE beneficiario_id = ? AND fuente = 'adres'
  `).run(estado, datosStr, obs, 'API-Apitude', beneficiario_id);

  db.prepare(`INSERT INTO historial (beneficiario_id, accion, detalle, usuario) VALUES (?, ?, ?, ?)`)
    .run(beneficiario_id, 'consulta_api', `ADRES: ${estado} - ${obs}`, 'API-Apitude');

  db.close();
  res.json({ success: resultado.success, estado, data: resultado.data || null, error: resultado.error || null });
});

// Info para consulta manual SISBEN
router.get('/consultar/sisben/:beneficiario_id', (req, res) => {
  const db = getDb();
  const beneficiario = db.prepare('SELECT * FROM beneficiarios WHERE id = ?').get(req.params.beneficiario_id);
  db.close();

  if (!beneficiario) {
    return res.json({ success: false, error: 'Beneficiario no encontrado' });
  }

  const info = generarConsultaManual(beneficiario.tipo_documento, beneficiario.numero_documento);
  res.json({ success: true, data: info });
});

// Estado de configuración API
router.get('/config/status', (req, res) => {
  res.json({
    apitude: {
      configured: !!process.env.APITUDE_API_KEY,
      services: ['registraduria-co', 'adres-co']
    },
    sisben: {
      configured: false,
      mode: 'manual',
      reason: 'Protegido por reCAPTCHA v3 - Solo consulta manual'
    }
  });
});

module.exports = router;
