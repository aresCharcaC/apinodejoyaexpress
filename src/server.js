const express = require('express');
const http = require('node:http');
const cookieParser = require('cookie-parser');
const cors = require('cors');
require('dotenv').config();

const websocketServer = require('./websocket/websocket.server');

const authRoutes = require('./auth/auth.routes');
const conductorAuthRoutes = require('./conductor-auth/conductor-auth.routes');
const rideRoutes = require('./rides/rides.routes') // para pasajeros
const driverRoutes = require('./rides/drivers.routes') // para conductor

const { sequelize } = require('./models');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const app = express();

// ✅ CREAR SERVIDOR HTTP 
const httpServer = http.createServer(app);

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
    
    if (!origin) {
      console.log('✅ Request sin origin permitido');
      return callback(null, true);
    }
    
    if (origin.includes('ngrok')) {
      console.log('✅ Request de ngrok permitido:', origin);
      return callback(null, true);
    }
    
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
    '*'
  ],
  exposedHeaders: ['set-cookie'],
  optionsSuccessStatus: 200,
  preflightContinue: false
}));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, ngrok-skip-browser-warning');
  
  if (req.get('host') && req.get('host').includes('ngrok')) {
    console.log('🔧 Request vía ngrok detectado');
    console.log('📥 Headers recibidos:', req.headers);
  }
  
  if (req.method === 'OPTIONS') {
    console.log('✅ Preflight request manejado');
    res.status(200).end();
    return;
  }
  
  next();
});

console.log('✅ Middleware ngrok configurado');

app.use(cookieParser());
console.log('✅ Cookie parser configurado');

// Middleware para logs en desarrollo
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`📝 ${timestamp} - ${req.method} ${req.originalUrl}`);
    
    if (req.body && Object.keys(req.body).length > 0) {
      const bodyLog = { ...req.body };
      if (bodyLog.password) bodyLog.password = '[HIDDEN]';
      if (bodyLog.codigo) bodyLog.codigo = '[HIDDEN]';
      console.log(`   Body:`, bodyLog);
    }
    
    next();
  });
}

// Middleware de seguridad básico
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.removeHeader('X-Powered-By');
  
  next();
});

// ====================================
// RUTAS
// ====================================

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🚀 API de Autenticación funcionando correctamente',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    endpoints: {
      auth: '/api/auth',
      drivers: '/api/conductor-auth',
      rides: '/api/rides',
      driversRides: '/api/rides/driver',
      health: '/health',
      docs: '/api/docs'
    }
  });
});

app.get('/debug-redis', async (req, res) => {
  const { getRedisClient, isRedisAvailable } = require('./utils/redis');
  
  try {
    const redisStatus = {
      available: isRedisAvailable(),
      client: !!getRedisClient(),
    };
    
    if (isRedisAvailable()) {
      const redis = getRedisClient();
      const allKeys = await redis.keys('*');
      const verificationKeys = await redis.keys('verification_code:*');
      const tempKeys = await redis.keys('temp_register:*');
      
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
      redis: 'connected',
      websocket: 'connected' 
    }
  };

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


app.use('/api/auth', authRoutes);
app.use('/api/conductor-auth', conductorAuthRoutes);
app.use('/api/rides/driver', driverRoutes); 
app.use('/api/rides', rideRoutes);

// FCM Token registration
app.post('/api/fcm/register', async (req, res) => {
  try {
    const { user_type, fcm_token } = req.body;
    const userId = req.user?.id || req.user?.conductorId;

    if (!user_type || !fcm_token || !userId) {
      return res.status(400).json({
        success: false,
        message: 'user_type, fcm_token y autenticación son requeridos',
        ejemplo: {
          user_type: 'usuario',
          fcm_token: 'token-fcm-del-dispositivo'
        }
      });
    }

    const firebaseService = require('./notifications/firebase.service');
    await firebaseService.registerToken(user_type, userId, fcm_token);

    res.status(200).json({
      success: true,
      message: 'Token FCM registrado correctamente',
      data: {
        user_type,
        user_id: userId,
        registered_at: new Date()
      }
    });

  } catch (error) {
    console.error('❌ Error registrando token FCM:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error registrando token FCM'
    });
  }
});

console.log('✅ Rutas de autenticación cargadas:');
console.log('   👥 Pasajeros: /api/auth');
console.log('   🚗 Conductores: /api/conductor-auth');
console.log('   🚀 Viajes para pasajero: /api/rides');
console.log('   🚖 Viajes para conductores: /api/rides/driver');

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
        'POST /api/auth/send-code': 'Preparar verificación de WhatsApp',
        'POST /api/auth/twilio/webhook': 'Webhook para Twilio',
        'POST /api/auth/verify-code': 'Verificar código SMS',
        'POST /api/auth/register': 'Completar registro de usuario',
        'POST /api/auth/login': 'Iniciar sesión',
        'POST /api/auth/refresh': 'Renovar token de acceso',
        'POST /api/auth/logout': 'Cerrar sesión',
        'POST /api/auth/forgot-password': 'Solicitar recuperación de contraseña',
        'POST /api/auth/reset-password': 'Cambiar contraseña',
        'GET /api/auth/profile': 'Obtener perfil (requiere autenticación)'
      },
      rides: {
        'POST /api/rides/request': 'Solicitar viaje (pasajero)',
        'GET /api/rides/:rideId/offers': 'Ver ofertas de viaje',
        'POST /api/rides/:rideId/offers/:offerId/accept': 'Aceptar oferta',
        'POST /api/rides/driver/offers': 'Crear oferta (conductor)',
        'GET /api/rides/driver/nearby': 'Ver viajes cercanos (conductor)'
      }
    }
  });
});

