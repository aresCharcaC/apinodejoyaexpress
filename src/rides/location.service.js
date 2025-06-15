const {getRedisClient, isRedisAvailable} = require('../utils/redis');
const {Conductor, UbicacionConductor} = require('../models');
const {generateId} = require('../auth/auth.util');
const { Op, literal } = require('sequelize');

class LocationService{
    constructor() {
        this.REDIS_KEYS = {
            DRIVER_LOCATIONS: 'driver_locations',
            DRIVER_STATUS: 'driver_status:'
        };
    }

    // ✅ esto servirà  para actualizar la ubicacion del conductor
    // en teimpo real,  para ello va ser llamada multiples veces 
    // en servidor del conductor
    async updateDriverLocation(conductorId, lat, lng){
        try{
            console.log(`🏁 Actualiando la ubicaciòn del conducotro ${conductorId}: lat: ${lat}, long: ${lng}`);

            // Validar parámetros de entrada
            if (!conductorId) {
                throw new Error("conductorId es requerido");
            }
            
            if (typeof lat !== 'number' || typeof lng !== 'number') {
                throw new Error(`Coordenadas inválidas: lat=${lat} (${typeof lat}), lng=${lng} (${typeof lng})`);
            }
            
            if (isNaN(lat) || isNaN(lng)) {
                throw new Error(`Coordenadas NaN: lat=${lat}, lng=${lng}`);
            }

            // verificamos si redis esta ddisponible
            if(!isRedisAvailable()){
                throw new Error("Redis no dispnible para ubicaciones"); 
            }
            const redis = getRedisClient();
            
            // luego verificamos si el conductor actual tiene el estado activo
            const status = await redis.get(`${this.REDIS_KEYS.DRIVER_STATUS}${conductorId}`);
            console.log(`Estado conductor en Redis: ${status}`);
            // ✅ SI NO TIENE STATUS, LO INICIALIZAMOS
             if (!status) {
                console.log(`🆕 Primera vez del conductor ${conductorId}, inicializando en Redis...`);
                await redis.set(
                    `${this.REDIS_KEYS.DRIVER_STATUS}${conductorId}`,
                    'activo',
                    'EX',
                    3600
                );
                console.log(`✅ Conductor ${conductorId} inicializado como activo`);
                } else {
                console.log(`✅ Conductor ${conductorId} ya estaba activo en Redis`);
                if (status !== 'activo') {
                    throw new Error('Conductor no está activo para enviar ubicación');
                }
                }
            // una vez asegurado los datos 
            // vamos a guardar la ubicacion en redis
            await redis.geoAdd(this.REDIS_KEYS.DRIVER_LOCATIONS, {
                longitude: lng,
                latitude: lat,
                member: conductorId
            });
            // para saver que el conducotor dejo la app, establecemo
            // que si no envia su ubciòn asumimos que ya no esta disponible sin (estado = activo)
            
            if (Math.random() < 0.1){
                await this.saveHistoricalLocation(conductorId, lat, lng);
            }
            
            await Conductor.update(
                {
                    ubicacion_lat: lat,
                    ubicacion_lng: lng
                },
                {
                    where: {id: conductorId}
                }
            )

            console.log('  ✅ Ubicacion actualizad en Redis y Postgress');
            return {
                success: true,
                lat,   
                lng,
                timestamp: new Date(),
                ttl: 1000
            };

        }catch(error){
            console.error('❌ error actualizando la ubicacion ')
            throw  error;
            
        }
    }

  /**
   * ✅ INICIALIZAR CONDUCTOR CUANDO SE ACTIVA
   * Llamado cuando conductor hace login o activa disponibilidad
   */


  async initializeDriverLocation(conductorId, lat, lng){
    try{
        console.log(`Inicilizando al conductro ${conductorId} en Redis por primera vez`);
        if(!isRedisAvailable()){
            console.warn('☢️ Redis no desponible, usando solo PostgreSql');
            return {success: false, reason: 'Redis no disponible'};
        }
        const redis = getRedisClient();

        await redis.geoAdd(this.REDIS_KEYS.DRIVER_LOCATIONS, {
            longitude: lng,
            latitude: lat,
            member: conductorId
        });
        await redis.set(
            `${this.REDIS_KEYS.DRIVER_STATUS}${conductorId}`,
            'activo',
            'EX',
            3600   
        );

        await Conductor.update(
            {
                ubicacion_lat: lat,
                ubicacion_lng: lng,
                disponible: true
            },
            {
                where : {id: conductorId}
            }
        );
        console.log(`✅ Conductor ${conductorId} inicializando Redis y PostgreSQL`);
        return {
            success: true,
            status: 'activo',
            location: {lat, lng},
            ttl: 3600
        };        
    }catch(error){
        console.error('❌Error inicilizando el conductor: ', error.message);
        throw error;
    }

  }
  /**
   * ✅ BUSCAR CONDUCTORES CERCANOS (para solicitudes de viaje)
   * Busca conductores en radio de 1km que estén (activos)
   */

