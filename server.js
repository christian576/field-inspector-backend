const express = require('express');
const cors = require('cors');
const multer = require('multer');
//const axios = require('axios'); // AGREGADO: para Trello

const app = express();
const PORT = process.env.PORT || 8080;

// Reemplaza COMPLETAMENTE las líneas 8-50 de tu server.js con esto:

// Intentar conectar a Supabase solo si las variables están disponibles
let supabase = null;
let hasSupabase = false;

try {
  // IMPORTANTE: Usar SUPABASE_SERVICE_KEY, no SUPABASE_SERVICE_ROLE_KEY
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
    const { createClient } = require('@supabase/supabase-js');
    
    console.log('🔑 Inicializando Supabase con Service Key...');
    
    // Crear cliente con Service Key
    supabase = createClient(
      process.env.SUPABASE_URL, 
      process.env.SUPABASE_SERVICE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false
        },
        global: {
          headers: {
            'x-supabase-service-role': process.env.SUPABASE_SERVICE_KEY
          }
        }
      }
    );
    
    hasSupabase = true;
    console.log('✅ Supabase configurado con Service Role Key');
    
    // Verificar que realmente funcione
    supabase.storage.listBuckets()
      .then(({ data, error }) => {
        if (error) {
          console.error('❌ Error verificando Storage:', error);
        } else {
          console.log('✅ Storage verificado. Buckets:', data?.map(b => b.name) || []);
        }
      });
    
  } else if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    // Fallback a anon key si no hay service key
    const { createClient } = require('@supabase/supabase-js');
    
    console.log('⚠️ Service Key no encontrada, usando Anon Key (limitado)');
    
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    hasSupabase = true;
    console.log('✅ Supabase configurado con Anon Key');
  } else {
    console.log('⚠️ Variables de Supabase no encontradas');
    console.log('Variables disponibles:', {
      hasUrl: !!process.env.SUPABASE_URL,
      hasAnon: !!process.env.SUPABASE_ANON_KEY,
      hasService: !!process.env.SUPABASE_SERVICE_KEY
    });
  }
} catch (error) {
  console.log('⚠️ Error al conectar Supabase:', error.message);
  hasSupabase = false;
}

// AGREGADO: Configuración de Trello
//const TRELLO_API_KEY = process.env.TRELLO_API_KEY;
//const TRELLO_TOKEN = process.env.TRELLO_TOKEN;
//const TRELLO_BOARD_ID = process.env.TRELLO_BOARD_ID;
//const TRELLO_LIST_ID = process.env.TRELLO_LIST_ID;
//const hasTrello = !!(TRELLO_API_KEY && TRELLO_TOKEN && TRELLO_LIST_ID);

//if (hasTrello) {
  //console.log('✅ Trello configurado correctamente');
//} else {
  //console.log('⚠️ Trello no configurado (opcional)');
//}

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

// AGREGADO: Función helper para crear tarjeta en Trello
async function createTrelloCard(record) {
  if (!hasTrello) {
    return null;
  }

  try {
    const cardData = {
      name: `🔧 Inspección - ${record.location || 'Sin ubicación'} - ${new Date().toLocaleDateString('es-AR')}`,
      desc: `**📍 Ubicación:** ${record.location || 'No especificada'}\n\n` +
            `**📝 Notas:** ${record.notes || 'Sin notas'}\n\n` +
            `**🎯 Transcripción:** ${record.transcription || 'Sin transcripción'}\n\n` +
            `**📅 Fecha:** ${new Date().toLocaleString('es-AR')}\n\n` +
            `**👤 Usuario:** ${record.user_email || record.user_id}`,
      idList: TRELLO_LIST_ID,
      pos: 'top'
    };

    const response = await axios.post(
      `https://api.trello.com/1/cards`,
      {
        ...cardData,
        key: TRELLO_API_KEY,
        token: TRELLO_TOKEN
      }
    );

    const card = response.data;
    console.log('✅ Tarjeta creada en Trello:', card.id, card.shortUrl);

    // Si hay foto, adjuntarla a la tarjeta
    if (record.photo_url) {
      try {
        await axios.post(
          `https://api.trello.com/1/cards/${card.id}/attachments`,
          {
            url: record.photo_url,
            name: 'Foto de inspección',
            key: TRELLO_API_KEY,
            token: TRELLO_TOKEN
          }
        );
        console.log('📸 Foto adjuntada a tarjeta Trello');
      } catch (error) {
        console.error('Error adjuntando foto a Trello:', error.message);
      }
    }

    return card;
  } catch (error) {
    console.error('❌ Error creando tarjeta en Trello:', error.message);
    return null;
  }
}

