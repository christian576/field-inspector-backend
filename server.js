const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware básico
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Log de todas las requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Simulación de base de datos en memoria
const users = new Map();
const records = new Map();

// ============= RUTAS DE AUTENTICACIÓN =============

// Registro de usuario
app.post('/auth/register', async (req, res) => {
  try {
    console.log('POST /auth/register - Datos recibidos:', req.body);
    
    const { email, password, fullName } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email y contraseña son requeridos'
      });
    }
    
    if (users.has(email)) {
      return res.status(400).json({
        success: false,
        error: 'El usuario ya existe'
      });
    }
    
    const user = {
      id: Date.now().toString(),
      email,
      full_name: fullName || 'Usuario',
      created_at: new Date().toISOString()
    };
    
    users.set(email, { ...user, password });
    
    const token = `token_${user.id}_${Date.now()}`;
    
    console.log('Usuario registrado:', email);
    
    res.json({
      success: true,
      message: 'Usuario registrado correctamente',
      user: user,
      session: {
        access_token: token
      }
    });
    
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// Login de usuario
app.post('/auth/login', async (req, res) => {
  try {
    console.log('POST /auth/login - Datos recibidos:', req.body);
    
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email y contraseña son requeridos'
      });
    }
    
    const userData = users.get(email);
    
    if (!userData || userData.password !== password) {
      return res.status(400).json({
        success: false,
        error: 'Credenciales inválidas'
      });
    }
    
    const user = {
      id: userData.id,
      email: userData.email,
      full_name: userData.full_name,
      created_at: userData.created_at
    };
    
    const token = `token_${user.id}_${Date.now()}`;
    
    console.log('Usuario logueado:', email);
    
    res.json({
      success: true,
      message: 'Login exitoso',
      user: user,
      session: {
        access_token: token
      }
    });
    
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// ============= MIDDLEWARE DE AUTENTICACIÓN =============

function authenticateUser(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token || !token.startsWith('token_')) {
    return res.status(401).json({ 
      success: false,
      error: 'Token requerido' 
    });
  }
  
  // Extraer user ID del token
  const userId = token.split('_')[1];
  
  // Buscar usuario
  const user = Array.from(users.values()).find(u => u.id === userId);
  
  if (!user) {
    return res.status(401).json({ 
      success: false,
      error: 'Token inválido' 
    });
  }
  
  req.user = user;
  next();
}

// ============= RUTAS DE REGISTROS =============

// Obtener registros del usuario
app.get('/records', authenticateUser, (req, res) => {
  try {
    console.log('GET /records - Usuario:', req.user.email);
    
    const userRecords = Array.from(records.values())
      .filter(record => record.user_id === req.user.id)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    res.json({
      success: true,
      records: userRecords,
      total: userRecords.length
    });
    
  } catch (error) {
    console.error('Error obteniendo registros:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener registros'
    });
  }
});

// Crear nuevo registro
app.post('/records', authenticateUser, (req, res) => {
  try {
    console.log('POST /records - Usuario:', req.user.email);
    console.log('Datos recibidos:', req.body);
    
    const { location, notes, transcription, coordinates } = req.body;
    
    const record = {
      id: Date.now().toString(),
      user_id: req.user.id,
      location: location || null,
      notes: notes || null,
      transcription: transcription || null,
      coordinates: coordinates ? JSON.parse(coordinates) : null,
      photo_url: null, // Por ahora sin fotos
      audio_url: null, // Por ahora sin audio
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    records.set(record.id, record);
    
    console.log('Registro creado:', record.id);
    
    res.json({
      success: true,
      message: 'Registro creado correctamente',
      record: record
    });
    
  } catch (error) {
    console.error('Error creando registro:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear registro'
    });
  }
});

// Obtener registro específico
app.get('/records/:id', authenticateUser, (req, res) => {
  try {
    const { id } = req.params;
    const record = records.get(id);
    
    if (!record || record.user_id !== req.user.id) {
      return res.status(404).json({
        success: false,
        error: 'Registro no encontrado'
      });
    }
    
    res.json({
      success: true,
      record: record
    });
    
  } catch (error) {
    console.error('Error obteniendo registro:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener registro'
    });
  }
});

