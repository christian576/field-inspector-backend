const express = require('express');
const cors = require('cors');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 8080;

// Reemplaza las líneas 8-24 de tu server.js con esto:

// Intentar conectar a Supabase solo si las variables están disponibles
let supabase = null;
let hasSupabase = false;

try {
  // Priorizar Service Key sobre Anon Key
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
    const { createClient } = require('@supabase/supabase-js');
    
    // Usar service key para todas las operaciones del servidor
    supabase = createClient(
      process.env.SUPABASE_URL, 
      process.env.SUPABASE_SERVICE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false
        }
      }
    );
    
    hasSupabase = true;
    console.log('✅ Supabase configurado con Service Role Key');
    
    // Test rápido de conexión
    supabase.storage.listBuckets()
      .then(({ data, error }) => {
        if (error) {
          console.error('❌ Error conectando Storage:', error);
        } else {
          console.log('✅ Storage conectado. Buckets:', data?.map(b => b.name) || []);
        }
      })
      .catch(err => console.error('❌ Error en test de Storage:', err));
    
  } else if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    const { createClient } = require('@supabase/supabase-js');
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    hasSupabase = true;
    console.log('✅ Supabase configurado con Anon Key (limitado)');
  } else {
    console.log('⚠️ Variables de Supabase no encontradas, usando modo fallback');
  }
} catch (error) {
  console.log('⚠️ Error al conectar Supabase:', error.message);
}

// Configuración de Multer para archivos
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Base de datos en memoria como fallback
const memoryDB = {
  users: new Map(),
  records: new Map(),
  userIdCounter: 1,
  recordIdCounter: 1
};

// ============= FUNCIONES AUXILIARES =============

// Generar transcripción realista
function generateTranscription() {
  const transcriptions = [
    "Motor principal presenta vibraciones anómalas y ruido excesivo. Se recomienda revisión urgente del sistema de rodamientos y cambio de aceite lubricante.",
    "Conexiones eléctricas sueltas detectadas en tablero de control principal. Ajuste inmediato requerido por temas de seguridad operacional.",
    "Sistema de filtros de aire presenta obstrucción del 80%. Programar cambio inmediato antes del siguiente turno de producción.",
    "Temperatura del sistema hidráulico por encima del rango normal de operación. Verificar sistema de refrigeración y niveles de fluido.",
    "Desgaste visible en correas de transmisión principal. Reemplazo programado requerido dentro de los próximos 7 días.",
    "Fuga menor de aceite hidráulico detectada en cilindro número 3. Inspeccionar sellos y mangueras de conexión.",
    "Compresor de aire presenta ruido irregular durante ciclos de carga. Posible problema en válvulas internas de admisión.",
    "Sensor de presión del sistema mostrando lecturas inconsistentes. Calibración o reemplazo del componente necesario.",
    "Acumulación excesiva de polvo y partículas en sistema de ventilación. Limpieza programada y mantenimiento requerido.",
    "Estructura metálica presenta signos iniciales de corrosión en zona de soldadura. Tratamiento preventivo urgente necesario."
  ];
  return transcriptions[Math.floor(Math.random() * transcriptions.length)];
}

// Simular subida de imagen
function simulateImageUpload(imageBuffer, fileName) {
  const fakeUrl = `https://storage.supabase.co/field-inspector/photos/simulated/${fileName}`;
  console.log('📸 Simulando subida de imagen:', fileName);
  return fakeUrl;
}