app.get('/test', (req, res) => {
  res.json({ success: true, message: 'Servidor básico funcionando' });
});

// Manejo de rutas no encontradas
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint no encontrado',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
    suggestion: 'Consulta /api/docs para ver endpoints disponibles'
  });
});

// ====================================
// INICIALIZACIÓN DEL SERVIDOR
// ====================================
async function startServer() {
  try {
    // ✅ INICIALIZAR WEBSOCKET ANTES DE EMPEZAR EL SERVIDOR
    console.log('🔌 Inicializando WebSocket server...');
    websocketServer.initialize(httpServer);
    console.log('✅ WebSocket server inicializado correctamente');
    
    // ✅ INICIAR SERVIDOR HTTP
    const server = httpServer.listen(PORT, HOST, () => {
      console.log('\n🚀 ====================================');
      console.log(`   🎉 API Express lista para producción!`);
      console.log(`   📍 URL: http://${HOST}:${PORT}`);
      console.log(`   🌍 Entorno: ${process.env.NODE_ENV || 'development'}`);
      console.log(`   📊 PID: ${process.pid}`);
      console.log(`   🔌 WebSocket: ACTIVO`);
      console.log('   ====================================');
      console.log('\n📱 Prueba los endpoints:');
      console.log(`   🏠 Inicio: curl http://localhost:${PORT}/`);
      console.log(`   ❤️ Health: curl http://localhost:${PORT}/health`);
      console.log(`   📚 Docs: curl http://localhost:${PORT}/api/docs`);
      console.log('\n💡 ¡API lista para Flutter! 🎯\n');
    });

    server.timeout = 30000;
    server.keepAliveTimeout = 5000;
    server.headersTimeout = 6000;

    // ✅ CONECTAR BASE DE DATOS (DESPUÉS DE INICIAR SERVIDOR)
    try {
      await sequelize.authenticate();
      console.log('✅ Base de datos conectada correctamente');
      
      if (process.env.NODE_ENV === 'development') {
        await sequelize.sync({ force: false, alter: false });
        console.log('✅ Modelos sincronizados');
      }
    } catch (error) {
      console.error('❌ Error conectando a la base de datos:', error.message);
      console.log('⚠️ El servidor continúa funcionando sin base de datos');
      
      if (process.env.NODE_ENV === 'production') {
        console.log('🛑 Cerrando en producción por falta de BD');
        process.exit(1);
      }
    }

  } catch (error) {
    console.error('❌ Error iniciando servidor:', error.message);
    process.exit(1);
  }
}

// ✅ MANEJO DE ERRORES NO CAPTURADOS
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// ✅ MANEJO DE CIERRE GRACEFUL
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  httpServer.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  httpServer.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

if (require.main === module) {
  startServer();
}

module.exports = app;