const {v4: uuidv4} = require('uuid');
const {Viaje, OfertaViaje, Conductor , Usuario, Vehiculo} = require('../models');
const locationService = require('./location.service');
const websocketServer = require('../websocket/websocket.server');
const firebaseService = require('../notifications/firebase.service');
const {validateCoordinatesDistance, calculateHaversineDistance} = require('./rides.schema');
const {NotFoundError, ValidationError, ConflictError} = require('../utils/errors');
const conductor = require('../models/conductor');


class RidesService{
    constructor(){
        this.TIMEOUT_SECONDS = 300; // tiempo limite para recivir ofertas
        this.MAX_OFFERS = 6; // cantidad de ofertas
        this.SEARCH_RADIUS =  20; // Distancia del radio de busqueda en kmj
    }
  /**
   *  CREAR SOLICITUD DE VIAJE 
   */

  async createRideRequest(userId, rideData){
    try {          
        console.log(`🚗 Creando solicitud de viaje para usuario ${userId}`);
      
        
        // validamos las coordenadas y disntancias
        const distanceKm = validateCoordinatesDistance(
            rideData.origen_lat,
            rideData.origen_lng,
            rideData.destino_lat,
            rideData.destino_lng
        );

        //  verifificamos qeu el usuario no tenga viajes activos
        await this.checkUserActiveRides(userId);

        // luego buscamos conductores cercanos AL PUNTO DE RECOGIDA
        const nearbyDrivers = await locationService.findNearbyDrivers(
            rideData.origen_lat,    // ✅ Coordenadas del punto de recogida
            rideData.origen_lng,    // ✅ Coordenadas del punto de recogida  
            this.SEARCH_RADIUS      // en rango x km
        );
        
        // guardamos el viaje en la BD primero
        const viaje = await this.createViaje(userId, rideData, distanceKm);

        // ⚠️ CASO ESPECIAL: No hay conductores cerca del punto de recogida
        if (nearbyDrivers.length === 0){
            console.log(`⚠️ No hay conductores disponibles cerca del punto de recogida para viaje ${viaje.id}`);
            console.log(`📍 Punto de recogida: ${rideData.origen_lat}, ${rideData.origen_lng}`);
            
            // Cancelamos el viaje inmediatamente
            await viaje.update({
                estado: 'cancelado',
                motivo_cancelacion: 'No hay conductores disponibles cerca del punto de recogida',
                cancelado_por: 'sistema_no_drivers',  // ✅ Reducido a menos de 50 caracteres
                fecha_cancelacion: new Date()
            });

            // Notificamos al usuario via WebSocket sobre la situación
            websocketServer.notifyUser(userId, 'ride:no_drivers_available', {
                viaje_id: viaje.id,
                mensaje: 'No hay conductores disponibles cerca de tu punto de recogida en este momento',
                punto_recogida: {
                    lat: rideData.origen_lat,
                    lng: rideData.origen_lng,
                    direccion: rideData.origen_direccion
                },
                sugerencias: [
                    'Intenta aumentar el precio sugerido para atraer más conductores',
                    'Espera unos minutos e intenta nuevamente',
                    'Verifica que el punto de recogida sea accesible'
                ],
                estado: 'cancelado',
                radio_busqueda_km: this.SEARCH_RADIUS,
                puede_reintentar: true
            });

            // Push notification - DESHABILITADO TEMPORALMENTE
            console.log('🚫 Push notification omitida - Firebase deshabilitado');
            /*
            try {
                await firebaseService.sendToUser(userId, {
                    title: '😔 No hay conductores disponibles',
                    body: 'No encontramos conductores cerca de tu punto de recogida',
                    data: {
                        type: 'no_drivers_available',
                        viaje_id: viaje.id
                    }
                });
            } catch (pushError) {
                console.warn('⚠️ Error enviando push notification:', pushError.message);
            }
            */

            return {
                success: false,
                viaje: {
                    id: viaje.id,
                    estado: 'cancelado',
                    origen: {
                        lat: viaje.origen_lat,
                        lng: viaje.origen_lng,
                        direccion: viaje.origen_direccion
                    },
                    destino: {
                        lat: viaje.destino_lat,
                        lng: viaje.destino_lng,
                        direccion: viaje.destino_direccion
                    },
                    distancia_km: viaje.distancia_km,
                    precio_sugerido: viaje.precio_sugerido,
                    fecha_solicitud: viaje.fecha_solicitud,
                    fecha_cancelacion: new Date(),
                    motivo_cancelacion: 'No hay conductores disponibles cerca del punto de recogida'
                },
                conductores_notificados: 0,
                mensaje: 'No hay conductores disponibles cerca de tu punto de recogida. Puedes intentar nuevamente.',
                radio_busqueda_km: this.SEARCH_RADIUS,
                puede_reintentar: true
            };
        }

        // ✅ Si hay conductores cerca del punto de recogida, procedemos normalmente
        console.log(`✅ Encontrados ${nearbyDrivers.length} conductores cerca del punto de recogida`);
        
        // notificamos a todos los conductores cercanos
        const notificationResult = await this.notifyNearbyDrivers(nearbyDrivers, viaje);

        // tiempo de espera automàtico
        this.setupRideTimeout(viaje.id);

        console.log(`✅ Viaje ${viaje.id} creado, ${notificationResult.notifiedCount} conductores notificados`);
        return {
            viaje: {
                id:viaje.id,
                estado: viaje.estado,
                origen: {
                    lat: viaje.origen_lat,
                    lng: viaje.origen_lng,
                    direccion: viaje.origen_direccion
                },
                destino: {
                    lat: viaje.destino_lat,
                    lng: viaje.destino_lng,
                    direccion: viaje.destino_direccion
                },
                distancia_km: viaje.distancia_km,
                precio_sugerido: viaje.precio_sugerido,
                fecha_solicitud: viaje.fecha_solicitud
            },
            conductores_notificados: notificationResult.notifiedCount,
            timeout_segundos: this.TIMEOUT_SECONDS
        };
    } catch (error) {
        console.error('❌ Error creando solicitud de viaje:', error.message);
      throw error;
    }
  }
 /**
   * ✅ CREANDO VIAJE y GUARDANDO EN BD
*/
async createViaje(userId, rideData, distanceKm){
    try {
        const viajeId = uuidv4();

        // calculando tiepo estimado (aprox 25 km/k en ciudad) 
        const tiempoEstimado = Math.ceil((distanceKm / 25) * 60) // en minutos

        // calculando tarifa referencial base (opcional puede ser null tambien)
        const tarifaReferencial = this.calculateBaseFare(distanceKm);

        // guardando el tabla viaje
        const viaje = await Viaje.create({
            id: viajeId,
            usuario_id: userId,
            origen_direccion: rideData.origen_direccion || `${rideData.origen_lat}, ${rideData.origen_lng}`,
            origen_lat: rideData.origen_lat,
            origen_lng: rideData.origen_lng,
            destino_direccion: rideData.destino_direccion || `${rideData.destino_lat}, ${rideData.destino_lng}`,
            destino_lat: rideData.destino_lat,
            destino_lng: rideData.destino_lng,
            distancia_km: distanceKm,
            tiempo_estimado_minutos: tiempoEstimado,
            precio_sugerido: rideData.precio_sugerido || null, // puede ser null al principio
            tarifa_referencial: tarifaReferencial,
            estado: 'solicitado',
            fecha_solicitud: new Date()
        });
        return viaje;
        
    } catch (error) {
        console.error('❌ Error creanddo viaje en BD: ', error.message);
        throw error; 
    }
}

