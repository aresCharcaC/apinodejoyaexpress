const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./auth/auth.routes');

const { sequelize } = require('./models');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const app = express();

// ====================================
// MIDDLEWARES GLOBALES
// ====================================

app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    try {
      JSON.parse(buf);
    } catch (e) {
      console.error('❌ JSON malformado:', e.message);
      res.status(400).json({
        success: false,
        message: 'JSON malformado'
      });
      return;
    }
  }
}));

app.use(express.urlencoded({ 
  extended: true,
  limit: '10mb' 
}));

console.log('✅ Parsers JSON/URL configurados');


app.use(cors({
  origin: function(origin, callback) {
    console.log('🔍 CORS Origin check:', origin);
    
    // ✅ PERMITIR REQUESTS SIN ORIGIN (Flutter, Postman, curl)
    if (!origin) {
      console.log('✅ Request sin origin permitido');
      return callback(null, true);
    }
    
    // ✅ PERMITIR CUALQUIER DOMINIO DE NGROK
    if (origin.includes('ngrok')) {
      console.log('✅ Request de ngrok permitido:', origin);
      return callback(null, true);
    }
    
    // ✅ PERMITIR DOMINIOS LOCALES
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:8080',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:8080'
    ];
    
    if (allowedOrigins.includes(origin)) {
      console.log('✅ Request de localhost permitido:', origin);
      return callback(null, true);
    }
    
    // ✅ TEMPORAL: PERMITIR TODOS PARA DEBUG
    console.log('✅ Request permitido (modo debug):', origin);
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With', 
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'ngrok-skip-browser-warning',
    'User-Agent',
    '*' // ✅ PERMITIR CUALQUIER HEADER
  ],
  exposedHeaders: ['set-cookie'],
  optionsSuccessStatus: 200,
  preflightContinue: false
}));

console.log('✅ CORS configurado');



// ✅ MIDDLEWARE ESPECÍFICO PARA NGROK - AGREGAR ESTO
app.use((req, res, next) => {
  // Headers adicionales para ngrok
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, ngrok-skip-browser-warning');
  
  // Log para debug de ngrok
  if (req.get('host') && req.get('host').includes('ngrok')) {
    console.log('🔧 Request vía ngrok detectado');
    console.log('📥 Headers recibidos:', req.headers);
  }
  
  // Manejar preflight requests
  if (req.method === 'OPTIONS') {
    console.log('✅ Preflight request manejado');
    res.status(200).end();
    return;
  }
  
  next();
});

console.log('✅ Middleware ngrok configurado');
// Cookie parser
app.use(cookieParser());
console.log('✅ Cookie parser configurado');

// Middleware para logs en desarrollo
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`📝 ${timestamp} - ${req.method} ${req.originalUrl}`);
    
    if (req.body && Object.keys(req.body).length > 0) {
      const bodyLog = { ...req.body };
      // Ocultar campos sensibles en logs
      if (bodyLog.password) bodyLog.password = '[HIDDEN]';
      if (bodyLog.codigo) bodyLog.codigo = '[HIDDEN]';
      console.log(`   Body:`, bodyLog);
    }
    
    next();
  });
}

// Middleware de seguridad básico
app.use((req, res, next) => {
  // Headers de seguridad
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Remover header que expone tecnología
  res.removeHeader('X-Powered-By');
  
  next();
});

console.log('✅ Middlewares de seguridad configurados');

// ====================================
// RUTAS
// ====================================

// Ruta de salud básica

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🚀 API de Autenticación funcionando correctamente',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    endpoints: {
      auth: '/api/auth',
      health: '/health',
      docs: '/api/docs'
    }
  });
});

