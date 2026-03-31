const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'verificacion.db');

function initDatabase() {
  const db = new Database(DB_PATH);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS beneficiarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo_documento TEXT NOT NULL CHECK(tipo_documento IN ('RC', 'TI', 'CC', 'PPT', 'CE', 'PA')),
      numero_documento TEXT NOT NULL UNIQUE,
      primer_nombre TEXT NOT NULL,
      segundo_nombre TEXT,
      primer_apellido TEXT NOT NULL,
      segundo_apellido TEXT,
      fecha_nacimiento TEXT,
      departamento TEXT,
      municipio TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS verificaciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      beneficiario_id INTEGER NOT NULL,
      fuente TEXT NOT NULL CHECK(fuente IN ('registraduria', 'sisben', 'adres')),
      estado TEXT NOT NULL CHECK(estado IN ('pendiente', 'verificado', 'no_encontrado', 'inconsistente', 'no_aplica')),
      datos_respuesta TEXT,
      observaciones TEXT,
      verificado_por TEXT,
      fecha_verificacion TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (beneficiario_id) REFERENCES beneficiarios(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS historial (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      beneficiario_id INTEGER NOT NULL,
      accion TEXT NOT NULL,
      detalle TEXT,
      usuario TEXT,
      fecha TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (beneficiario_id) REFERENCES beneficiarios(id) ON DELETE CASCADE
    );
  `);

  return db;
}

function getDb() {
  return new Database(DB_PATH);
}

module.exports = { initDatabase, getDb };
