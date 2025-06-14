const  ridesService = require('./rides.service');
const {ValidationError, NotFoundError} = require('../utils/errors');
const {validateRideRequest, validateCounterOffer} = require('./rides.schema');
const locationService = require('./location.service');
const {Conductor} = require('../models');

class RidesController{
      /**
   * ✅ POST /api/rides/request - Crear solicitud de viaje
   */
  async createRideRequest(req, res){
    try{
        console.log(' 🚖  Nueva solicitude de viaje recivida ');
        const userId = req.user.id; // para traerno el id del conducto que solo inicio sesion
        const rideData = req.body;

        // validamos datos recividos
        const {error, value} = validateRideRequest(rideData);
        if(error){
            return res.status(400).json({
                success: false,
                message: 'Datos de la solicitud son invàlidos',
                errors: error.details.map(detail => detail.message)
            });
        }
        console.log(`👮‍♂️ userId: ${userId}  rideData: ${rideData}`)
        // creamos la solicitud de viaje 
        const result = await ridesService.createRideRequest(userId, value);
        res.status(201).json({
            success: true,
            message: 'Solicitud de viaje creado correctamente',
            data: result
        });
    }catch(error){
        console.error('❌ Error en createRideRequest:', error.message);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      }); 
  }
  }
    /**
   * ✅ GET /api/rides/:rideId/offers - Ver ofertas recibidas
   */

  async getRideOffers(req, res){
    try{
        const {rideId} = req.params;
        const userId = req.user.id;
        console.log(` ✅ Consultando ofertaas del viaje ${rideId}`)

        const offers = await ridesService.getRideOffers(rideId, userId);
        res.status(200).json({
            success: true,
            data: {
                rideId,
                offers,
                totalOffers: offers.length
            }
        });
    }catch(error){
             console.error('❌ Error en getRideOffers:', error.message);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  }


/**
   * ✅ POST /api/rides/:rideId/offers/:offerId/accept - Aceptar oferta
   */
    async acceptOffer(req, res){
        try{
            const {rideId, offerId} = req.params;
            const userId = req.user.id;

            console.log(`✅ Aceptando oferta ${offerId} para viaje ${rideId}`);
            const result = await ridesService.acceptOffer(rideId, offerId, userId);
            res.status(200).json({
                success: true,
                message: 'Oferta aceptada exitosamente',
                data: result
            });
        }catch(error){
        console.error('❌ Error en acceptOffer:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
        }
    }

    

/**
   * ✅ POST /api/rides/:rideId/offers/:offerId/reject - Rechazar oferta
   */

    async rejectOffer(req, res){
        try{
            const {rideId, offerId} = req.params;
            const userId = req.user.id;
            console.log(` ✅ Rechazando oferta ${offerId} para viaje ${rideId}`);
            const result = await ridesService.rejectOffer(rideId, offerId, userId)
            res.status(200).json({
                success: true,
                message: 'Oferta rechazada exitosamente',
                data: result
            });
            
        }catch(error){
            console.error('❌ Error en rejectOffer:', error.message);
             return res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        }); 
        }

    }