// ✅ ENDPOINT PARA DEBUG REDIS - AGREGAR DESPUÉS DE /test-ngrok
app.get('/debug-redis', async (req, res) => {
  const { getRedisClient, isRedisAvailable } = require('./utils/redis');
  
  try {
    const redisStatus = {
      available: isRedisAvailable(),
      client: !!getRedisClient(),
    };
    
    if (isRedisAvailable()) {
      const redis = getRedisClient();
      
      // Obtener todas las claves
      const allKeys = await redis.keys('*');
      const verificationKeys = await redis.keys('verification_code:*');
      const tempKeys = await redis.keys('temp_register:*');
      
      // Obtener valores de claves de verificación
      const verificationData = {};
      for (const key of verificationKeys) {
        const value = await redis.get(key);
        const ttl = await redis.ttl(key);
        verificationData[key] = { value, ttl };
      }
      
      redisStatus.keys = {
        total: allKeys.length,
        verification: verificationKeys.length,
        temp: tempKeys.length,
        allKeys: allKeys,
        verificationKeys: verificationKeys,
        verificationData: verificationData
      };
      
      // Info de Redis
      redisStatus.info = await redis.info();
    }
    
    res.json({
      success: true,
      redis: redisStatus,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

console.log('✅ Endpoint debug Redis agregado: /debug-redis');
// Ruta de salud detallada para monitoring
app.get('/health', async (req, res) => {
  const healthCheck = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
    },
    pid: process.pid,
    services: {
      database: 'unknown',
      redis: 'connected'
    }
  };

  // Verificar estado de la base de datos
  try {
    await sequelize.authenticate();
    healthCheck.services.database = 'connected';
  } catch (error) {
    healthCheck.services.database = 'disconnected';
    healthCheck.status = 'DEGRADED';
  }

  const statusCode = healthCheck.status === 'OK' ? 200 : 503;
  res.status(statusCode).json(healthCheck);
});

// Rutas de la apirr
app.use('/api/auth', authRoutes);
console.log('✅ rutas de autenticación cargadas');
// Ruta para documentación de la API
app.get('/api/docs', (req, res) => {
  res.json({
    success: true,
    message: 'Documentación de la API',
    version: '1.0.0',
    baseUrl: `http://localhost:${PORT}`,
    endpoints: {
      public: {
        'GET /': 'Información general de la API',
        'GET /health': 'Estado de salud de la API',
        'GET /api/docs': 'Esta documentación'
      },
      auth: {
        'POST /api/auth/send-code': 'perapr veriicion de whtasapp',
        'POST /api/auth/twilio/webhook': 'Webhook para Twilio',
        'POST /api/auth/verify-code': 'Verificar código SMS',
        'POST /api/auth/register': 'Completar registro de usuario',
        'POST /api/auth/login': 'Iniciar sesión',
        'POST /api/auth/refresh': 'Renovar token de acceso',
        'POST /api/auth/logout': 'Cerrar sesión',
        'POST /api/auth/forgot-password': 'Solicitar recuperación de contraseña',
        'POST /api/auth/reset-password': 'Cambiar contraseña',
        'GET /api/auth/profile': 'Obtener perfil (requiere autenticación)'
      }
    },
    examples: {
      'send-code': {
        method: 'POST',
        url: `/api/auth/send-code`,
        body: { telefono: '+573001234567' },
        response: { success: true, data: { message: 'Código enviado exitosamente', code: '123456' } }
      },
      'login': {
        method: 'POST',
        url: `/api/auth/login`,
        body: { telefono: '+573001234567', password: 'miPassword123' },
        response: { success: true, data: { message: 'Inicio de sesión exitoso', user: {} } }
      }
    }
  });
});

// ====================================
// MANEJO DE ERRORES
// ====================================
app.get('/test', (req, res) => {
  res.json({ success: true, message: 'Servidor básico funcionando' });
});



console.log('✅ Ruta de prueba básica cargada');
// ====================================
// MANEJO DE ERRORES
// ====================================

app.use((req, res, next) => {
  // En lugar de usar '*', usar una función que capture todo
  res.status(404).json({
    success: false,
    message: 'Endpoint no encontrado',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
    suggestion: 'Consulta /api/docs para ver endpoints disponibles',
    availableEndpoints: [
      'GET /',
      'GET /health',
      'GET /api/docs',
      'GET /test'
    ]
  });
});


console.log('✅ Middlewares de error configurados');



// ====================================
// INICIALIZACIÓN DEL SERVIDOR
// ====================================
async function startServer() {
  // PRIMERO: Iniciar servidor HTTP (sin esperar DB)
  const server = app.listen(PORT, HOST, () => {
    console.log('\n🚀 ====================================');
    console.log(`   🎉 API Express lista para producción!`);
    console.log(`   📍 URL: http://${HOST}:${PORT}`);
    console.log(`   🌍 Entorno: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   📊 PID: ${process.pid}`);
    console.log('   ====================================');
    console.log('\n📱 Prueba los endpoints:');
    console.log(`   🏠 Inicio: curl http://localhost:${PORT}/`);
    console.log(`   ❤️ Health: curl http://localhost:${PORT}/health`);
    console.log(`   📚 Docs: curl http://localhost:${PORT}/api/docs`);
    console.log(`   📱 Enviar código: curl -X POST http://localhost:${PORT}/api/auth/send-code -H "Content-Type: application/json" -d '{"telefono":"+573001234567"}'`);
    console.log('\n💡 ¡API lista para Flutter! 🎯\n');
  });

  server.timeout = 30000;
  server.keepAliveTimeout = 5000;
  server.headersTimeout = 6000;

  sequelize.authenticate()
    .then(async () => {
      console.log('✅ Base de datos conectada correctament');
      
      // Sincronizar modelos en desarrollo
      if (process.env.NODE_ENV === 'development') {
        try {
          await sequelize.sync({ force: false, alter: false });
          console.log('✅ Modelos sincronizados');
        } catch (syncError) {
          console.error('⚠️ Error sincronizando modelos:', syncError.message);
        }
      }
    })
    .catch(error => {
      console.error('❌ Error conectando a la base de datos:', error.message);
      console.log('⚠️ El servidor continúa funcionando sin base de datos');
      
      if (process.env.NODE_ENV === 'production') {
        console.log('🛑 Cerrando en producción por falta de BD');
        process.exit(1);
      }
    });
}



if (require.main === module) {
  startServer();
}

module.exports = app;