 /**
   *  NOTIFICANDO CONDUCTORES CERCANOS
   */
async notifyNearbyDrivers(drivers, viaje){
    try {
        console.log(`🤙 Notificando ${drivers.length} conductores cercanos`);
        
        let notifiedCount = 0;
        const notifications = [];

        for(const driver of drivers){
            try {

                // datos para la notificaciòn 
                const notificationData = {
                    viaje_id: viaje.id,
                    origen:{
                        lat: viaje.origen_lat,
                        lng: viaje.origen_lng,
                        direccion: viaje.origen_direccion
                    },
                    destino: {
                        lat: viaje.destino_lat,
                        lng: viaje.destino_lng,
                        direccion: viaje.destino_direccion
                    },
                    distancia_km: viaje.distancia_km,
                    precio_sugerido: viaje.precio_sugerido,
                    tiempo_estimado: viaje.tiempo_estimado_minutos,
                    distancia_conductor: driver.distance,
                    timeout_segundos: this.TIMEOUT_SECONDS,
                    timestamp: new Date()
                };
                // lo notificamos via websocket para que le llegue en teimpo real al pasajero
                websocketServer.notifyDriver(driver.conductorId, 'ride:new_request', notificationData);

                // push notificaton si esta fueraa de la app - DESHABILITADO TEMPORALMENTE
                console.log(`🚫 Push notification omitida para conductor ${driver.conductorId} - Firebase deshabilitado`);
                const pushResult = { success: true, disabled: true }; // Simular respuesta exitosa
                /*
                const pushResult = await firebaseService.sendToDriver(driver.conductorId, {
                    title: ' 😮‍💨 Nueva solicitud de viaje',
                    body: viaje.precio_sugerido 
                    ? `Viaje por S/. ${viaje.precio_sugerido} - ${Number(viaje.distancia_km).toFixed(1)} km`
                    : `Nuevo viaje - ${Number(viaje.distancia_km).toFixed(1)} km`,
                    data: {
                        type: 'new_ride_request',
                        viaje_id: viaje.id,
                        temeout: this.TIMEOUT_SECONDS.toString()
                    }
                });
                */

                notifications.push({
                    conductorId: driver.conductorId,
                    WebSocket: true,
                    push: pushResult.success,
                    distance: driver.distance
                });
                notifiedCount++;
                
            } catch (error) {
                console.error(`❌ Error notificando conductor ${driver.conductorId}: `, error.message);
                throw error; 
 
            }
        }
        return{
            notifiedCount,
            totalDrivers: drivers.length,
            notifications
        };
        
    } catch (error) {
        console.error('❌ Error en notificaciòn masiva: ', error.message);
        throw error; 
    }
}
  /**
   * ✅ RECIBIR OFERTA DE CONDUCTOR
   */
  async createOffer(conductorId, viajeId, offerData){
    try {
        console.log(`🏷️ Neuva oferta de viaje de ${conductorId}  para viaje: ${viajeId}`);
        
        // nos aseguramos el viaje enviado existe y tiene un estado correcto
        const viaje = await Viaje.findByPk(viajeId, {
            include: [{model: Usuario, as: 'pasajero'}]
        });

        if(!viaje){
            throw new NotFoundError('Viaje no econtrado'); 
        }
        if(!['solicitado', 'ofertas_recibidas'].includes(viaje.estado)){
            throw new ConflictError(`El viaje se ecuenra ${viaje.estado}, ya no esta diponible para ofertas`); 
        }

        // verificamos el estado del viaje como el  limite de ofertas
        const existingOffers = await OfertaViaje.count({
            where: {viaje_id: viajeId, estado: 'pendiente'}
        });

        if(existingOffers >= this.MAX_OFFERS){
            throw new ConflictError("☢️ Ya no se pude craar un nuevo viajes, ya que llegò al limite de ofertar por viaje"); 
        }

        // no asegurajmos de que el conductor no haya  ofertado antes
        const existingOffer = await OfertaViaje.findOne({
            where: {
                viaje_id: viajeId,
                conductor_id: conductorId
            }
        });
        if(existingOffer){
            throw new ConflictError('⛔️ El conductro ya ha ofertado para este viaje');
        }
        
        // obtenemos los datos del conductor
        const conductor = await Conductor.findByPk(conductorId, {
            include: [{model:Vehiculo, as: 'vehiculos', where: {activo: true}, required: false}]
        });
        if(!conductor || conductor.estado !== 'activo' || !conductor.disponible  ){
            throw new ValidationError("Conductor no disponible para ofertar"); 
        }
        
        // calculamo el tiempo estimado de llegada a la ubicacion del pasajero
        const tiempoLlegada = this.calculateArrivalTime(
                conductor.ubicacion_lat,
                conductor.ubicacion_lng,
                viaje.origen_lat,
                viaje.origen_lng
        );

        // ⭐️ Creamos la primera oferta
        const fechaExpiracion = new Date();
        fechaExpiracion.setMinutes(fechaExpiracion.getMinutes() + 8) // solo abrà 8 min para que acepte el conducto sino le enviarà que no tiene conductores disponible en su zona

        const oferta = await OfertaViaje.create({
            id: uuidv4(),
            viaje_id: viajeId,
            conductor_id: conductorId,
            tarifa_propuesta: offerData.tarifa_propuesta,
            tiempo_estimado_llegada_minutos: tiempoLlegada,
            mensaje: offerData.mensaje || null,
            fecha_expiracion: fechaExpiracion,
            estado: 'pendiente'
        })

        // notificamos al pasajero de la nueva oferta de algun conductor cercano
        const notificationData = {
            oferta_id: oferta.id,
            viaje_id: viajeId,
            conductor: {
                id: conductor.id,
                nombre: conductor.nombre_completo,
                telefono: conductor.telefono,
                Vehiculo: conductor.vehiculos?.[0] || null 
            },
            tarifa_propuesta: oferta.tarifa_propuesta,
            tiempo_llegada: tiempoLlegada,
            mensaje: oferta.mensaje,
            expira_en: 300 // esto son 5 minutos
        };

        // para notificacoin utlizamos websocker del pasajero
        websocketServer.notifyUser(viaje.usuario_id, 'ride:offer_received', notificationData);

        // tambine le envimos un push notification con firebase - DESHABILITADO TEMPORALMENTE
        console.log(`🚫 Push notification omitida para usuario ${viaje.usuario_id} - Firebase deshabilitado`);
        /*
        await firebaseService.sendToUser(viaje.usuario_id, {
            title: '🕊️ Tu oferta fue aceptada',
            body: `${conductor.nombre_completo} ofrece S/. ${oferta.tarifa_propuesta} - Llega en ${tiempoLlegada} min`,
            data: {
                type: 'offer_received',
                viaje_id: viajeId,
                oferta_id: oferta.id
            }
        });
        */
    
        // Actualizamos la oferta del viaje si es la primera oferta
        if(existingOffers === 0){
            await viaje.update({estado: 'ofertas_recibidas'});
        }

        console.log( `✅ Oferta ${oferta.id}  creada y notificada al pasajero`);

        return {
            oferta: {
                id:oferta.id,
                tarifa_propuesta: oferta.tarifa_propuesta,
                tiempo_llegada: oferta.tiempoLlegada,
                mensaje: oferta.mensaje,
                fecha_oferta: oferta.fecha_oferta,
                estado: oferta.estado
            },
            conductor: {
                id: conductor.id,
                nombre: conductor.nombre_completo
            }
        };

    } catch (error) {
        console.error('❌ Error, el conductor no pudo crear una oferta: ', error.message);
        throw error;
    }
  }
   /**
   *  EL PASAJERO ACEPTA LA OFERTA
   */
async acceptOffer(rideId, offerId, userId) {
    try {
        console.log(`🎯 Aceptando oferta: rideId=${rideId}, offerId=${offerId}, userId=${userId}`);

        // ✅ VALIDAR PARÁMETROS PRIMERO
        if (!rideId || !offerId || !userId) {
            throw new Error(`Parámetros faltantes: rideId=${rideId}, offerId=${offerId}, userId=${userId}`);
        }

        // 1. Buscar viaje
        const viaje = await Viaje.findOne({
            where: { id: rideId, usuario_id: userId },
            include: [{ model: Usuario, as: 'pasajero' }]
        });

        console.log('✅ Viaje encontrado:', viaje ? `${viaje.id} - Estado: ${viaje.estado}` : 'NO ENCONTRADO');

        if (!viaje) {
            throw new NotFoundError('Viaje no encontrado o no autorizado');
        }

        // 2. Verificar estado del viaje
        if (!['solicitado', 'ofertas_recibidas'].includes(viaje.estado)) {
            throw new ConflictError("El viaje ya no está disponible");
        }

        // 3. Buscar oferta
        const oferta = await OfertaViaje.findOne({
            where: { 
                id: offerId, 
                viaje_id: rideId, 
                estado: 'pendiente' 
            },
            include: [{
                model: Conductor,
                as: 'conductor',
                include: [{
                    model: Vehiculo, 
                    as: 'vehiculos', 
                    where: { activo: true }, 
                    required: false
                }]
            }]
        });

        if (!oferta) {
            throw new NotFoundError('🫙 No se encontraron ninguna oferta o ya no está disponible');
        }

        // 4. Verificar expiración
        if (new Date() > oferta.fecha_expiracion) {
            await oferta.update({ estado: 'expirada' });
            throw new ConflictError("La oferta ha expirado");
        }

        // ✅ 5. USAR TRANSACCIÓN CORRECTAMENTE - UNA SOLA VEZ
        const transaction = await Viaje.sequelize.transaction();

        try {
            // Actualizar viaje (SOLO UNA VEZ)
            await viaje.update({
                estado: 'aceptado',
                conductor_id: oferta.conductor_id,
                vehiculo_id: oferta.conductor.vehiculos?.[0]?.id || null,
                tarifa_acordada: oferta.tarifa_propuesta,
                fecha_aceptacion: new Date()
            }, { transaction });

            // Aceptar la oferta seleccionada
            await oferta.update({ 
                estado: 'aceptada',
                fecha_aceptacion: new Date()
            }, { transaction });

            // Rechazar todas las demás ofertas
            await OfertaViaje.update(
                { 
                    estado: 'rechazada',
                    fecha_rechazo: new Date()
                },
                {
                    where: {
                        viaje_id: rideId,
                        id: { [require('sequelize').Op.ne]: offerId },
                        estado: 'pendiente'
                    },
                    transaction
                }
            );

            // ✅ COMMIT CON PUNTO Y COMA
            await transaction.commit();

        } catch (transactionError) {
            await transaction.rollback();
            throw transactionError;
        }

        // 6. Notificaciones (fuera de la transacción)
        try {
            // Notificar al conductor aceptado
            websocketServer.notifyDriver(oferta.conductor_id, 'ride:offer_accepted', {
                viaje_id: rideId,
                oferta_id: offerId,
                pasajero: {
                    nombre: viaje.pasajero.nombre_completo,
                    telefono: viaje.pasajero.telefono
                },
                origen: {
                    lat: viaje.origen_lat,
                    lng: viaje.origen_lng,
                    direccion: viaje.origen_direccion
                },
                destino: {
                    lat: viaje.destino_lat,
                    lng: viaje.destino_lng,
                    direccion: viaje.destino_direccion
                },
                tarifa_acordada: oferta.tarifa_propuesta
            });

            // Notificar a conductores rechazadas
            const rejectedOffers = await OfertaViaje.findAll({
                where: {
                    viaje_id: rideId,
                    estado: 'rechazada'
                }
            });

            for (const rejectedOffer of rejectedOffers) {
                websocketServer.notifyDriver(rejectedOffer.conductor_id, 'ride:offer_rejected', {
                    viaje_id: rideId,
                    oferta_id: rejectedOffer.id,
                    mensaje: 'El pasajero ya seleccionó otra oferta'
                });
            }

            // Push notifications - DESHABILITADO TEMPORALMENTE
            console.log(`🚫 Push notification omitida para conductor ${oferta.conductor_id} - Firebase deshabilitado`);
            /*
            await firebaseService.sendToDriver(oferta.conductor_id, {
                title: '🎊 Oferta aceptada!!!',
                body: `Tu oferta de S/. ${oferta.tarifa_propuesta} fue aceptada`,
                data: {
                    type: 'offer_accepted',
                    viaje_id: rideId
                }
            });
            */

        } catch (notificationError) {
            console.warn('⚠️ Error en notificaciones:', notificationError.message);
        }

        console.log(`✅ Oferta ${offerId} aceptada, viaje ${rideId} iniciado`);
        
        return {
            viaje: {
                id: viaje.id,
                estado: 'aceptado',
                tarifa_acordada: oferta.tarifa_propuesta,
                fecha_aceptacion: new Date()
            },
            conductor: {
                id: oferta.conductor.id,
                nombre: oferta.conductor.nombre_completo,
                telefono: oferta.conductor.telefono,
                vehiculo: oferta.conductor.vehiculos?.[0] || null
            },
            siguiente_paso: 'El conductor se dirige a ti'
        };

    } catch (error) {
        console.error('❌ Error, el pasajero no pudo aceptar la oferta:', error.message);
        throw error;
    }
}
     /**
   *  OBTENER OFERTAS DE UN VIAJE 🚀
   */

