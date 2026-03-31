const express = require('express');
const router = express.Router();
const { getDb } = require('../db/schema');

// Listar todos los beneficiarios
router.get('/', (req, res) => {
  const db = getDb();
  const filtro = req.query.filtro || '';
  const estado = req.query.estado || '';

  let query = `
    SELECT b.*,
      (SELECT COUNT(*) FROM verificaciones v WHERE v.beneficiario_id = b.id AND v.estado = 'verificado') as verificados,
      (SELECT COUNT(*) FROM verificaciones v WHERE v.beneficiario_id = b.id AND v.estado != 'no_aplica') as total_verificaciones
    FROM beneficiarios b
  `;
  const params = [];

  if (filtro) {
    query += ` WHERE b.numero_documento LIKE ? OR b.primer_nombre LIKE ? OR b.primer_apellido LIKE ?`;
    params.push(`%${filtro}%`, `%${filtro}%`, `%${filtro}%`);
  }

  query += ` ORDER BY b.created_at DESC`;

  const beneficiarios = db.prepare(query).all(...params);
  db.close();

  res.render('beneficiarios/index', { beneficiarios, filtro, estado });
});

// Formulario nuevo beneficiario
router.get('/nuevo', (req, res) => {
  res.render('beneficiarios/form', { beneficiario: null, error: null });
});

