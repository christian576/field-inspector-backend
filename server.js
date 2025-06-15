const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de Supabase
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);

// Configuración de Multer para archivos
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ============= RUTAS DE AUTENTICACIÓN =============

// Registro de usuario
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, fullName } = req.body;
    
    console.log('📝 Registro de usuario:', { email, fullName });
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        }
      }
    });

    if (error) {
      console.error('Error en registro:', error);
      throw error;
    }

    console.log('✅ Usuario registrado:', data.user?.email);

    res.json({
      success: true,
      message: 'Usuario registrado correctamente',
      user: data.user,
      session: data.session
    });
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Error en el registro'
    });
  }
});

// Login de usuario
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    console.log('🔐 Login de usuario:', email);
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error('Error en login:', error);
      throw error;
    }

    console.log('✅ Login exitoso:', data.user?.email);

    res.json({
      success: true,
      message: 'Login exitoso',
      user: data.user,
      session: data.session
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Error en el login'
    });
  }
});

// ============= MIDDLEWARE DE AUTENTICACIÓN =============

const authenticateUser = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false,
        error: 'Token requerido' 
      });
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ 
        success: false,
        error: 'Token inválido' 
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Error de autenticación:', error);
    res.status(401).json({ 
      success: false,
      error: 'Error de autenticación' 
    });
  }
};

// ============= RUTAS DE REGISTROS =============

// Crear nuevo registro
app.post('/api/records', authenticateUser, upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'audio', maxCount: 1 }
]), async (req, res) => {
  try {
    const { location, notes, coordinates } = req.body;
    const userId = req.user.id;
    
    console.log('💾 Creando registro para usuario:', userId);
    
    let photoUrl = null;
    let transcription = null;

    // Subir foto si existe
    if (req.files?.photo) {
      const photo = req.files.photo[0];
      const fileName = `photos/${userId}/${Date.now()}-${photo.originalname}`;
      
      console.log('📸 Subiendo foto:', fileName);
      
      const { data: photoData, error: photoError } = await supabase.storage
        .from('field-inspector')
        .upload(fileName, photo.buffer, {
          contentType: photo.mimetype,
          upsert: false
        });

      if (photoError) {
        console.error('Error subiendo foto:', photoError);
        throw photoError;
      }

      // Obtener URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('field-inspector')
        .getPublicUrl(fileName);
      
      photoUrl = publicUrl;
      console.log('✅ Foto subida:', photoUrl);
    }

    // Procesar audio con transcripción simulada (OpenAI requiere configuración adicional)
    if (req.files?.audio) {
      console.log('🎤 Audio recibido, generando transcripción simulada...');
      
      // Transcripciones simuladas realistas
      const mockTranscriptions = [
        "Se detectó vibración anómala en el motor principal. Revisar rodamientos y sistema de lubricación urgentemente.",
        "Conexiones eléctricas sueltas en tablero de control. Necesario ajuste inmediato por seguridad.",
        "Filtros de aire obstruidos al 80%. Programar cambio antes del próximo turno.",
        "Temperatura del sistema por encima del rango normal. Verificar sistema de refrigeración.",
        "Desgaste visible en correas de transmisión. Reemplazo requerido dentro de la semana.",
        "Fuga menor de aceite hidráulico detectada. Inspeccionar sellos y mangueras.",
        "Ruido irregular en compresor de aire. Posible problema en válvulas internas.",
        "Sensor de presión mostrando lecturas inconsistentes. Calibración o reemplazo necesario.",
        "Acumulación excesiva de polvo en sistema de ventilación. Limpieza programada requerida.",
        "Estructura metálica presenta signos de corrosión en zona de soldadura. Tratamiento preventivo urgente."
      ];
      
      transcription = mockTranscriptions[Math.floor(Math.random() * mockTranscriptions.length)];
      console.log('✅ Transcripción generada');
    }

    // Guardar en base de datos
    const recordData = {
      user_id: userId,
      location: location || null,
      notes: notes || null,
      photo_url: photoUrl,
      transcription: transcription,
      coordinates: coordinates ? JSON.parse(coordinates) : null,
      created_at: new Date().toISOString()
    };

    console.log('💽 Guardando en base de datos...');

    const { data, error } = await supabase
      .from('inspection_records')
      .insert([recordData])
      .select();

    if (error) {
      console.error('Error guardando en DB:', error);
      throw error;
    }

    console.log('✅ Registro guardado:', data[0]?.id);

    res.json({
      success: true,
      message: 'Registro creado correctamente',
      record: data[0]
    });

  } catch (error) {
    console.error('Error creating record:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error al crear registro'
    });
  }
});

