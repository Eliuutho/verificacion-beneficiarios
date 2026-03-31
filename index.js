require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const { initDatabase } = require('./db/schema');

const app = express();
const PORT = process.env.PORT || 3000;

// Inicializar base de datos
initDatabase();

// Configuración
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'default-secret',
  resave: false,
  saveUninitialized: false
}));

// Rutas
app.get('/', (req, res) => {
  const { getDb } = require('./db/schema');
  const db = getDb();

  const total = db.prepare('SELECT COUNT(*) as count FROM beneficiarios').get().count;
  const verificados = db.prepare(`
    SELECT COUNT(DISTINCT b.id) as count FROM beneficiarios b
    WHERE NOT EXISTS (
      SELECT 1 FROM verificaciones v
      WHERE v.beneficiario_id = b.id AND v.estado IN ('pendiente', 'inconsistente')
    )
  `).get().count;
  const pendientes = total - verificados;
  const ppt = db.prepare("SELECT COUNT(*) as count FROM beneficiarios WHERE tipo_documento = 'PPT'").get().count;
  const rc = db.prepare("SELECT COUNT(*) as count FROM beneficiarios WHERE tipo_documento IN ('RC', 'TI', 'CC')").get().count;

  db.close();
  res.render('dashboard', { total, verificados, pendientes, ppt, rc });
});

app.use('/beneficiarios', require('./routes/beneficiarios'));
app.use('/api', require('./routes/api'));

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
