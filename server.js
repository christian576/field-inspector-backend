const express = require('express');
const cors = require('cors');
const multer = require('multer');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 8000;

// Configuración de OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Configuración de multer para archivos
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit
  }
});

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

// ============= RUTA DE TRANSCRIPCIÓN =============

app.post('/transcribe', authenticateUser, upload.single('audio'), async (req, res) => {
  try {
    console.log('POST /transcribe - Usuario:', req.user.email);
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No se recibió archivo de audio'
      });
    }
    
    console.log(`Audio recibido: ${req.file.size} bytes, tipo: ${req.file.mimetype}`);
    
    // Si no hay OpenAI API key, usar transcripciones simuladas inteligentes
    if (!process.env.OPENAI_API_KEY) {
      console.log('OpenAI API key no configurada, usando transcripción simulada');
      
      const mockTranscriptions = [
        "El motor principal presenta vibraciones anómalas y requiere mantenimiento inmediato en los rodamientos del eje principal.",
        "Se detectó una fuga de aceite hidráulico en el sistema de la bomba número dos, requiere atención urgente.",
        "Los rodamientos del ventilador de refrigeración están haciendo ruido excesivo, necesitan lubricación y posible reemplazo.",
        "La bomba de agua tiene pérdida de presión, verificar válvulas de retención y conexiones del sistema.",
        "El panel eléctrico muestra señales de sobrecalentamiento en el sector C, revisar conexiones y ventilación.",
        "Las correas de transmisión están desgastadas y presentan grietas, requieren reemplazo urgente antes de la falla.",
        "El sistema de aire comprimido presenta fugas en múltiples puntos de conexión, afectando la presión operativa.",
        "Los filtros de aire están completamente obstruidos y afectan significativamente el rendimiento del equipo.",
        "Se observan grietas estructurales en la base metálica que requieren soldadura y refuerzo inmediato.",
        "El equipo de refrigeración no mantiene la temperatura correcta, verificar refrigerante y termostato.",
        "La cinta transportadora presenta desgaste excesivo en los rodillos y requiere ajuste de tensión.",
        "El compresor de aire presenta ruidos anómalos y vibraciones, posible falla en válvulas internas.",
        "Los sensores de temperatura están mostrando lecturas inconsistentes, calibración y verificación necesaria.",
        "El sistema eléctrico presenta chispas en las conexiones del motor, riesgo de incendio inmediato.",
        "La transmisión mecánica tiene juego excesivo en los engranajes, requiere inspección detallada."
      ];
      
      const randomTranscription = mockTranscriptions[Math.floor(Math.random() * mockTranscriptions.length)];
      
      return res.json({
        success: true,
        transcription: randomTranscription,
        message: 'Transcripción simulada inteligente (OpenAI no configurado)'
      });
    }
    
    try {
      console.log('Enviando audio a OpenAI Whisper...');
      
      // Crear un objeto File para OpenAI
      const audioFile = new File([req.file.buffer], 'audio.wav', {
        type: req.file.mimetype
      });
      
      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        language: 'es', // Español
        response_format: 'text',
        temperature: 0.2 // Para transcripciones más precisas
      });
      
      console.log('Transcripción OpenAI completada:', transcription.substring(0, 100) + '...');
      
      res.json({
        success: true,
        transcription: transcription,
        message: 'Audio transcrito correctamente con OpenAI Whisper'
      });
      
    } catch (openaiError) {
      console.error('Error en OpenAI:', openaiError);
      
      // Fallback a transcripción simulada si falla OpenAI
      const fallbackTranscription = "Error temporal en transcripción IA. El equipo muestra señales de desgaste y requiere inspección técnica detallada para determinar las acciones correctivas necesarias.";
      
      res.json({
        success: true,
        transcription: fallbackTranscription,
        message: 'Transcripción de respaldo (error temporal en IA)',
        error: openaiError.message
      });
    }
    
  } catch (error) {
    console.error('Error en transcripción:', error);
    res.status(500).json({
      success: false,
      error: 'Error al procesar transcripción'
    });
  }
});

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