     async getRideOffers(viajeId, userId){
        try {
            const viaje = await Viaje.findOne({
                where: {id:viajeId, usuario_id: userId}
            });

            if(!viaje){
                throw new NotFoundError('Viaje o econtrado para el usuario actual');
            };

            //Obtener ofetas con informacion del conductor

            const ofertas = await OfertaViaje.findAll({
                where: {viaje_id: viajeId},
                include: [{
                    model:Conductor,
                    as: 'conductor',
                    attributes: ['id', 'nombre_completo', 'telefono'],
                    include: [{
                        model: Vehiculo,
                        as: 'vehiculos',
                        where: {activo: true},
                        required: false,
                        attributes: ['placa', 'foto_lateral']
                    }]
                }],
                order: [['fecha_oferta', 'ASC']]
            });

            return ofertas.map(
                oferta => ({
                    id: oferta.id,
                    tarifa_propuesta: oferta.tarifa_propuesta,
                    tiempo_estimado_llegada: oferta.tiempo_estimado_llegada_minutos,
                    mensaje: oferta.mensaje,
                    estado: oferta.estado,
                    fecha_oferta: oferta.fecha_oferta,
                    conductor: {
                        id: oferta.conductor.id,
                        nombre: oferta.conductor.nombre_completo,
                        telefono: oferta.conductor.telefono,
                        vehiculo: oferta.conductor.vehiculos?.[0] || null
                    }
                })); 
        } catch (error) {
            console.error('❌ Error obteniendo ofertas: ', error.message);            
        }
     }
/**
 * ✅ OBTENER SOLICITUDES CERCANAS PARA CONDUCTOR
 */
async getNearbyRequests(conductorId, conductorLat, conductorLng) {
  try {
    console.log(`🔍 Buscando solicitudes cercanas para conductor ${conductorId}`);

    // Buscar viajes en estado 'solicitado' o 'ofertas_recibidas' cerca del conductor
    const { calculateHaversineDistance } = require('./rides.schema');

    const viajes = await Viaje.findAll({
      where: {
        estado: ['solicitado', 'ofertas_recibidas']
      },
      include: [
        {
          model: Usuario,
          as: 'pasajero',
          attributes: ['id', 'nombre_completo', 'telefono']
        },
        {
          model: OfertaViaje,
          as: 'ofertas',
          where: { conductor_id: conductorId },
          required: false // LEFT JOIN para ver si ya ofertó
        }
      ],
      order: [['fecha_solicitud', 'DESC']],
      limit: 10
    });

    // Filtrar por distancia y calcular tiempo de llegada
    const nearbyRequests = [];

    for (const viaje of viajes) {
      const distance = calculateHaversineDistance(
        conductorLat,
        conductorLng,
        viaje.origen_lat,
        viaje.origen_lng
      );

      // Solo mostrar viajes dentro del radio de búsqueda
      if (distance <= this.SEARCH_RADIUS) {
        const tiempoLlegada = this.calculateArrivalTime(
          conductorLat,
          conductorLng,
          viaje.origen_lat,
          viaje.origen_lng
        );

        nearbyRequests.push({
          viaje_id: viaje.id,
          pasajero: {
            nombre: viaje.pasajero.nombre_completo,
            telefono: viaje.pasajero.telefono
          },
          origen: {
            lat: viaje.origen_lat,
            lng: viaje.origen_lng,
            direccion: viaje.origen_direccion
          },
          destino: {
            lat: viaje.destino_lat,
            lng: viaje.destino_lng,
            direccion: viaje.destino_direccion
          },
          distancia_km: viaje.distancia_km,
          distancia_conductor: distance,
          tiempo_llegada_estimado: tiempoLlegada,
          precio_sugerido: viaje.precio_sugerido,
          tarifa_referencial: viaje.tarifa_referencial,
          fecha_solicitud: viaje.fecha_solicitud,
          ya_oferté: viaje.ofertas && viaje.ofertas.length > 0,
          total_ofertas: await OfertaViaje.count({
            where: { viaje_id: viaje.id, estado: 'pendiente' }
          })
        });
      }
    }

    // Ordenar por distancia del conductor
    nearbyRequests.sort((a, b) => a.distancia_conductor - b.distancia_conductor);

    return nearbyRequests;

  } catch (error) {
    console.error('❌ Error obteniendo solicitudes cercanas:', error.message);
    throw error;
  }
}

/**
 * ✅ OBTENER OFERTAS DEL CONDUCTOR
 */
async getDriverOffers(conductorId, options = {}) {
  try {
    const { estado, limit = 20, offset = 0 } = options;

    console.log(`📋 Obteniendo ofertas del conductor ${conductorId}`);

    const whereCondition = { conductor_id: conductorId };
    if (estado && estado !== 'todos') {
      whereCondition.estado = estado;
    }

    const { count, rows } = await OfertaViaje.findAndCountAll({
      where: whereCondition,
      include: [
        {
          model: Viaje,
          as: 'viaje',
          attributes: [
            'id', 'origen_direccion', 'destino_direccion',
            'distancia_km', 'estado', 'fecha_solicitud'
          ],
          include: [
            {
              model: Usuario,
              as: 'pasajero',
              attributes: ['nombre_completo', 'telefono']
            }
          ]
        }
      ],
      order: [['fecha_oferta', 'DESC']],
      limit,
      offset
    });

    const offers = rows.map(oferta => ({
      id: oferta.id,
      viaje_id: oferta.viaje_id,
      tarifa_propuesta: oferta.tarifa_propuesta,
      tiempo_estimado_llegada: oferta.tiempo_estimado_llegada_minutos,
      mensaje: oferta.mensaje,
      estado: oferta.estado,
      fecha_oferta: oferta.fecha_oferta,
      visto_por_usuario: oferta.visto_por_usuario,
      viaje: {
        id: oferta.viaje.id,
        origen_direccion: oferta.viaje.origen_direccion,
        destino_direccion: oferta.viaje.destino_direccion,
        distancia_km: oferta.viaje.distancia_km,
        estado: oferta.viaje.estado,
        fecha_solicitud: oferta.viaje.fecha_solicitud,
        pasajero: {
          nombre: oferta.viaje.pasajero.nombre_completo,
          telefono: oferta.viaje.pasajero.telefono
        }
      }
    }));

    return {
      data: offers,
      total: count
    };

  } catch (error) {
    console.error('❌ Error obteniendo ofertas del conductor:', error.message);
    throw error;
  }
}

