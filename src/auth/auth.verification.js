const Redis = require('redis');
const { generateVerificationCode } = require('./auth.util');
const smsService = require('./sms.service');
const { test } = require('../config/config');
const { getRedisClient } = require('../utils/redis');
const redisConfig = {
  socket: {
    host: process.env.REDIS_HOST || 'redis',  
    port: parseInt(process.env.REDIS_PORT) || 6379
  },

  retry_strategy: (retries) => {
    const delay = Math.min(retries * 50, 500);
    console.log(`⏳ Reintentando conexión Redis en ${delay}ms...`);
    return delay;
  }
};

console.log('🔍 Configuración Redis:', {
  host: redisConfig.socket.host,
  port: redisConfig.socket.port
});

// Crear cliente Redis
const redis = Redis.createClient(redisConfig);

redis.on('error', (err) => {
  console.error('❌ Redis Client Error:', err.message);
  console.log(`🔍 Intentando conectar a: ${redisConfig.socket.host}:${redisConfig.socket.port}`);
});

redis.on('connect', () => {
  console.log('🔌 Redis: Intentando conectar...');
});

redis.on('ready', () => {
  console.log('✅ Redis: Conectado y listo para usar');
});

redis.on('end', () => {
  console.log('⚠️ Redis: Conexión cerrada');
});

redis.on('reconnecting', () => {
  console.log('🔄 Redis: Reconectando...');
});

// Variable para rastrear el estado de conexión
let isRedisConnected = false;

async function connectRedis() {
  try {
    console.log(`🚀 Intentando conectar a Redis en ${redisConfig.socket.host}:${redisConfig.socket.port}`);
    await redis.connect();
    isRedisConnected = true;
    console.log('✅ Redis conectado exitosamente');
  } catch (error) {
    console.error('❌ Error conectando a Redis:', error.message);
    console.log('⚠️ La aplicación continuará sin Redis (códigos fijos para desarrollo)');
    isRedisConnected = false;
  }
}

// Función para verificar si Redis está disponible
function isRedisAvailable() {
  return isRedisConnected && redis.isReady;
}

class VerificationService {
  
 
  async generateAndStoreCode(incomingMessage, telefono) {
    try {
      console.log('iniciando con el envio y guardado del codigo');
      
      // formatear y validar el formato del telefono
      const formattedPhone = smsService.formatPhoneNumber(telefono);
      if(!smsService.validatePhoneFormat(formattedPhone)){
        throw new Error('Formato de telefono inválido: ' + telefono);
      }
      console.log(`Telefono formateado: ${telefono} -> ${formattedPhone}`);

      console.log('Enviando el codigo usando smsService...');
      
      // ✅ ESTE MÉTODO SE ENCARGA DE ENVIAR Y GUARDAR EN REDIS
      const smsResult = await smsService.sendVerificationCode(incomingMessage, formattedPhone);

      if(!smsResult.success){
        throw new Error(smsResult.message || smsResult.error || 'Error enviando código SMS');
      }

      console.log(`SMS enviado correctamente`, {
        provider: smsResult.provider,
        messageID: smsResult.messageId || smsResult.messageSid,
        code: smsResult.code // ✅ AHORA ESTÁ DISPONIBLE
      });

      // ✅ EL CÓDIGO YA ESTÁ GUARDADO EN REDIS POR smsService
      // Solo verificamos que se guardó correctamente
      if (isRedisAvailable() && smsResult.code) {
        const redis = getRedisClient();
        const verificationKey = `verification_code:${formattedPhone}`;
        const storedCode = await redis.get(verificationKey);
        console.log(`🔍 Verificación: Redis key ${verificationKey} = ${storedCode}`);
      }

      // ✅ CONSTRUIR RESPUESTA
      const response = {
        message: smsResult.message || 'Código enviado exitosamente',
        telefono: formattedPhone,
        expiresIn: 300,
        provider: smsResult.provider,
        timestamp: smsResult.timestamp || new Date().toISOString()
      };
      
      if (smsResult.messageSid) {
        response.messageSid = smsResult.messageSid;
      }
      
      if (process.env.NODE_ENV === 'development' && smsResult.code) {
        response.testCode = smsResult.code;
      }

      console.log(`✅ generateAndStoreCode completado con éxito para: ${formattedPhone}`);
      return response;
      
    } catch (error) {
      console.error('❌ Error generando código:', error.message);
      
      // ✅ FALLBACK PARA DESARROLLO
      if(process.env.NODE_ENV === 'development'){
        console.log("Iniciando fallback de desarrollo");
        const fallbackCode = '123456';
        const formattedPhone = smsService.formatPhoneNumber(telefono);
        
        if(isRedisAvailable()){
          const redis = getRedisClient();
          const verificationKey = `verification_code:${formattedPhone}`;
          await redis.setEx(verificationKey, 300, fallbackCode);
          console.log(`💾 Fallback guardado en Redis: ${verificationKey} = ${fallbackCode}`);
        }
        
        return {
          message: 'Código enviado exitosamente (modo desarrollo)',
          telefono: formattedPhone,
          expiresIn: 300,
          provider: 'fallback-development',
          timestamp: new Date().toISOString(),
          testCode: fallbackCode,
          status: 'development_fallback'
        };
      }
      throw error;
    }
  }
 