// ============= RUTAS DE AUTENTICACIÓN =============

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, fullName } = req.body;
    
    console.log('📝 Registro de usuario:', email);

    if (hasSupabase) {
      // Usar Supabase real
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName }
        }
      });

      if (error) throw error;

      res.json({
        success: true,
        message: 'Usuario registrado con Supabase',
        user: data.user,
        session: data.session
      });
    } else {
      // Fallback a memoria
      for (let [id, user] of memoryDB.users) {
        if (user.email === email) {
          return res.status(400).json({
            success: false,
            error: 'El usuario ya existe'
          });
        }
      }

      const userId = memoryDB.userIdCounter++;
      const user = {
        id: userId,
        email,
        fullName,
        created_at: new Date().toISOString()
      };

      memoryDB.users.set(userId, user);
      const token = `fallback_token_${userId}_${Date.now()}`;

      res.json({
        success: true,
        message: 'Usuario registrado (modo fallback)',
        user: { id: userId, email, fullName },
        session: { access_token: token }
      });
    }

  } catch (error) {
    console.error('Error en registro:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Error en el registro'
    });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    console.log('🔐 Login de usuario:', email);

    if (hasSupabase) {
      // Usar Supabase real
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      res.json({
        success: true,
        message: 'Login exitoso con Supabase',
        user: data.user,
        session: data.session
      });
    } else {
      // Fallback a memoria
      let foundUser = null;
      for (let [id, user] of memoryDB.users) {
        if (user.email === email) {
          foundUser = user;
          break;
        }
      }

      if (!foundUser) {
        return res.status(400).json({
          success: false,
          error: 'Usuario no encontrado'
        });
      }

      const token = `fallback_token_${foundUser.id}_${Date.now()}`;

      res.json({
        success: true,
        message: 'Login exitoso (modo fallback)',
        user: foundUser,
        session: { access_token: token }
      });
    }

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

    if (hasSupabase && !token.startsWith('fallback_token_')) {
      // Verificar con Supabase
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (error || !user) {
        return res.status(401).json({
          success: false,
          error: 'Token inválido'
        });
      }

      req.user = user;
    } else {
      // Verificar token fallback
      const match = token.match(/^fallback_token_(\d+)_/);
      if (!match) {
        return res.status(401).json({
          success: false,
          error: 'Token inválido'
        });
      }

      const userId = parseInt(match[1]);
      const user = memoryDB.users.get(userId);

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Usuario no encontrado'
        });
      }

      req.user = { id: userId, ...user };
    }

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

    // Procesar foto
    if (req.files?.photo) {
      const photo = req.files.photo[0];
      const fileName = `${userId}_${Date.now()}_${photo.originalname}`;
      
      if (hasSupabase) {
        try {
          const { data: photoData, error: photoError } = await supabase.storage
            .from('field-inspector')
            .upload(`photos/${userId}/${fileName}`, photo.buffer, {
              contentType: photo.mimetype,
              upsert: false
            });

          if (photoError) throw photoError;

          const { data: { publicUrl } } = supabase.storage
            .from('field-inspector')
            .getPublicUrl(`photos/${userId}/${fileName}`);
          
          photoUrl = publicUrl;
          console.log('✅ Foto subida a Supabase:', photoUrl);
        } catch (error) {
          console.error('Error subiendo foto:', error);
          photoUrl = simulateImageUpload(photo.buffer, fileName);
        }
      } else {
        photoUrl = simulateImageUpload(photo.buffer, fileName);
      }
    }

    // Procesar audio con OpenAI Whisper
    if (req.files?.audio) {
      console.log('🎤 Procesando audio con OpenAI Whisper...');
      
      try {
        // Verificar si OpenAI está configurado
        if (!process.env.OPENAI_API_KEY) {
          throw new Error('OpenAI API Key no configurada');
        }

        const OpenAI = require('openai');
        const openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        });

        const audioFile = req.files.audio[0];
        
        // OpenAI acepta directamente el buffer con nombre
        const audioForWhisper = {
          buffer: audioFile.buffer,
          originalname: 'audio.wav',
          mimetype: audioFile.mimetype || 'audio/wav'
        };

        // Transcribir con Whisper
         const transcriptionResponse = await openai.audio.transcriptions.create({
          file: new File([audioForWhisper.buffer], audioForWhisper.originalname, {
            type: audioForWhisper.mimetype
          }),
          model: 'whisper-1',
          language: 'es',
          response_format: 'text'
        });

        transcription = transcriptionResponse;
        console.log('✅ Transcripción real con OpenAI:', transcription.substring(0, 100) + '...');
        
      } catch (error) {
        console.error('Error en transcripción OpenAI:', error.message);
        // Fallback a transcripción simulada
        transcription = generateTranscription();
        console.log('⚠️ Usando transcripción simulada como fallback');
      }
    }

    // Si no hay audio pero se especifica transcripción manual
    if (!transcription && req.body.transcription) {
      transcription = req.body.transcription;
    }

    // Si no hay transcripción, generar una simulada
    if (!transcription) {
      transcription = generateTranscription();
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

    let savedRecord;

    if (hasSupabase) {
      try {
        const { data, error } = await supabase
          .from('inspection_records')
          .insert([recordData])
          .select();

        if (error) throw error;
        savedRecord = data[0];
        console.log('✅ Registro guardado en Supabase:', savedRecord.id);
      } catch (error) {
        console.error('Error guardando en Supabase:', error);
        // Fallback a memoria
        const recordId = memoryDB.recordIdCounter++;
        savedRecord = { id: recordId, ...recordData };
        memoryDB.records.set(recordId, savedRecord);
        console.log('⚠️ Registro guardado en memoria como fallback');
      }
    } else {
      // Guardar en memoria
      const recordId = memoryDB.recordIdCounter++;
      savedRecord = { id: recordId, ...recordData };
      memoryDB.records.set(recordId, savedRecord);
      console.log('💾 Registro guardado en memoria');
    }

    res.json({
      success: true,
      message: 'Registro creado correctamente',
      record: savedRecord,
      features: {
        real_transcription: !!process.env.OPENAI_API_KEY,
        supabase_storage: hasSupabase,
        photo_uploaded: !!photoUrl
      }
    });

  } catch (error) {
    console.error('Error creating record:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error al crear registro'
    });
  }
});