  /**
   * ✅ FUNCIONES AUXILIARES
   */

// verificamos que el usuario no tenga viajes activos
async checkUserActiveRides(userId){
        const activeRide = await Viaje.findOne({
            where: {
                usuario_id: userId,
                estado: ['solicitado', 'ofertas_recibidas', 'aceptado', 'en_curso']
            },
            order: [['fecha_solicitud', 'DESC']]
        });
        
        if (activeRide){
            console.log(`🚨 VIAJE ACTIVO ENCONTRADO para usuario ${userId}:`);
            console.log(`   - ID: ${activeRide.id}`);
            console.log(`   - Estado: ${activeRide.estado}`);
            console.log(`   - Fecha solicitud: ${activeRide.fecha_solicitud}`);
            console.log(`   - Origen: ${activeRide.origen_direccion || `${activeRide.origen_lat}, ${activeRide.origen_lng}`}`);
            console.log(`   - Destino: ${activeRide.destino_direccion || `${activeRide.destino_lat}, ${activeRide.destino_lng}`}`);
            
            // Calcular tiempo transcurrido
            const tiempoTranscurrido = new Date() - new Date(activeRide.fecha_solicitud);
            const minutosTranscurridos = Math.floor(tiempoTranscurrido / (1000 * 60));
            
            // ✅ LÓGICA MEJORADA DE AUTO-CANCELACIÓN
            let shouldCancel = false;
            let cancelReason = '';
            
            if (activeRide.estado === 'solicitado' && minutosTranscurridos > 6) {
                shouldCancel = true;
                cancelReason = `Auto-cancelado por timeout - ${minutosTranscurridos} minutos sin ofertas`;
            } else if (activeRide.estado === 'ofertas_recibidas' && minutosTranscurridos > 2) {
                shouldCancel = true;
                cancelReason = `Auto-cancelado - ${minutosTranscurridos} minutos sin aceptar ofertas`;
            }
            
            if (shouldCancel) {
                console.log(`⏰ Auto-cancelando viaje ${activeRide.id} - ${cancelReason}`);
                
                await activeRide.update({
                    estado: 'cancelado',
                    motivo_cancelacion: cancelReason,
                    cancelado_por: 'sistema_timeout_auto',
                    fecha_cancelacion: new Date()
                });
                
                // Cancelar ofertas pendientes si las hay
                if (activeRide.estado === 'ofertas_recibidas') {
                    await OfertaViaje.update(
                        { 
                            estado: 'cancelada',
                            fecha_cancelacion: new Date()
                        },
                        {
                            where: {
                                viaje_id: activeRide.id,
                                estado: 'pendiente'
                            }
                        }
                    );
                }
                
                // Notificar al usuario
                try {
                    websocketServer.notifyUser(userId, 'ride:auto_cancelled', {
                        viaje_id: activeRide.id,
                        motivo: 'Viaje cancelado automáticamente por inactividad',
                        minutos_transcurridos: minutosTranscurridos,
                        puede_crear_nuevo: true
                    });
                } catch (notificationError) {
                    console.warn('⚠️ Error enviando notificación de auto-cancelación:', notificationError.message);
                }
                
                console.log(`✅ Viaje ${activeRide.id} auto-cancelado, usuario puede crear nuevo viaje`);
                return; // Permitir crear nuevo viaje
            }
            
            // Si el viaje no se puede auto-cancelar, lanzar error
            throw new ConflictError(`Ya tiene un viaje activo (${activeRide.estado}). ID: ${activeRide.id}. Complete o cancele el viaje actual antes de crear uno nuevo.`);
        }
}
     // calculadno la tarifaac base referencial
calculateBaseFare(distanceKm){
        const baseFare = 3.5; // S/, 3.50
        const perKm = 1.2; // 1.2 soles  por KM
        return Math.round((baseFare + (distanceKm * perKm)) * 100)/ 100;
     }