  async verifyCode(telefono, inputCode) {
    try {
      const formattedPhone = smsService.formatPhoneNumber(telefono); 
      
      console.log(`\n🔍 === VERIFY CODE DEBUG ===`);
      console.log(`📱 Teléfono original: ${telefono}`);
      console.log(`📱 Teléfono formateado: ${formattedPhone}`);
      console.log(`🔐 Código enviado: ${inputCode}`);
      console.log(`🔌 Redis disponible: ${isRedisAvailable()}`);
      
      if (!isRedisAvailable()) {
        console.log('⚠️ Redis no disponible, verificando código fijo');
        if (process.env.NODE_ENV === 'development' && inputCode === '123456') {
          const tempToken = 'temp_' + generateVerificationCode() + '_' + Date.now();
          console.log(`✅ Código verificado (sin Redis), tempToken: ${tempToken}`);
          return {
            message: 'Código verificado correctamente',
            tempToken,
            telefono: formattedPhone
          };
        }
        throw new Error('Redis no disponible y código incorrecto');
      }
  
      const redis = getRedisClient();
      
      if (!redis) {
        console.log('❌ Redis cliente es null');
        throw new Error('Cliente Redis no disponible');
      }
      
      // ✅ DEBUG REDIS ANTES DE BUSCAR
      console.log(`\n🔍 === REDIS DEBUG PREVIO ===`);
      console.log(`🔌 Redis cliente: ${redis ? 'OK' : 'NULL'}`);
      console.log(`🔌 Redis ready: ${redis?.isReady}`);
      
      try {
        const allKeys = await redis.keys('verification_code:*');
        console.log(`🗂️ Todas las claves en Redis: ${JSON.stringify(allKeys)}`);
        
        // ✅ VER CONTENIDO DE CADA CLAVE
        for (const key of allKeys) {
          try {
            const value = await redis.get(key);
            const ttl = await redis.ttl(key);
            console.log(`📄 ${key} = ${value} (TTL: ${ttl}s)`);
          } catch (getError) {
            console.error(`❌ Error obteniendo ${key}:`, getError.message);
          }
        }
      } catch (keysError) {
        console.error('❌ Error listando claves:', keysError.message);
      }
      console.log(`================================\n`);
      
      const phoneFormats = [
        formattedPhone,
        telefono,
        telefono.replace('whatsapp:', ''),
        telefono.replace(/\s/g, ''),
        `+51${telefono.replace('+51', '')}`, // Evitar +51+51
        telefono.replace('+51', ''), // Sin +51
        telefono.replace('+', ''), // Sin +
      ];
      
      let storedCode = null;
      let foundKey = null;
      
      for (const phoneFormat of phoneFormats) {
        try {
          const testKey = `verification_code:${phoneFormat}`;
          console.log(`🔍 Probando key: ${testKey}`);
          
          const testCode = await redis.get(testKey);
          console.log(`🔍 Resultado para ${testKey} = ${testCode}`);
          
          if (testCode) {
            storedCode = testCode;
            foundKey = testKey;
            console.log(`✅ ¡Código encontrado en ${testKey}!`);
            break;
          }
        } catch (getError) {
          console.error(`❌ Error obteniendo ${phoneFormat}:`, getError.message);
        }
      }
      
      console.log(`📋 Resultado búsqueda: key=${foundKey}, código=${storedCode}`);
      console.log(`==============================\n`);
      
      if (!storedCode) {
        throw new Error('Código expirado o no encontrado');
      }
      
      if (storedCode !== inputCode) {
        console.log(`❌ Código incorrecto: esperado=${storedCode}, recibido=${inputCode}`);
        throw new Error('Código incorrecto');
      }
      
      try {
        await redis.del(foundKey);
        console.log(`🗑️ Código limpiado: ${foundKey}`);
      } catch (delError) {
        console.error('❌ Error limpiando código:', delError.message);
      }
      
      // ✅ GENERAR TOKEN TEMPORAL
      const tempToken = 'temp_' + generateVerificationCode() + '_' + Date.now();
      const tempKey = `temp_register:${formattedPhone}`;
      
      try {
        await redis.setEx(tempKey, 600, tempToken); // 10 minutos
        console.log(`💾 Token temporal guardado: ${tempKey} = ${tempToken}`);
      } catch (setError) {
        console.error('❌ Error guardando token temporal:', setError.message);
      }
      
      console.log(`✅ Código verificado para ${formattedPhone}, tempToken: ${tempToken}`);
      
      return {
        message: 'Código verificado correctamente',
        tempToken,
        telefono: formattedPhone
      };
      
    } catch (error) {
      console.error('❌ Error verificando código:', error.message);
      throw error;
    }
  }
  async verifyTempToken(telefono, tempToken) {
    try {
      if (!isRedisAvailable()) {
        if (process.env.NODE_ENV === 'development' && tempToken.startsWith('temp_')) {
          console.log('⚠️ Redis no disponible, validando token por patrón');
          return true;
        }
        throw new Error('Servicio de verificación no disponible');
      }
      
      const redis = getRedisClient();
      const key = `temp_register:${telefono}`;
      const storedToken = await redis.get(key);
      
      console.log(`🔍 Verificando tempToken para ${telefono}: enviado=${tempToken}, guardado=${storedToken}`);
      
      if (!storedToken || storedToken !== tempToken) {
        throw new Error('Token temporal inválido o expirado');
      }
      
      return true;
      
    } catch (error) {
      console.error('❌ Error verificando token temporal:', error.message);
      throw error;
    }
  }
  

  async clearTempToken(telefono) {
    try {
      if (isRedisAvailable()) {
        const redis = getRedisClient();
        const key = `temp_register:${telefono}`;
        await redis.del(key);
        console.log(`🗑️ Token temporal limpiado para ${telefono}`);
      }
    } catch (error) {
      console.error('❌ Error limpiando token temporal:', error.message);
    }
  }
}

connectRedis();

module.exports = new VerificationService();