/**
   * ✅ POST /api/rides/:rideId/counter-offer - creamos una nueva contraoferta
   */
  async createCounterOffer(req, res){
    try{
        const {rideId} = req.params;
        const userId = req.user.id;
        const {nuevo_precio, mensaje} = req.body;
        console.log(`🕊️ Contraoferta para viaje ${rideId}: S/. ${nuevo_precio}`);

        // validamo la contraoferta
        const {error} = validateCounterOffer({nuevo_precio, mensaje});
        if(error){
            return res.status(400).json({
                success: false,
                message: 'Datos de contraoferta invàlidos',
                errors: error.details.map(detail => detail.message)
            });
        }

        const result = await ridesService.createCounterOffer(rideId, userId, {
            nuevo_precio,
            mensaje
        });

        res.status(201).json({
            success: true,
            message: 'Contraoferta enviada correctamente',
            data: result
        });

    }catch(error){
        console.error('❌ Error en createCounterOffer:', error.message);
        return res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  }
  /**
   * ✅ DELETE /api/rides/:rideId - cancelamos la solicitud de viaje
   */

  async cancelRide(req, res){
    try{
        const {rideId} = req.params;
        const userId = req.user.id;
        const {motivo} = req.body;
        console.log(` ✅ Cancelando viaje ${rideId}`);
        const result = await ridesService.cancelRide(rideId, userId, motivo);
        res.status(200).json({
            success: true,
            message: 'Viaje canelado exitosamente',
            data: result
        })
    }catch(error){
        console.error('❌ Error en cancelRide:', error.message);
        return res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  }
/**
   * ✅ GET /api/rides/:rideId/status - Estado del viaje por usuario
   */
  async getRideStatus(req, res){
    try{
        const {rideId} = req.params;
        const userId = req.user.id;
        const status = await ridesService.getRideStatus(rideId, userId);
        res.status(200).json(
            {
                success: true,
                data: status
            }
        );
    }catch(error){
        console.error('❌ Error en getRideSttus:', error.message);
        return res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  }


 /**
   * ✅ GET /api/rides/active - Viajes activos del usuario
 */

 async getActiveRides(req, res){
    try{ 
    const userId = req.user.id;
    const activeRides = await ridesService.getActiveRides(userId);
    res.status(200).json({
        success: true,
        data: {
            rides: activeRides,
            count: activeRides.length
        }
    });
 }catch(error){
    console.error('❌ Error en getActiveRides:', error.message);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
 }
 }

  /**
   * PUT /api/rides/driver/location - Actualizar ubicación conductor (tiempo real)
 * SOLO PARA CONDUCTORES - Llamado cada 5-10 segundos desde Flutte
   */

  async updateDriverLocation(req, res) {
  try {
    console.log(`📍 Actualizando ubicación para conductor: ${req.user.conductorId}`);
    console.log('Nueva ubicación:', req.body);

    const conductorId = req.user.conductorId;
    const { lat, lng } = req.body;

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({
        success: false,
        message: 'Latitud y longitud son requeridas como números',
        ejemplo: { lat: -12.0464, lng: -77.0428 }
      });
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({
        success: false,
        message: 'Coordenadas inválidas',
        validacion: 'lat: -90 a 90, lng: -180 a 180'
      });
    }

    // Verificar si el conductor está activo y disponible
    const conductor = await Conductor.findByPk(conductorId, {
      attributes: ['id', 'estado', 'disponible']
    });

    if (!conductor) {
      return res.status(404).json({
        success: false,
        message: 'Conductor no encontrado'
      });
    }

    if (conductor.estado !== 'activo' || !conductor.disponible) {
      return res.status(403).json({
        success: false,
        message: 'Conductor no está disponible para enviar ubicación',
        estado_actual: {
          estado: conductor.estado,
          disponible: conductor.disponible
        }
      });
    }

    // ✅ AQUÍ ESTABA EL PROBLEMA - FALTABA ESTA PARTE:
    // Actualizar la ubicación en Redis y Postgres
    const result = await locationService.updateDriverLocation(conductorId, lat, lng);

    console.log(`✅ Ubicación actualizada: ${lat}, ${lng}`);

    res.status(200).json({
      success: true,
      message: 'Ubicación actualizada correctamente',
      data: {
        conductor_id: conductorId,
        coordenadas: { lat, lng },
        timestamp: result.timestamp,
        ttl_segundos: result.ttl,
        en_redis: true
      }
    });

  } catch (error) {
    console.error('❌ Error en updateDriverLocation:', error.message);

    if (error.message.includes('Redis no disponible')) {
      return res.status(503).json({
        success: false,
        message: 'Servicio de ubicación temporalmente no disponible',
        type: 'service_unavailable'
      });
    }

    if (error.message.includes('no está activo')) {
      return res.status(403).json({
        success: false,
        message: error.message,
        type: 'driver_inactive'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
}


/**
 * ✅ POST /api/rides/driver/offers - Crear oferta (conductor responde a solicitud)
 */

async createDriverOffer(req, res){
    try {
        const conductorId = req.user.conductorId;
        const {viaje_id, tarifa_propuesta, mensaje} = req.body;
        
        //validamos algunos datos recividso
        if(!viaje_id || !tarifa_propuesta){
            return res.status(400).json({
                success: false,
                message: 'viaje_id y tarifa_propuesta son requeridos',
                    ejemplo: {
                    viaje_id: "uuid-del-viaje",
                    tarifa_propuesta: 15.50,
                    mensaje: "Llego en 5 minutos"
                }    
            });
        }
        if(tarifa_propuesta <= 0 || tarifa_propuesta >500 ){
            return res.status(400).json({
                success: false,
                message: 'la tarifa propuesta deve ser mayo a S/ 0.01 y menor a S/ 500'
            })
        }

        // creamos laa oferta
        const result = await ridesService.createOffer(conductorId, viaje_id, {
            tarifa_propuesta: parseFloat(tarifa_propuesta),
            mensaje: mensaje  || null
        });

        res.status(201).json({
            success: true,
            message: 'Oferta enviada exitosamente',
            data: result
        });

        
    } catch (error) {
        console.error('❌ Error en createDriveOffer:', error.message);
        return res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
}

  /**
   * ✅ GET /api/rides/driver/nearby-requests 
   */

  async getNearbyRequests(req, res){
    try {
        const conductorId = req.user.conductorId;
        console.log(` 🧭 Buscando solicitdes ceranas para conductor ${conductorId} `);
        
        const conductor = await Conductor.findByPk(conductorId, {
            attributes: ['id', 'ubicacion_lat', 'ubicacion_lng', 'estado', 'disponible']
        });

        if(!conductor){
            return res.status(404).json({
                success: false,
                message: 'Conductor no econrado'
            })
        }
        if (!conductor.ubicacion_lat || !conductor.ubicacion_lng ){
            return res.status(400).json({
                success: false,
                message: 'No se envio las coordenadas del conductor, Actualiza tu ubicacion priemero',
                action: 'PUT api/rides/driver/location'
            });
        }
        if(conductor.estado !== 'activo' || !conductor.disponible){
            return res.status(403).json({
                success: true,
                message: 'Conductor no esta disponilbe para recivir solicitudes',
                estado_actual: {
                    estado: conductor.estado,
                    disponible: conductor.disponible
                }
            });
        }
        // despues de validar los campos de los usuario, empezamo 
        // a buscar viajes cercanos
        const nearbyRequests = await ridesService.getNearbyRequests(
            conductorId,
            conductor.ubicacion_lat, conductor.ubicacion_lng
        )

        res.status(200).json({
        success: true,
        data: {
          conductor_location: {
            lat: conductor.ubicacion_lat,
            lng: conductor.ubicacion_lng
          },
          nearby_requests: nearbyRequests,
          count: nearbyRequests.length,
          radius_km: 1
        }
      });
        

    } catch (error) {
        console.error('❌ Erro obteniendo las solicitdes cercanas', error.message);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
        
    }
  }
  /**
   * ✅ GET /api/rides/driver/my-offers historial
   */
  async getDriverOffers(req, res){
    try {
        const conductorId = req.user.conductorId;
        const {estado, limit = 20, offset = 0} = req.query;
        console.log(`Obteneindo ofertas del conductor ${conductorId}`);
        const offers = await ridesService.getDriverOffers(
            conductorId, {
                estado, 
                limit: parseInt(limit),
            offset: parseInt(offset)
             }
        )
        
        res.status(200).json({
            success: true,
            data: {
                conductor_id: conductorId,
                offers: offers.data,
                pagination: {
                    total: offers.total,
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    has_more: offers.total > (parseInt(offset) + parseInt(limit))
                },
                filters: {
                    estado: estado || 'todos'
                }
            }
        });
    } catch (error) {
        console.error('❌ Error obteniendo oferta ddle conductor', error.message);
      return res.status(500).json({
        success: false,
        message: 'Error obteniendo oferta ddle conductor',
        error: error.message
      });
        
    }
  }

async debugRedisDrivers(req, res) {
  try {
    const { lat, lng, radius = 1 } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: 'Parámetros lat y lng requeridos',
        ejemplo: '/api/rides/debug-redis-drivers?lat=-16.42456&lng=-71.52288&radius=1'
      });
    }

    const { getRedisClient, isRedisAvailable } = require('../utils/redis');

    if (!isRedisAvailable()) {
      return res.status(503).json({
        success: false,
        message: 'Redis no disponible'
      });
    }

    const redis = getRedisClient();

    // 1. Ver todos los conductores en el geoset
    const allDrivers = await redis.geoPos('driver_locations', ['ba9e34ce-83b4-4846-89a4-44ff4b5ed87d']);
    
    // 2. Ver status del conductor específico
    const driverStatus = await redis.get('driver_status:ba9e34ce-83b4-4846-89a4-44ff4b5ed87d');
    
    // 3. Buscar con geoRadius
    const nearbyDrivers = await redis.geoRadius(
      'driver_locations',
      { longitude: parseFloat(lng), latitude: parseFloat(lat) },
      parseFloat(radius),
      'km',
      {
        WITHCOORD: true,
        WITHDIST: true,
        COUNT: 20
      }
    );

    // 4. Ver conductor en BD
    const { Conductor } = require('../models');
    const conductorDB = await Conductor.findByPk('ba9e34ce-83b4-4846-89a4-44ff4b5ed87d');

    res.json({
      success: true,
      debug: {
        busqueda: {
          lat: parseFloat(lat),
          lng: parseFloat(lng),
          radius: parseFloat(radius)
        },
        redis: {
          conductor_position: allDrivers,
          conductor_status: driverStatus,
          nearby_drivers: nearbyDrivers,
          nearby_count: nearbyDrivers.length
        },
        database: {
          conductor: conductorDB ? {
            id: conductorDB.id,
            estado: conductorDB.estado,
            disponible: conductorDB.disponible,
            ubicacion_lat: conductorDB.ubicacion_lat,
            ubicacion_lng: conductorDB.ubicacion_lng
          } : null
        }
      }
    });

  } catch (error) {
    console.error('❌ Error debug Redis:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}


// En rides.controller.js - MÉTODO PARA FORZAR SYNC

async debugSyncDriver(req, res) {
  try {
    const conductorId = 'ba9e34ce-83b4-4846-89a4-44ff4b5ed87d';
    const lat = -16.42531;
    const lng = -71.51929;

    const { Conductor } = require('../models');

    // 1. Actualizar en BD
    await Conductor.update(
      {
        estado: 'activo',
        disponible: true,
        ubicacion_lat: lat,
        ubicacion_lng: lng
      },
      {
        where: { id: conductorId }
      }
    );

    // 2. Forzar en Redis
    await locationService.updateDriverLocation(conductorId, lat, lng);

    res.json({
      success: true,
      message: 'Conductor sincronizado',
      data: {
        conductorId,
        ubicacion: { lat, lng },
        estado: 'activo',
        disponible: true
      }
    });

  } catch (error) {
    console.error('❌ Error sync conductor:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}



/**
 * ✅ POST /api/rides/driver/offers/:offerId/accept-counter - Conductor acepta contraoferta del pasajero
 */
  async acceptCounterOffer(req, res){
    try {
       const {offerId} = req.params;
       const conductorId = req.user.conductorId;

       console.log(`✅ Conductor ${conductorId} acepta contraoferta para nueva oferta ${offerId}`);

       const result = await ridesService.acceptDriverCounterOffer(offerId, conductorId);
       
       res.status(200).json({
        success: true,
        message: 'Contraoferta aceptada exitosamente',
        data: result
       });
      
    } catch (error) {
      console.error('❌ Error en acceptCounterOffer:', error.message);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      }) 
    }
  }   

/**
 * ✅ POST /api/rides/driver/offers/:offerId/reject-counter - Conductor rechaza contraoferta
 */
  async rejectCounterOffer(req, res){
    try {

      const {offerId} = req.params;
      const conductorId = req.user.conductorId;
      const {motivo} = req.body;
      console.log(`❌ Conductor ${conductorId} rechaza contraoferta para oferta ${offerId}`);
      const result = await ridesService.rejectDriverCounterOffer(offerId, conductorId, motivo);
      res.status(200).json({
      success: true,
      message: 'Contraoferta rechazada',
      data: result
    });

    } catch (error) {
      console.error('❌ Error en rejectCounterOffer: ', error.message);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  }
/**
 * ✅ POST /api/rides/driver/offers/:offerId/counter-offer - Conductor hace contraoferta
 */
async createDriverCounterOffer(req, res){
  try {
    const {offerId} = req.params;
    const conductorId = req.user.conductorId;
    const {nueva_tarifa, mensaje} = req.body;

    // validamos las tarifaas recividas
    if(!nueva_tarifa || nueva_tarifa <= 0){
      return res.status(400).json({
        success: true,
        message: 'nueva_tarifa es requerida y deve ser mayo a 0',
        ejemplo: {
          nueva_tarifa : 18.23,
          mensaje: "Mi precio final es S/. 18.23"
        }
      })
    }
    console.log( `✅ Conductor ${conductorId} hace contraoferta de: S/- ${nueva_tarifa}`);
   
    // Conducto crae una nueva contraoferta

    const result = await ridesService.createDriverCounterOffer(offerId, conductorId, {
      nueva_tarifa: parseFloat(nueva_tarifa),
      message: mensaje || null
    });

    res.status(201).json({
      success: true,
      message: 'Contraoferta enviada al pasajero',
      data: result
    });

    
    
    
  } catch (error) {
    console.error('❌ Error en createDriverCounterOffer', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message  // ⛔️
    })
  }
}

  /**
   * ✅ Manejo centralizado de errores
   */
  handleError(res, error){
    console.log(' ❌ Error  en rides controller: ', error.message);

    if(error instanceof ValidationError){
        return res.status(400).json({
            success: false,
            message: error.message,
            type: 'validation_error'
        });
    }
    if (error instanceof NotFoundError){
        return res.status(404).json({
            success: false,
            message: error.message,
            type: 'not_found_error'
        });
    }

    // error no manejado

    res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        type: 'internal_error'
    });
  }
}

module.exports = new RidesController();