     // calcular tiempo de llegada del conductor
calculateArrivalTime(conductorLat, conductorLng, origenLat, origenLng){
        const distance = calculateHaversineDistance(conductorLat, conductorLng, origenLat, origenLng);
        // con una velocidad de 25 km/h
        const timeHours = distance / 25;
        return Math.ceil(timeHours * 60);
}

    setupRideTimeout(viajeId){
        console.log(`⏰ Configurando timeout de ${this.TIMEOUT_SECONDS} segundos para viaje ${viajeId}`);
        
        setTimeout(async() => {
            try {
                console.log(`🔍 Verificando timeout para viaje ${viajeId}...`);
                
                const viaje = await Viaje.findByPk(viajeId);
                
                if (!viaje) {
                    console.log(`⚠️ Viaje ${viajeId} no encontrado para timeout`);
                    return;
                }

                console.log(`📊 Estado actual del viaje ${viajeId}: ${viaje.estado}`);

                // ✅ SOLO CANCELAR SI SIGUE EN ESTADO 'solicitado'
                if (viaje.estado === 'solicitado') {
                    console.log(`⏰ TIMEOUT: Cancelando viaje ${viajeId} - sin ofertas recividas`);
                    
                    await viaje.update({
                        estado: 'cancelado',
                        motivo_cancelacion: 'Timeout - sin ofertas recividas en el tiempo límite',
                        cancelado_por: 'sistema_timeout',
                        fecha_cancelacion: new Date()
                    });

                    // Notificar al pasajero
                    websocketServer.notifyUser(viaje.usuario_id, 'ride:timeout', {
                        viaje_id: viajeId,
                        mensaje: `No se recibieron ofertas para tu viaje en ${this.TIMEOUT_SECONDS / 60} minutos. Intenta nuevamente o ajusta el precio.`,
                        sugerencia: 'Considera aumentar el precio sugerido para atraer más conductores',
                        timeout_segundos: this.TIMEOUT_SECONDS
                    });

                    // Push notification - DESHABILITADO TEMPORALMENTE
                    console.log(`🚫 Push notification de timeout omitida para usuario ${viaje.usuario_id} - Firebase deshabilitado`);
                    /*
                    try {
                        await firebaseService.sendToUser(viaje.usuario_id, {
                            title: '⏰ Viaje sin ofertas',
                            body: `No se encontraron conductores en ${this.TIMEOUT_SECONDS / 60} minutos`,
                            data: {
                                type: 'ride_timeout',
                                viaje_id: viajeId
                            }
                        });
                    } catch (pushError) {
                        console.warn('⚠️ Error enviando push notification de timeout:', pushError.message);
                    }
                    */

                    console.log(`✅ Viaje ${viajeId} cancelado por timeout`);
                    
                } else {
                    console.log(`✅ Viaje ${viajeId} ya tiene estado '${viaje.estado}' - no se cancela por timeout`);
                }

            } catch (error) {
                console.error(`❌ Error en timeout del viaje ${viajeId}:`, error.message);
            }
        }, this.TIMEOUT_SECONDS * 1000); // Convertir a milisegundos
    }

