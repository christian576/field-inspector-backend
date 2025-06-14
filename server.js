// server.js - Backend completo con Express + Supabase
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Configuración de OpenAI para Whisper
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Configuración de Multer para archivos
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

// ============= RUTAS DE AUTENTICACIÓN =============

// Registro de usuario
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, fullName } = req.body;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        }
      }
    });

    if (error) throw error;

    res.json({
      success: true,
      message: 'Usuario registrado correctamente',
      user: data.user
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Login de usuario
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    res.json({
      success: true,
      message: 'Login exitoso',
      user: data.user,
      session: data.session
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// ============= MIDDLEWARE DE AUTENTICACIÓN =============

const authenticateUser = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Token requerido' });
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Error de autenticación' });
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
    
    let photoUrl = null;
    let transcription = null;

    // Subir foto si existe
    if (req.files?.photo) {
      const photo = req.files.photo[0];
      const fileName = `photos/${userId}/${Date.now()}-${photo.originalname}`;
      
      const { data: photoData, error: photoError } = await supabase.storage
        .from('field-inspector')
        .upload(fileName, photo.buffer, {
          contentType: photo.mimetype,
          upsert: false
        });

      if (photoError) throw photoError;

      // Obtener URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('field-inspector')
        .getPublicUrl(fileName);
      
      photoUrl = publicUrl;
    }

    // Procesar audio con Whisper si existe
    if (req.files?.audio) {
      const audio = req.files.audio[0];
      
      try {
        // Crear un archivo temporal para Whisper
        const audioFile = new File([audio.buffer], 'audio.wav', {
          type: audio.mimetype
        });

        const transcriptionResponse = await openai.audio.transcriptions.create({
          file: audioFile,
          model: 'whisper-1',
          language: 'es', // Español
          response_format: 'text'
        });

        transcription = transcriptionResponse;
      } catch (whisperError) {
        console.error('Error en Whisper:', whisperError);
        // Si falla Whisper, continuamos sin transcripción
        transcription = 'Error al procesar audio';
      }
    }

    // Guardar en base de datos
    const { data, error } = await supabase
      .from('inspection_records')
      .insert([
        {
          user_id: userId,
          location: location || null,
          notes: notes || null,
          photo_url: photoUrl,
          transcription: transcription,
          coordinates: coordinates ? JSON.parse(coordinates) : null,
          created_at: new Date().toISOString()
        }
      ])
      .select();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Registro creado correctamente',
      record: data[0]
    });

  } catch (error) {
    console.error('Error creating record:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Obtener registros del usuario
app.get('/api/records', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 50, location, dateFrom, dateTo } = req.query;
    
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
    
    if (error) throw error;

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
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Obtener registro específico
app.get('/api/records/:id', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('inspection_records')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Registro no encontrado'
      });
    }

    res.json({
      success: true,
      record: data
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Actualizar registro
app.put('/api/records/:id', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const { location, notes } = req.body;
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('inspection_records')
      .update({
        location,
        notes,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select();

    if (error) throw error;

    if (!data.length) {
      return res.status(404).json({
        success: false,
        error: 'Registro no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Registro actualizado correctamente',
      record: data[0]
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Eliminar registro
app.delete('/api/records/:id', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Obtener el registro para eliminar la foto también
    const { data: record } = await supabase
      .from('inspection_records')
      .select('photo_url')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    // Eliminar foto del storage si existe
    if (record?.photo_url) {
      const fileName = record.photo_url.split('/').pop();
      await supabase.storage
        .from('field-inspector')
        .remove([`photos/${userId}/${fileName}`]);
    }

    // Eliminar registro de la base de datos
    const { error } = await supabase
      .from('inspection_records')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Registro eliminado correctamente'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============= RUTAS DE ESTADÍSTICAS =============

app.get('/api/stats', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    // Total de registros
    const { count: totalRecords } = await supabase
      .from('inspection_records')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    // Registros de hoy
    const { count: todayRecords } = await supabase
      .from('inspection_records')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', today);

    // Ubicaciones únicas
    const { data: locations } = await supabase
      .from('inspection_records')
      .select('location')
      .eq('user_id', userId)
      .not('location', 'is', null);

    const uniqueLocations = [...new Set(locations.map(r => r.location))].length;

    res.json({
      success: true,
      stats: {
        totalRecords: totalRecords || 0,
        todayRecords: todayRecords || 0,
        uniqueLocations: uniqueLocations || 0
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============= RUTA DE SALUD =============

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Field Inspector API'
  });
});

// Manejo de errores global
app.use((error, req, res, next) => {
  console.error('Error global:', error);
  res.status(500).json({
    success: false,
    error: 'Error interno del servidor'
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