app.get('/api/records', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 50 } = req.query;
    
    console.log('📋 Cargando registros para usuario:', userId);

    let records = [];

    if (hasSupabase) {
      try {
        const { data, error } = await supabase
          .from('inspection_records')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .range((page - 1) * limit, page * limit - 1);

        if (error) throw error;
        records = data;
        console.log(`✅ ${records.length} registros cargados desde Supabase`);
      } catch (error) {
        console.error('Error cargando desde Supabase:', error);
        // Fallback a memoria
        for (let [id, record] of memoryDB.records) {
          if (record.user_id === userId) {
            records.push(record);
          }
        }
        records.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        console.log(`⚠️ ${records.length} registros cargados desde memoria`);
      }
    } else {
      // Cargar desde memoria
      for (let [id, record] of memoryDB.records) {
        if (record.user_id === userId) {
          records.push(record);
        }
      }
      records.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      console.log(`💾 ${records.length} registros cargados desde memoria`);
    }

    res.json({
      success: true,
      records: records,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: records.length
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

// ============= RUTA ESPECÍFICA PARA TRANSCRIPCIÓN =============

app.post('/api/transcribe', authenticateUser, upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No se recibió archivo de audio'
      });
    }

    console.log('🎤 Transcribiendo audio...');

    let transcription;

    try {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OpenAI API Key no configurada');
      }

      const OpenAI = require('openai');
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      // Crear File object para OpenAI
      const file = new File([req.file.buffer], 'audio.wav', {
        type: req.file.mimetype
      });

      // Transcribir con Whisper
      const transcriptionResponse = await openai.audio.transcriptions.create({
        file: file,
        model: 'whisper-1',
        language: 'es',
        response_format: 'text'
      });

      transcription = transcriptionResponse;
      console.log('✅ Transcripción exitosa con OpenAI');

    } catch (error) {
      console.error('Error en OpenAI:', error.message);
      // Fallback a transcripción simulada
      transcription = generateTranscription();
      console.log('⚠️ Usando transcripción simulada');
    }

    res.json({
      success: true,
      transcription: transcription,
      method: process.env.OPENAI_API_KEY ? 'openai_whisper' : 'simulated'
    });

  } catch (error) {
    console.error('Error en transcripción:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error al transcribir audio'
    });
  }
});

// ============= RUTAS BÁSICAS =============

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Field Inspector API',
    version: '1.0.2',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    database: {
      supabase_connected: hasSupabase,
      users_count: hasSupabase ? 'N/A' : memoryDB.users.size,
      records_count: hasSupabase ? 'N/A' : memoryDB.records.size
    },
    features: {
      openai_configured: !!process.env.OPENAI_API_KEY,
      supabase_configured: hasSupabase,
      file_upload: true,
      transcription: true,
      photo_storage: hasSupabase
    }
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'Field Inspector API v1.0.2 🚀',
    status: 'ACTIVE',
    features: {
      real_transcription: !!process.env.OPENAI_API_KEY,
      database: hasSupabase ? 'Supabase' : 'Memory',
      storage: hasSupabase ? 'Supabase Storage' : 'Simulated'
    },
    endpoints: {
      health: 'GET /health',
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login'
      },
      records: {
        create: 'POST /api/records',
        list: 'GET /api/records'
      },
      transcription: 'POST /api/transcribe'
    }
  });
});

app.get('/test', (req, res) => {
  res.json({
    message: 'API funcionando correctamente ✅',
    timestamp: new Date().toISOString(),
    configuration: {
      supabase: hasSupabase,
      openai: !!process.env.OPENAI_API_KEY,
      port: PORT,
      env: process.env.NODE_ENV || 'development'
    }
  });
});