// Crear beneficiario
router.post('/nuevo', (req, res) => {
  const db = getDb();
  const { tipo_documento, numero_documento, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, fecha_nacimiento, departamento, municipio } = req.body;

  try {
    const stmt = db.prepare(`
      INSERT INTO beneficiarios (tipo_documento, numero_documento, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, fecha_nacimiento, departamento, municipio)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(tipo_documento, numero_documento, primer_nombre.toUpperCase(), (segundo_nombre || '').toUpperCase(), primer_apellido.toUpperCase(), (segundo_apellido || '').toUpperCase(), fecha_nacimiento, departamento, municipio);

    // Crear verificaciones iniciales según tipo de documento
    const fuentes = obtenerFuentesVerificacion(tipo_documento);
    const stmtVerif = db.prepare(`
      INSERT INTO verificaciones (beneficiario_id, fuente, estado)
      VALUES (?, ?, ?)
    `);

    for (const fuente of ['registraduria', 'sisben', 'adres']) {
      const estadoInicial = fuentes.includes(fuente) ? 'pendiente' : 'no_aplica';
      stmtVerif.run(result.lastInsertRowid, fuente, estadoInicial);
    }

    // Registrar en historial
    db.prepare(`INSERT INTO historial (beneficiario_id, accion, detalle) VALUES (?, ?, ?)`)
      .run(result.lastInsertRowid, 'creacion', `Beneficiario registrado con ${tipo_documento}: ${numero_documento}`);

    db.close();
    res.redirect(`/beneficiarios/${result.lastInsertRowid}/verificar`);
  } catch (err) {
    db.close();
    if (err.message.includes('UNIQUE constraint')) {
      res.render('beneficiarios/form', { beneficiario: req.body, error: 'Ya existe un beneficiario con ese numero de documento.' });
    } else {
      res.render('beneficiarios/form', { beneficiario: req.body, error: err.message });
    }
  }
});

// Ver detalle y verificar beneficiario
router.get('/:id/verificar', (req, res) => {
  const db = getDb();
  const beneficiario = db.prepare('SELECT * FROM beneficiarios WHERE id = ?').get(req.params.id);

  if (!beneficiario) {
    db.close();
    return res.redirect('/beneficiarios');
  }

  const verificaciones = db.prepare('SELECT * FROM verificaciones WHERE beneficiario_id = ? ORDER BY fuente').all(req.params.id);
  const historial = db.prepare('SELECT * FROM historial WHERE beneficiario_id = ? ORDER BY fecha DESC LIMIT 20').all(req.params.id);

  db.close();

  const urls = obtenerUrlsVerificacion(beneficiario.tipo_documento);
  res.render('beneficiarios/verificar', { beneficiario, verificaciones, historial, urls });
});

// Actualizar estado de verificación
router.post('/:id/verificar/:fuente', (req, res) => {
  const db = getDb();
  const { estado, observaciones, datos_respuesta, verificado_por } = req.body;
  const { id, fuente } = req.params;

  db.prepare(`
    UPDATE verificaciones SET estado = ?, observaciones = ?, datos_respuesta = ?, verificado_por = ?, fecha_verificacion = datetime('now')
    WHERE beneficiario_id = ? AND fuente = ?
  `).run(estado, observaciones, datos_respuesta || '', verificado_por || '', id, fuente);

  db.prepare(`INSERT INTO historial (beneficiario_id, accion, detalle, usuario) VALUES (?, ?, ?, ?)`)
    .run(id, 'verificacion', `${fuente}: ${estado} - ${observaciones || ''}`, verificado_por || '');

  db.close();
  res.redirect(`/beneficiarios/${id}/verificar`);
});

// Editar beneficiario
router.get('/:id/editar', (req, res) => {
  const db = getDb();
  const beneficiario = db.prepare('SELECT * FROM beneficiarios WHERE id = ?').get(req.params.id);
  db.close();

  if (!beneficiario) return res.redirect('/beneficiarios');
  res.render('beneficiarios/form', { beneficiario, error: null });
});

router.post('/:id/editar', (req, res) => {
  const db = getDb();
  const { tipo_documento, numero_documento, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, fecha_nacimiento, departamento, municipio } = req.body;

  try {
    db.prepare(`
      UPDATE beneficiarios SET tipo_documento=?, numero_documento=?, primer_nombre=?, segundo_nombre=?, primer_apellido=?, segundo_apellido=?, fecha_nacimiento=?, departamento=?, municipio=?, updated_at=datetime('now')
      WHERE id = ?
    `).run(tipo_documento, numero_documento, primer_nombre.toUpperCase(), (segundo_nombre || '').toUpperCase(), primer_apellido.toUpperCase(), (segundo_apellido || '').toUpperCase(), fecha_nacimiento, departamento, municipio, req.params.id);

    // Recalcular verificaciones si cambió el tipo de documento
    const fuentes = obtenerFuentesVerificacion(tipo_documento);
    for (const fuente of ['registraduria', 'sisben', 'adres']) {
      const existing = db.prepare('SELECT * FROM verificaciones WHERE beneficiario_id = ? AND fuente = ?').get(req.params.id, fuente);
      if (!fuentes.includes(fuente) && existing && existing.estado !== 'no_aplica') {
        db.prepare('UPDATE verificaciones SET estado = ? WHERE beneficiario_id = ? AND fuente = ?').run('no_aplica', req.params.id, fuente);
      } else if (fuentes.includes(fuente) && existing && existing.estado === 'no_aplica') {
        db.prepare('UPDATE verificaciones SET estado = ? WHERE beneficiario_id = ? AND fuente = ?').run('pendiente', req.params.id, fuente);
      }
    }

    db.close();
    res.redirect(`/beneficiarios/${req.params.id}/verificar`);
  } catch (err) {
    db.close();
    res.render('beneficiarios/form', { beneficiario: { ...req.body, id: req.params.id }, error: err.message });
  }
});

// Eliminar beneficiario
router.post('/:id/eliminar', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM beneficiarios WHERE id = ?').run(req.params.id);
  db.close();
  res.redirect('/beneficiarios');
});

// --- Funciones de lógica ---

function obtenerFuentesVerificacion(tipoDocumento) {
  // PPT: NO consultar Registraduría (solo SISBEN + ADRES)
  // RC, TI, CC, CE, PA: consultar las 3
  if (tipoDocumento === 'PPT') {
    return ['sisben', 'adres'];
  }
  return ['registraduria', 'sisben', 'adres'];
}

function obtenerUrlsVerificacion(tipoDocumento) {
  const urls = {
    sisben: 'https://portal.sisben.gov.co/Paginas/consulta-tu-grupo.html',
    adres: 'https://www.adres.gov.co/consulte-su-eps'
  };

  if (tipoDocumento !== 'PPT') {
    urls.registraduria = 'https://consultasrc.registraduria.gov.co/ProyectoSCCRC/faces/index.xhtml';
  }

  return urls;
}

module.exports = router;