// Actualizar registro
app.put('/records/:id', authenticateUser, (req, res) => {
  try {
    const { id } = req.params;
    const { location, notes } = req.body;
    
    const record = records.get(id);
    
    if (!record || record.user_id !== req.user.id) {
      return res.status(404).json({
        success: false,
        error: 'Registro no encontrado'
      });
    }
    
    record.location = location;
    record.notes = notes;
    record.updated_at = new Date().toISOString();
    
    records.set(id, record);
    
    res.json({
      success: true,
      message: 'Registro actualizado correctamente',
      record: record
    });
    
  } catch (error) {
    console.error('Error actualizando registro:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar registro'
    });
  }
});

// Eliminar registro
app.delete('/records/:id', authenticateUser, (req, res) => {
  try {
    const { id } = req.params;
    const record = records.get(id);
    
    if (!record || record.user_id !== req.user.id) {
      return res.status(404).json({
        success: false,
        error: 'Registro no encontrado'
      });
    }
    
    records.delete(id);
    
    res.json({
      success: true,
      message: 'Registro eliminado correctamente'
    });
    
  } catch (error) {
    console.error('Error eliminando registro:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar registro'
    });
  }
});

// ============= RUTAS EXISTENTES =============

// Ruta principal
app.get('/', (req, res) => {
  console.log('GET / - Enviando respuesta de bienvenida');
  res.json({
    message: 'Field Inspector API está funcionando! 🚀',
    timestamp: new Date().toISOString(),
    service: 'Field Inspector API',
    version: '1.0.0',
    port: PORT,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Ruta de salud
app.get('/health', (req, res) => {
  console.log('GET /health - Enviando status de salud');
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Field Inspector API',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    users_count: users.size,
    records_count: records.size
  });
});

// Ruta de prueba
app.get('/test', (req, res) => {
  console.log('GET /test - Enviando respuesta de prueba');
  res.json({
    message: 'Test endpoint funcionando correctamente',
    timestamp: new Date().toISOString(),
    database_simulation: {
      users: users.size,
      records: records.size
    },
    environment_variables: {
      NODE_ENV: process.env.NODE_ENV || 'not_set',
      PORT: PORT
    }
  });
});

// ============= RUTAS DE ESTADÍSTICAS =============

app.get('/stats', authenticateUser, (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];
    
    const userRecords = Array.from(records.values()).filter(r => r.user_id === userId);
    const todayRecords = userRecords.filter(r => r.created_at.split('T')[0] === today);
    const locations = [...new Set(userRecords.map(r => r.location).filter(Boolean))];
    
    res.json({
      success: true,
      stats: {
        totalRecords: userRecords.length,
        todayRecords: todayRecords.length,
        uniqueLocations: locations.length
      }
    });
    
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadísticas'
    });
  }
});

// Catch-all para rutas no encontradas
app.get('*', (req, res) => {
  console.log(`GET ${req.path} - Ruta no encontrada`);
  res.status(404).json({
    error: 'Ruta no encontrada',
    path: req.path,
    available_routes: {
      auth: ['/auth/register', '/auth/login'],
      records: ['/records', '/records/:id'],
      info: ['/', '/health', '/test', '/stats']
    }
  });
});

// Manejo de errores
app.use((error, req, res, next) => {
  console.error('Error en la aplicación:', error);
  res.status(500).json({
    success: false,
    error: 'Error interno del servidor',
    timestamp: new Date().toISOString()
  });
});

// Iniciar servidor
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor iniciado correctamente`);
  console.log(`📡 Escuchando en puerto: ${PORT}`);
  console.log(`🌐 Bind address: 0.0.0.0`);
  console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`💾 Database: En memoria (simulación)`);
  console.log(`💚 Servidor listo para recibir requests!`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM recibido, cerrando servidor...');
  server.close(() => {
    console.log('Servidor cerrado correctamente');
    process.exit(0);
  });
});

module.exports = app;
