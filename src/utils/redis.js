const Redis = require('redis');

const redisConfig = {
  socket: {
    host: process.env.REDIS_HOST || 'redis',
    port: parseInt(process.env.REDIS_PORT) || 6379
  },
  retry_strategy: (retries) => {
    const delay = Math.min(retries * 50, 500);
    console.log(`🔄 Redis retry intento ${retries}, delay: ${delay}ms`);
    return delay;
  }
};

let redis = null;
let isRedisConnected = false;

async function createRedisConnection() {
  try {
    console.log('🔌 Iniciando conexión Redis...');
    console.log('📋 Config Redis:', redisConfig);
    
    if (!redis) {
      redis = Redis.createClient(redisConfig);
      
      redis.on('error', (err) => {
        console.error('❌ Redis Error:', err.message);
        isRedisConnected = false;
      });

      redis.on('connect', () => {
        console.log('🔌 Redis: Conectando...');
      });

      redis.on('ready', () => {
        console.log('✅ Redis: Conectado y listo');
        isRedisConnected = true;
      });

      redis.on('end', () => {
        console.log('⚠️ Redis: Conexión cerrada');
        isRedisConnected = false;
      });

      redis.on('reconnecting', () => {
        console.log('🔄 Redis: Reconectando...');
      });
    }

    if (!redis.isOpen) {
      console.log('🔗 Abriendo conexión Redis...');
      await redis.connect();
      console.log('✅ Conexión Redis establecida');
    }
    
    // ✅ PROBAR CONEXIÓN
    await redis.ping();
    console.log('🏓 Redis PING exitoso');
    
    isRedisConnected = true;
    return redis;
    
  } catch (error) {
    console.error('❌ Error conectando Redis compartido:', error.message);
    console.error('❌ Stack completo:', error.stack);
    isRedisConnected = false;
    return null;
  }
}

function getRedisClient() {
  if (!redis) {
    console.error('❌ getRedisClient: Redis cliente no inicializado');
    return null;
  }
  
  if (!redis.isReady) {
    console.error('❌ getRedisClient: Redis no está ready');
    return null;
  }
  
  return redis;
}

function isRedisAvailable() {
  const available = isRedisConnected && redis && redis.isReady;
  console.log(`🔍 isRedisAvailable: ${available} (connected: ${isRedisConnected}, redis: ${!!redis}, ready: ${redis?.isReady})`);
  return available;
}

module.exports = {
  createRedisConnection,
  getRedisClient,
  isRedisAvailable
};