  async findNearbyDrivers(lat, lng, radiusKm = 20){
    try{

        console.log(`✅ Buscando conductores cerca de ${lat} ${lng} en ${radiusKm}Km a la redonda`);
        console.log(`🔍 isRedisAvailable: ${isRedisAvailable()} (connected: ${getRedisClient()?.isReady}, redis: ${!!getRedisClient()}, ready: ${getRedisClient()?.status === 'ready'})`);

        if(!isRedisAvailable()){
            console.warn('  💀 Redis no disponible en findNeaarbyDrivers() y se esta utilizando POSTGRESQL');
            // por qeu utlizando la Bd para buca los drivers mas cercanos
            // por que cuando Redis no este disonible estonce usaremos al BD
            return await this.findNearbyDriversFromDB(lat, lng, radiusKm);
        }

        const redis = getRedisClient();
        
        // Verificar que los parámetros sean números válidos
        if (typeof lng !== 'number' || typeof lat !== 'number') {
            console.error('❌ Coordenadas inválidas:', { lat, lng });
            return await this.findNearbyDriversFromDB(lat, lng, radiusKm);
        }
        
        // ✅ CORREGIR LA API DE REDIS - usar la sintaxis correcta
        let nearbyDriverIds = [];
        try {
            // Usar GEORADIUS con la sintaxis correcta para node-redis v4+
            const results = await redis.sendCommand([
                'GEORADIUS',
                this.REDIS_KEYS.DRIVER_LOCATIONS,
                lng.toString(),
                lat.toString(),
                radiusKm.toString(),
                'km',
                'COUNT',
                '20'
            ]);
            nearbyDriverIds = results || [];
        } catch (redisError) {
            console.error('❌ Error en GEORADIUS Redis:', redisError.message);
            console.log('🔄 Fallback a PostgreSQL por error Redis');
            return await this.findNearbyDriversFromDB(lat, lng, radiusKm);
        }

        console.log(`📍 Encontrados ${nearbyDriverIds.length} conductores IDs:`, nearbyDriverIds);

        const activeDrivers = [];

        for (const conductorId of nearbyDriverIds) {
            console.log(`🔍 Verificando conductor: ${conductorId}`);

            // Verificar status en Redis
            const status = await redis.get(`${this.REDIS_KEYS.DRIVER_STATUS}${conductorId}`);
            console.log(`📊 Status en Redis: ${status}`);

            if (status === 'activo') {
                // Verificar en BD
                const conductor = await Conductor.findByPk(conductorId, {
                    attributes: ['id', 'nombre_completo', 'telefono', 'estado', 'disponible', 'ubicacion_lat', 'ubicacion_lng']
                });

                console.log(`💾 Conductor en BD:`, conductor ? {
                    id: conductor.id,
                    estado: conductor.estado,
                    disponible: conductor.disponible
                } : 'NO ENCONTRADO');

                if (conductor && conductor.estado === 'activo' && conductor.disponible === true) {
                    // Calcular distancia manualmente - Validar coordenadas antes de parseFloat
                    const conductorLat = conductor.ubicacion_lat;
                    const conductorLng = conductor.ubicacion_lng;
                    
                    if (!conductorLat || !conductorLng) {
                        console.log(`❌ Conductor ${conductorId} tiene coordenadas nulas - Lat: ${conductorLat}, Lng: ${conductorLng}`);
                        continue;
                    }
                    
                    const distance = this.calculateDistance(
                        lat, lng,
                        parseFloat(conductorLat),
                        parseFloat(conductorLng)
                    );

                    console.log(`✅ Conductor ${conductorId} es válido - Distancia: ${distance}km`);

                    activeDrivers.push({
                        conductorId: conductorId,
                        nombre: conductor.nombre_completo,
                        telefono: conductor.telefono,
                        distance: distance,
                        lat: parseFloat(conductorLat),
                        lng: parseFloat(conductorLng)
                    });
                } else {
                    console.log(`❌ Conductor ${conductorId} no es válido - Estado: ${conductor?.estado}, Disponible: ${conductor?.disponible}`);
                }
            } else {
                console.log(`❌ Conductor ${conductorId} no está activo en Redis - Status: ${status}`);
            }
        }

        console.log(`✅ ${activeDrivers.length} conductores activos encontrados`);
        return activeDrivers.sort((a, b) => a.distance - b.distance); 
    }catch(error){
        console.error('❌ Error buscando conductores cercano: ', error.message);
        return await this.findNearbyDriversFromDB(lat, lng, radiusKm);
    }
  }

/**
   * ✅ BUSCAR CONDUCTORES DESDE POSTGRESQL (fallback)
   * ESto funcion solo se ejecutta cuando la busqueda por geoRedis falle
*/

