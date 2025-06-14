const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware básico
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Log de todas las requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

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
    memory: process.memoryUsage()
  });
});

// Ruta de prueba
app.get('/test', (req, res) => {
  console.log('GET /test - Enviando respuesta de prueba');
  res.json({
    message: 'Test endpoint funcionando correctamente',
    timestamp: new Date().toISOString(),
    headers: req.headers,
    environment_variables: {
      NODE_ENV: process.env.NODE_ENV || 'not_set',
      PORT: PORT,
      has_supabase_url: !!process.env.SUPABASE_URL,
      has_supabase_key: !!process.env.SUPABASE_ANON_KEY,
      has_openai_key: !!process.env.OPENAI_API_KEY
    }
  });
});

// Catch-all para rutas no encontradas
app.get('*', (req, res) => {
  console.log(`GET ${req.path} - Ruta no encontrada`);
  res.status(404).json({
    error: 'Ruta no encontrada',
    path: req.path,
    available_routes: ['/', '/health', '/test']
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

// Iniciar servidor - CRÍTICO: usar 0.0.0.0 para Railway
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor iniciado correctamente`);
  console.log(`📡 Escuchando en puerto: ${PORT}`);
  console.log(`🌐 Bind address: 0.0.0.0`);
  console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
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