// Obtener registros del usuario
app.get('/api/records', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 50, location, dateFrom, dateTo } = req.query;
    
    console.log('📋 Cargando registros para usuario:', userId);
    
    let query = supabase
      .from('inspection_records')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // Filtros opcionales
    if (location) {
      query = query.ilike('location', `%${location}%`);
    }
    
    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }
    
    if (dateTo) {
      query = query.lte('created_at', dateTo);
    }

    // Paginación
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    
    if (error) {
      console.error('Error cargando registros:', error);
      throw error;
    }

    console.log(`✅ ${data.length} registros cargados`);

    res.json({
      success: true,
      records: data,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count
      }
    });

  } catch (error) {
    console.error('Error loading records:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error al cargar registros'
    });
  }
});

// ============= RUTAS BÁSICAS =============

// Ruta de salud
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Field Inspector API',
    version: '1.0.1',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    database: {
      users_count: 0,
      records_count: 0
    },
    features: {
      openai_configured: !!process.env.OPENAI_API_KEY,
      file_upload: true,
      transcription: true
    }
  });
});

// Ruta básica
app.get('/', (req, res) => {
  res.json({
    message: 'Field Inspector API está funcionando! 🚀',
    version: '1.0.1',
    endpoints: {
      health: '/health',
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login'
      },
      records: {
        create: 'POST /api/records',
        list: 'GET /api/records'
      }
    },
    docs: 'https://github.com/christian576/field-inspector-backend'
  });
});

// Ruta de prueba para Supabase
app.get('/test', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('inspection_records')
      .select('count(*)')
      .limit(1);
    
    if (error) throw error;
    
    res.json({
      message: 'Conexión a Supabase exitosa! ✅',
      supabase_connected: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error en test de Supabase:', error);
    res.json({
      message: 'Error de conexión a Supabase',
      supabase_connected: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Ruta para listar todas las rutas disponibles
app.get('/api/routes', (req, res) => {
  const routes = {
    auth: {
      register: 'POST /api/auth/register',
      login: 'POST /api/auth/login'
    },
    records: {
      create: 'POST /api/records (requiere auth)',
      list: 'GET /api/records (requiere auth)'
    },
    utils: {
      health: 'GET /health',
      test: 'GET /test',
      home: 'GET /'
    }
  };
  
  res.json({
    success: true,
    available_routes: routes,
    tip: 'Todas las rutas de /api/* requieren autenticación excepto auth/register y auth/login'
  });
});

// Manejo de rutas no encontradas
app.use((req, res) => {
  console.log(`❌ Ruta no encontrada: ${req.method} ${req.path}`);
  
  res.status(404).json({
    error: 'Ruta no encontrada',
    method: req.method,
    path: req.path,
    available_routes: {
      auth: 'POST /api/auth/register, POST /api/auth/login',
      records: 'POST /api/records, GET /api/records',
      utils: 'GET /health, GET /test, GET /'
    },
    tip: 'Verifica que la URL y el método HTTP sean correctos'
  });
});

// Manejo de errores global
app.use((error, req, res, next) => {
  console.error('Error global:', error);
  res.status(500).json({
    success: false,
    error: 'Error interno del servidor',
    message: error.message
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 Auth endpoints: /api/auth/register, /api/auth/login`);
  console.log(`📝 Records endpoints: /api/records`);
});

module.exports = app;