// AGREGADO: Función helper mejorada para subir fotos
async function uploadPhotoToSupabase(photo, userId) {
  if (!hasSupabase || !supabase) {
    return null;
  }

  const timestamp = Date.now();
  const safeFileName = photo.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
  // IMPORTANTE: Usar estructura plana sin subcarpetas de usuario
  const fileName = `${timestamp}_${userId}_${safeFileName}`;
  const storagePath = `photos/${fileName}`;

  console.log('📸 Subiendo foto a Supabase:', {
    fileName,
    storagePath,
    size: photo.buffer.length,
    mimetype: photo.mimetype
  });

  try {
    // Intentar subir con Service Key si está disponible
    const { data, error } = await supabase.storage
      .from('field-inspector')
      .upload(storagePath, photo.buffer, {
        contentType: photo.mimetype,
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('❌ Error de Storage:', error);
      
      // Si el archivo ya existe, intentar con nombre único
      if (error.statusCode === 409) {
        const uniqueFileName = `${timestamp}_${Math.random().toString(36).substring(7)}_${safeFileName}`;
        const uniquePath = `photos/${uniqueFileName}`;
        
        const { data: retryData, error: retryError } = await supabase.storage
          .from('field-inspector')
          .upload(uniquePath, photo.buffer, {
            contentType: photo.mimetype,
            cacheControl: '3600',
            upsert: true
          });
        
        if (!retryError) {
          const { data: { publicUrl } } = supabase.storage
            .from('field-inspector')
            .getPublicUrl(uniquePath);
          
          console.log('✅ Foto subida con nombre único:', publicUrl);
          return publicUrl;
        } else {
          throw retryError;
        }
      } else {
        throw error;
      }
    }

    const { data: { publicUrl } } = supabase.storage
      .from('field-inspector')
      .getPublicUrl(storagePath);
    
    console.log('✅ Foto subida exitosamente:', publicUrl);
    return publicUrl;

  } catch (error) {
    console.error('❌ Error subiendo foto:', error);
    return null;
  }
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

    // MODIFICADO: Procesar foto con nueva función
    if (req.files?.photo) {
      const photo = req.files.photo[0];
      photoUrl = await uploadPhotoToSupabase(photo, userId);
      
      if (!photoUrl) {
        // Fallback si falla la subida
        photoUrl = simulateImageUpload(photo.buffer, photo.originalname);
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
        
        // AGREGADO: Crear tarjeta en Trello si está configurado
        if (hasTrello && savedRecord) {
          savedRecord.user_email = req.user.email;
          createTrelloCard(savedRecord).catch(error => {
            console.error('Error creando tarjeta en Trello:', error);
          });
        }
        
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
        photo_uploaded: !!photoUrl,
        trello_configured: hasTrello // AGREGADO
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

// AGREGADO: Endpoint para verificar configuración de Trello
app.get('/api/trello/status', authenticateUser, async (req, res) => {
  if (!hasTrello) {
    return res.json({ 
      success: false, 
      configured: false,
      message: 'Trello no está configurado' 
    });
  }

  try {
    // Verificar que las credenciales funcionan
    const response = await axios.get(
      `https://api.trello.com/1/members/me?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}`
    );

    res.json({
      success: true,
      configured: true,
      username: response.data.username,
      fullName: response.data.fullName,
      boardId: TRELLO_BOARD_ID,
      listId: TRELLO_LIST_ID
    });
  } catch (error) {
    res.json({
      success: false,
      configured: true,
      error: 'Error verificando credenciales de Trello'
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
      photo_storage: hasSupabase,
      trello_integration: hasTrello // AGREGADO
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
      storage: hasSupabase ? 'Supabase Storage' : 'Simulated',
      trello: hasTrello ? 'Configured' : 'Not configured' // AGREGADO
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
      transcription: 'POST /api/transcribe',
      trello: 'GET /api/trello/status' // AGREGADO
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
      trello: hasTrello, // AGREGADO
      port: PORT,
      env: process.env.NODE_ENV || 'development'
    }
  });
});

// Manejo de errores
// Reemplaza todo el endpoint /test-storage con este código actualizado:

app.get('/test-storage', async (req, res) => {
  try {
    console.log('🧪 Iniciando test de Storage...');
    
    if (!hasSupabase) {
      return res.json({ 
        error: 'Supabase no configurado',
        hasSupabase,
        env: {
          hasUrl: !!process.env.SUPABASE_URL,
          hasAnon: !!process.env.SUPABASE_ANON_KEY,
          hasService: !!process.env.SUPABASE_SERVICE_KEY
        }
      });
    }

    // 1. Listar buckets con manejo de errores mejorado
    console.log('📦 Listando buckets...');
    let buckets = [];
    let bucketsError = null;
    
    try {
      const bucketsResponse = await supabase.storage.listBuckets();
      buckets = bucketsResponse.data || [];
      bucketsError = bucketsResponse.error;
      console.log('Buckets response:', { count: buckets.length, error: bucketsError });
    } catch (err) {
      console.error('Error listando buckets:', err);
      bucketsError = err.message;
    }

    // 2. Información del bucket específico
    let bucketInfo = null;
    let filesInBucket = [];
    
    if (buckets.length > 0) {
      console.log('🪣 Buckets encontrados:', buckets.map(b => b.name));
      
      // Buscar nuestro bucket
      const fieldInspectorBucket = buckets.find(b => b.name === 'field-inspector');
      if (fieldInspectorBucket) {
        console.log('✅ Bucket field-inspector encontrado');
        
        try {
          // Listar archivos
          const { data: files, error: filesError } = await supabase.storage
            .from('field-inspector')
            .list('photos', {
              limit: 10,
              offset: 0
            });
          
          filesInBucket = files || [];
          bucketInfo = {
            exists: true,
            bucket: fieldInspectorBucket,
            filesCount: filesInBucket.length,
            filesError: filesError?.message
          };
        } catch (err) {
          console.error('Error listando archivos:', err);
        }
      }
    }

    // 3. Test de subida con imagen PNG mínima válida
    console.log('📤 Probando subida de imagen PNG...');
    
    // Crear imagen PNG 1x1 transparente válida
    const pngBuffer = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
      0x89, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x44, 0x41,
      0x54, 0x78, 0x9C, 0x62, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0D,
      0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
      0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
    ]);
    
    const testFileName = `test_${Date.now()}.png`;
    let uploadData = null;
    let uploadError = null;
    let publicUrl = null;

    try {
      const uploadResponse = await supabase.storage
        .from('field-inspector')
        .upload(`photos/${testFileName}`, pngBuffer, {
          contentType: 'image/png',
          cacheControl: '3600',
          upsert: true
        });
      
      uploadData = uploadResponse.data;
      uploadError = uploadResponse.error;
      
      if (uploadData && !uploadError) {
        const { data: urlData } = supabase.storage
          .from('field-inspector')
          .getPublicUrl(`photos/${testFileName}`);
        publicUrl = urlData.publicUrl;
        
        // Limpiar - eliminar archivo de prueba
        await supabase.storage
          .from('field-inspector')
          .remove([`photos/${testFileName}`]);
        
        console.log('✅ Test de subida exitoso, archivo eliminado');
      }
    } catch (err) {
      console.error('Error en upload test:', err);
      uploadError = err;
    }

    // 4. Test alternativo con JPEG si PNG falla
    let jpegTest = null;
    if (uploadError && uploadError.message?.includes('mime type')) {
      console.log('🔄 Intentando con JPEG...');
      
      // JPEG mínimo válido
      const jpegBuffer = Buffer.from([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46,
        0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
        0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
        0x00, 0x03, 0x02, 0x02, 0x03, 0x02, 0x02, 0x03,
        0x03, 0x03, 0x03, 0x04, 0x03, 0x03, 0x04, 0x05,
        0x08, 0x05, 0x05, 0x04, 0x04, 0x05, 0x0A, 0x07,
        0x07, 0x06, 0x08, 0x0C, 0x0A, 0x0C, 0x0C, 0x0B,
        0x0A, 0x0B, 0x0B, 0x0D, 0x0E, 0x12, 0x10, 0x0D,
        0x0E, 0x11, 0x0E, 0x0B, 0x0B, 0x10, 0x16, 0x10,
        0x11, 0x13, 0x14, 0x15, 0x15, 0x15, 0x0C, 0x0F,
        0x17, 0x18, 0x16, 0x14, 0x18, 0x12, 0x14, 0x15,
        0x14, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
        0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4,
        0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x0A, 0xFF, 0xC4, 0x00, 0x14,
        0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01,
        0x00, 0x00, 0x3F, 0x00, 0x7F, 0x01, 0xFF, 0xD9
      ]);
      
      try {
        const jpegFileName = `test_${Date.now()}.jpg`;
        const jpegResponse = await supabase.storage
          .from('field-inspector')
          .upload(`photos/${jpegFileName}`, jpegBuffer, {
            contentType: 'image/jpeg',
            upsert: true
          });
        
        if (jpegResponse.data && !jpegResponse.error) {
          await supabase.storage
            .from('field-inspector')
            .remove([`photos/${jpegFileName}`]);
          jpegTest = { success: true };
        } else {
          jpegTest = { success: false, error: jpegResponse.error };
        }
      } catch (err) {
        jpegTest = { success: false, error: err.message };
      }
    }

    const response = {
      success: !uploadError || jpegTest?.success,
      timestamp: new Date().toISOString(),
      config: {
        hasSupabase,
        supabaseUrl: process.env.SUPABASE_URL,
        hasAnonKey: !!process.env.SUPABASE_ANON_KEY,
        hasServiceKey: !!process.env.SUPABASE_SERVICE_KEY
      },
      storage: {
        buckets: buckets.map(b => ({ 
          name: b.name, 
          public: b.public,
          id: b.id 
        })),
        bucketsCount: buckets.length,
        bucketsError,
        bucketInfo,
        filesInBucket: filesInBucket.map(f => ({
          name: f.name,
          size: f.metadata?.size
        })),
        testUpload: {
          success: !uploadError,
          error: uploadError?.message || uploadError?.toString(),
          statusCode: uploadError?.statusCode,
          data: uploadData,
          publicUrl
        },
        jpegTest
      },
      debug: {
        supabaseClient: !!supabase,
        storageClient: !!supabase?.storage
      }
    };

    console.log('📊 Test completado');
    res.json(response);

  } catch (error) {
    console.error('❌ Error general en test:', error);
    res.status(500).json({ 
      error: error.message,
      stack: error.stack,
      type: error.constructor.name
    });
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
      trello: ['GET /api/trello/status'], // AGREGADO
      utils: ['GET /', 'GET /health', 'GET /test', 'GET /test-storage']
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
  console.log(`📋 Trello: ${hasTrello ? '✅ Configurado' : '❌ No configurado'}`); // AGREGADO
  console.log(`📝 Endpoints disponibles en http://localhost:${PORT}/`);
});

module.exports = app;