// Crear nuevo registro (con archivos)
app.post('/records', authenticateUser, upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'audio', maxCount: 1 }
]), (req, res) => {
  try {
    console.log('POST /records - Usuario:', req.user.email);
    console.log('Datos recibidos:', req.body);
    console.log('Archivos recibidos:', req.files ? Object.keys(req.files) : 'ninguno');
    
    const { location, notes, transcription, coordinates } = req.body;
    
    // Procesar foto
    let photoData = null;
    if (req.files?.photo) {
      const photo = req.files.photo[0];
      console.log(`Foto recibida: ${photo.size} bytes, tipo: ${photo.mimetype}`);
      // Convertir a base64 para almacenar en memoria
      photoData = `data:${photo.mimetype};base64,${photo.buffer.toString('base64')}`;
    }
    
    // Procesar audio
    let audioData = null;
    if (req.files?.audio) {
      const audio = req.files.audio[0];
      console.log(`Audio recibido: ${audio.size} bytes, tipo: ${audio.mimetype}`);
      // En un sistema real, esto se subiría a cloud storage
      audioData = `audio_${Date.now()}.${audio.mimetype.split('/')[1]}`;
    }
    
    const record = {
      id: Date.now().toString(),
      user_id: req.user.id,
      location: location || null,
      notes: notes || null,
      transcription: transcription || null,
      coordinates: coordinates ? JSON.parse(coordinates) : null,
      photo_url: photoData, // Base64 de la foto
      audio_url: audioData, // Referencia del audio
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    records.set(record.id, record);
    
    console.log('Registro creado exitosamente:', record.id);
    
    res.json({
      success: true,
      message: 'Registro creado correctamente',
      record: record
    });
    
  } catch (error) {
    console.error('Error creando registro:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear registro: ' + error.message
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

// ============= RUTAS BÁSICAS =============

// Ruta principal
app.get('/', (req, res) => {
  console.log('GET / - Enviando respuesta de bienvenida');
  res.json({
    message: 'Field Inspector API está funcionando! 🚀',
    timestamp: new Date().toISOString(),
    service: 'Field Inspector API',
    version: '1.0.1',
    features: ['auth', 'records', 'transcription', 'file-upload'],
    endpoints: {
      auth: ['/auth/register', '/auth/login'],
      records: ['/records', '/records/:id'],
      transcription: ['/transcribe'],
      info: ['/', '/health', '/test', '/stats']
    },
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
    version: '1.0.1',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    database: {
      users_count: users.size,
      records_count: records.size
    },
    features: {
      openai_configured: !!process.env.OPENAI_API_KEY,
      file_upload: true,
      transcription: true
    }
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
      records: records.size,
      sample_user_emails: Array.from(users.keys()).slice(0, 3)
    },
    environment_variables: {
      NODE_ENV: process.env.NODE_ENV || 'not_set',
      PORT: PORT,
      openai_configured: !!process.env.OPENAI_API_KEY
    },
    features_available: [
      'user_registration',
      'user_authentication', 
      'record_management',
      'file_upload',
      'audio_transcription',
      'statistics'
    ]
  });
});

// Catch-all para rutas no encontradas
app.use('*', (req, res) => {
  console.log(`${req.method} ${req.originalUrl} - Ruta no encontrada`);
  res.status(404).json({
    error: 'Ruta no encontrada',
    method: req.method,
    path: req.originalUrl,
    available_routes: {
      auth: ['POST /auth/register', 'POST /auth/login'],
      records: ['GET /records', 'POST /records', 'GET /records/:id', 'PUT /records/:id', 'DELETE /records/:id'],
      transcription: ['POST /transcribe'],
      info: ['GET /', 'GET /health', 'GET /test', 'GET /stats']
    },
    tip: 'Verifica que la URL y el método HTTP sean correctos'
  });
});

// Manejo de errores global
app.use((error, req, res, next) => {
  console.error('Error global capturado:', error);
  res.status(500).json({
    success: false,
    error: 'Error interno del servidor',
    timestamp: new Date().toISOString(),
    request: {
      method: req.method,
      path: req.path
    }
  });
});

// Iniciar servidor
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Field Inspector API iniciado correctamente`);
  console.log(`📡 Puerto: ${PORT}`);
  console.log(`🌐 Bind: 0.0.0.0`);
  console.log(`⏰ Inicio: ${new Date().toISOString()}`);
  console.log(`🔧 Entorno: ${process.env.NODE_ENV || 'development'}`);
  console.log(`💾 Base de datos: Simulación en memoria`);
  console.log(`🎤 OpenAI: ${process.env.OPENAI_API_KEY ? 'Configurado ✅' : 'No configurado ❌'}`);
  console.log(`📁 Subida de archivos: Habilitada ✅`);
  console.log(`🔐 Autenticación: Habilitada ✅`);
  console.log(`💚 Servidor listo para recibir requests!`);
  console.log(`📋 Endpoints disponibles:`);
  console.log(`   - POST /auth/register`);
  console.log(`   - POST /auth/login`);
  console.log(`   - GET  /records`);
  console.log(`   - POST /records`);
  console.log(`   - POST /transcribe`);
  console.log(`   - GET  /health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM recibido, cerrando servidor...');
  server.close(() => {
    console.log('Servidor cerrado correctamente');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT recibido, cerrando servidor...');
  server.close(() => {
    console.log('Servidor cerrado correctamente');
    process.exit(0);
  });
});

module.exports = app;