    /**
     * ✅ ELIMINAR BÚSQUEDA ACTIVA - Elimina completamente las solicitudes pendientes
     */
    async deleteActiveSearch(userId) {
        try {
            console.log(`🗑️ Eliminando búsqueda activa para usuario ${userId}`);
            
            // Buscar solicitudes pendientes del usuario
            const activeRides = await Viaje.findAll({
                where: {
                    usuario_id: userId,
                    estado: ['solicitado', 'ofertas_recibidas']
                }
            });

            if (activeRides.length === 0) {
                console.log(`ℹ️ No hay solicitudes activas para eliminar del usuario ${userId}`);
                return { deletedCount: 0 };
            }

            let deletedCount = 0;

            // Usar transacción para eliminar todo de forma atómica
            const transaction = await Viaje.sequelize.transaction();

            try {
                for (const viaje of activeRides) {
                    console.log(`🗑️ Eliminando viaje ${viaje.id} y sus ofertas...`);
                    
                    // Eliminar ofertas relacionadas primero
                    await OfertaViaje.destroy({
                        where: { viaje_id: viaje.id },
                        transaction
                    });

                    // Eliminar el viaje
                    await viaje.destroy({ transaction });
                    
                    // Notificar a conductores que tenían ofertas pendientes
                    try {
                        websocketServer.notifyDrivers('ride:cancelled_by_user', {
                            viaje_id: viaje.id,
                            mensaje: 'El usuario canceló la búsqueda'
                        });
                    } catch (notificationError) {
                        console.warn('⚠️ Error notificando cancelación:', notificationError.message);
                    }

                    deletedCount++;
                }

                await transaction.commit();
                console.log(`✅ Eliminadas ${deletedCount} solicitudes del usuario ${userId}`);

                return { deletedCount };

            } catch (transactionError) {
                await transaction.rollback();
                throw transactionError;
            }

        } catch (error) {
            console.error('❌ Error eliminando búsqueda activa:', error.message);
            throw error;
        }
    }
}

module.exports = new RidesService();