        async findNearbyDriversFromDB(lat, lng, radiusKm = 20){
        try{
            console.log(`🔄 Búsqueda fallback con PostgreSQL`);
            
            // Usar una subconsulta para evitar el error de HAVING con alias
            const results = await Conductor.sequelize.query(`
                SELECT * FROM (
                    SELECT 
                        c.id,
                        c.nombre_completo,
                        c.telefono,
                        c.ubicacion_lat,
                        c.ubicacion_lng,
                        (6371 * acos(
                            cos(radians(:lat)) *
                            cos(radians(c.ubicacion_lat)) *
                            cos(radians(c.ubicacion_lng) - radians(:lng)) +
                            sin(radians(:lat)) *
                            sin(radians(c.ubicacion_lat))
                        )) AS distance
                    FROM conductores c
                    WHERE c.estado = 'activo' 
                        AND c.disponible = true 
                        AND c.ubicacion_lat IS NOT NULL 
                        AND c.ubicacion_lng IS NOT NULL
                ) AS subquery
                WHERE distance <= :radiusKm
                ORDER BY distance ASC
                LIMIT 20
            `, {
                replacements: { lat, lng, radiusKm },
                type: Conductor.sequelize.QueryTypes.SELECT
            });

            const conductores = results.map(conductor => ({
                conductorId: conductor.id,
                nombre: conductor.nombre_completo,
                telefono: conductor.telefono,
                distance: parseFloat(conductor.distance || 0),
                lat: parseFloat(conductor.ubicacion_lat || 0),
                lng: parseFloat(conductor.ubicacion_lng || 0)
            })).filter(conductor => conductor.lat !== 0 && conductor.lng !== 0);

            console.log(`✅ Se encontraron ${conductores.length} conductores cercanos usando PostgreSQL`);
            return conductores;
            
        }catch(error){
            console.error('❌ Error en búsqueda PostgreSQL:', error.message);
            return [];
        }
    }


  /**
   * ✅ DESACTIVAR CONDUCTOR (logout o disponibilidad false)
   * ESto va ayudar al rendimiento y ya no enviarles ni pedir solicitudes
   * actualizaremos el valorr de estaddo del conductor en Redis
   */
    async deactivateDriver(conductorId){
        try{
            console.log(` ✅ Desactivando al conducto ${conductorId} `);
            if(isRedisAvailable()){
                const redis  = getRedisClient()
                // eliminando del geo set
                await redis.zRem(this.REDIS_KEYS.DRIVER_LOCATIONS, conductorId);

                // Ellimina el estado 
                await redis.del(`${this.REDIS_KEYS.DRIVER_STATUS}${conductorId}`);
            }
            console.log(` ✅ Conductor ${conductorId} eliminado del geoSet`)
            // ahora actulamos los valores de Redis a Postgres
            await Conductor.update(
                {disponible: false},
                {where: {id: conductorId}}
            );
            console.log(`✅ Conductor ${conductorId} desactvado`)
            return {success: true};
        }catch(error){
            console.log('❌ Error desaactivando al conductor: ', error.message);
            throw error;
        }
    }

     /**
   * ✅ GUARDAR UBICACIÓN HISTÓRICA (para cleanup posterior)
   */

     async saveHistoricalLocation(conductorId, lat, lng){
        try{
            await UbicacionConductor.create({
                conductor_id: conductorId,
                latitud: lat,
                longitud: lng,
                timestamp: new Date()
            });
        }catch(error){
            console.log('❌ Error guardando la ubicacion historica: ', error. message)
        }
     }

  /**
   * ✅ CLEANUP UBICACIONES HISTÓRICAS (job diario)
   */

  async cleanupHistoricalLocations(daysOld = 7){
    try{
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);
        const deletedCount = await UbicacionConductor.destroy({
            where: {
                timestamp: {
                    [require('sequelize').Op.lt]: cutoffDate
                }
            }
        });

    console.log(`🧹 Cleanup: ${deletedCount} ubicaciones históricas eliminadas`);
      return { deletedCount };
    }catch(error){
        console.error('❌ Error en eliminar el historico cadad 7 dias: ', error.message);
        throw error;
    }
  }
    /**
     * ✅ CALCULAR DISTANCIA HAVERSINE
     */
    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371; // Radio de la Tierra en km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

}
module.exports = new LocationService();