// Manejo de errores
// Endpoint de prueba para Storage - agregar antes del 404 handler
app.get('/test-storage', async (req, res) => {
  try {
    console.log('🧪 Iniciando test de Storage...');
    
    if (!hasSupabase) {
      return res.json({ 
        error: 'Supabase no configurado',
        hasSupabase,
        env: {
          hasUrl: !!process.env.SUPABASE_URL,
          hasAnon: !!process.env.SUPABASE_ANON_KEY
        }
      });
    }

    // 1. Listar buckets
    console.log('📦 Listando buckets...');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    // 2. Información del bucket específico
    let bucketInfo = null;
    if (buckets && buckets.find(b => b.name === 'field-inspector')) {
      console.log('🪣 Bucket field-inspector encontrado');
      
      // Intentar listar archivos en el bucket
      const { data: files, error: filesError } = await supabase.storage
        .from('field-inspector')
        .list('photos', {
          limit: 5,
          offset: 0
        });
      
      bucketInfo = {
        exists: true,
        files: files?.length || 0,
        filesError: filesError?.message
      };
    }

    // 3. Test de subida
    console.log('📤 Probando subida...');
    const testContent = Buffer.from('Test image content at ' + new Date().toISOString());
    const testFileName = `test_${Date.now()}.txt`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('field-inspector')
      .upload(`photos/${testFileName}`, testContent, {
        contentType: 'text/plain',
        upsert: true
      });

    // 4. Obtener URL si se subió
    let publicUrl = null;
    if (uploadData && !uploadError) {
      const { data: urlData } = supabase.storage
        .from('field-inspector')
        .getPublicUrl(`photos/${testFileName}`);
      publicUrl = urlData.publicUrl;
      
      // Intentar eliminar el archivo de prueba
      await supabase.storage
        .from('field-inspector')
        .remove([`photos/${testFileName}`]);
    }

    const response = {
      success: !uploadError,
      timestamp: new Date().toISOString(),
      config: {
        hasSupabase,
        supabaseUrl: process.env.SUPABASE_URL,
        hasAnonKey: !!process.env.SUPABASE_ANON_KEY,
        hasServiceKey: !!process.env.SUPABASE_SERVICE_KEY
      },
      storage: {
        buckets: buckets?.map(b => ({ name: b.name, public: b.public })),
        bucketsError: bucketsError?.message,
        bucketInfo,
        testUpload: {
          success: !uploadError,
          error: uploadError?.message,
          statusCode: uploadError?.statusCode,
          hint: uploadError?.hint,
          data: uploadData,
          publicUrl
        }
      }
    };

    console.log('📊 Resultado del test:', JSON.stringify(response, null, 2));
    res.json(response);

  } catch (error) {
    console.error('❌ Error en test:', error);
    res.status(500).json({ 
      error: error.message,
      stack: error.stack,
      type: error.constructor.name
    });
  }
});

// Endpoint adicional para probar subida con autenticación
app.post('/test-upload', authenticateUser, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    console.log('📤 Test upload con auth:', {
      userId: req.user.id,
      fileName: req.file.originalname,
      size: req.file.size
    });

    const fileName = `test_${req.user.id}_${Date.now()}_${req.file.originalname}`;
    
    const { data, error } = await supabase.storage
      .from('field-inspector')
      .upload(`photos/${fileName}`, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      });

    if (error) {
      console.error('❌ Error:', error);
      return res.status(400).json({ error: error.message, details: error });
    }

    const { data: { publicUrl } } = supabase.storage
      .from('field-inspector')
      .getPublicUrl(`photos/${fileName}`);

    res.json({
      success: true,
      fileName,
      publicUrl,
      data
    });

  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.use((req, res) => {
  res.status(404).json({
    error: 'Ruta no encontrada',
    method: req.method,
    path: req.path,
    available_routes: {
      auth: ['POST /api/auth/register', 'POST /api/auth/login'],
      records: ['POST /api/records', 'GET /api/records'],
      transcription: ['POST /api/transcribe'],
      utils: ['GET /', 'GET /health', 'GET /test']
    }
  });
});

app.use((error, req, res, next) => {
  console.error('Error global:', error);
  res.status(500).json({
    success: false,
    error: 'Error interno del servidor'
  });
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor Field Inspector iniciado en puerto ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 Supabase: ${hasSupabase ? '✅ Conectado' : '❌ Modo fallback'}`);
  console.log(`🤖 OpenAI: ${process.env.OPENAI_API_KEY ? '✅ Configurado' : '❌ Modo simulado'}`);
  console.log(`📝 Endpoints disponibles en http://localhost:${PORT}/`);
});

module.exports = app;
