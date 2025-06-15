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

            // Push notification
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

                // push notificaton si esta fueraa de la app
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

        // tambine le envimos un push notification con firebase 
        await firebaseService.sendToUser(viaje.usuario_id, {
            title: '🕊️ Tu oferta fue aceptada',
            body: `${conductor.nombre_completo} ofrece S/. ${oferta.tarifa_propuesta} - Llega en ${tiempoLlegada} min`,
            data: {
                type: 'offer_received',
                viaje_id: viajeId,
                oferta_id: oferta.id
            }
        });
    
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

            // Push notifications
            await firebaseService.sendToDriver(oferta.conductor_id, {
                title: '🎊 Oferta aceptada!!!',
                body: `Tu oferta de S/. ${oferta.tarifa_propuesta} fue aceptada`,
                data: {
                    type: 'offer_accepted',
                    viaje_id: rideId
                }
            });

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
            
            // Si el viaje está en estado 'solicitado' por más de 10 minutos, lo cancelamos automáticamente
            const tiempoTranscurrido = new Date() - new Date(activeRide.fecha_solicitud);
            const minutosTranscurridos = Math.floor(tiempoTranscurrido / (1000 * 60));
            
            if (activeRide.estado === 'solicitado' && minutosTranscurridos > 10) {
                console.log(`⏰ Auto-cancelando viaje ${activeRide.id} - ${minutosTranscurridos} minutos sin respuesta`);
                
                await activeRide.update({
                    estado: 'cancelado',
                    motivo_cancelacion: `Auto-cancelado por timeout - ${minutosTranscurridos} minutos sin ofertas`,
                    cancelado_por: 'sistema_timeout_auto',
                    fecha_cancelacion: new Date()
                });
                
                // Notificar al usuario
                try {
                    websocketServer.notifyUser(userId, 'ride:auto_cancelled', {
                        viaje_id: activeRide.id,
                        motivo: 'Viaje cancelado automáticamente por inactividad',
                        minutos_transcurridos: minutosTranscurridos
                    });
                } catch (notificationError) {
                    console.warn('⚠️ Error enviando notificación de auto-cancelación:', notificationError.message);
                }
                
                console.log(`✅ Viaje ${activeRide.id} auto-cancelado, usuario puede crear nuevo viaje`);
                return; // Permitir crear nuevo viaje
            }
            
            throw new ConflictError(`Ya tiene un viaje activo (${activeRide.estado}). ID: ${activeRide.id}. Puedes completar o cancelar el viaje actual`);
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
                        fecha_cancelacion: new Date() //
                    });

                    // Notificar al pasajero
                    websocketServer.notifyUser(viaje.usuario_id, 'ride:timeout', {
                        viaje_id: viajeId,
                        mensaje: `No se recibieron ofertas para tu viaje en ${this.TIMEOUT_SECONDS / 60} minutos. Intenta nuevamente o ajusta el precio.`,
                        sugerencia: 'Considera aumentar el precio sugerido para atraer más conductores',
                        timeout_segundos: this.TIMEOUT_SECONDS
                    });

                    // Push notification
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

                    console.log(`✅ Viaje ${viajeId} cancelado por timeout`);
                    
                } else {
                    console.log(`✅ Viaje ${viajeId} ya tiene estado '${viaje.estado}' - no se cancela por timeout`);
                }

            } catch (error) { // ✅ CORREGIR: era "errorr"
                console.error(`❌ Error en timeout del viaje ${viajeId}:`, error.message);
            }
        }, this.TIMEOUT_SECONDS * 1000); // Convertir a milisegundos
    }

     async cancelRide(rideId, userId, motivo){
        try{
            console.log(`🙀 Cancelando el viaje ${rideId} por el pasajero ${userId}`);
        
            // Bucamo el biaje en BD y vemos si pertenece a este usuario
            const viaje = await Viaje.findOne({
                where: {
                    id: rideId,
                    usuario_id: userId
                },
                include: [
                    {
                        model: Usuario,
                        as: 'pasajero',
                        attributes: ['nombre_completo', 'telefono']
                    },
                    {
                        model: Conductor,
                        as: 'conductor',
                        attributes: ['id', 'nombre_completo', 'telefono'],
                        require: false
                    }
                ]
            });
            // pequeña validacion de la existencia del viaje
            if(!viaje){
                throw new NotFoundError("Viaje no econtrado o no autorizado"); 
            }

            // verificamos que el viaje se pueda cancelar excepto cuadno este en ruta
            const estadosPermitidos = ['solicitado', 'ofertas_recibidas', 'aceptado'];
            if(!estadosPermitidos.includes(viaje.estado)){
                throw new ConflictError(`No se puede cancelar el viaje en estado: ${viaje.estado}`); 
            }
            
            // usar transaction para garantizar la consistencia
            const transaction = await Viaje.sequelize.transaction();
            
            const estadoOriginal = viaje.estado;

            try {
                // Actulizamos el viaje como cancelado
                await viaje.update({
                    estado: 'cancelado',
                    motivo_cancelacion: motivo || 'Cancelado por el pasajero',
                    cancelado_por: 'pasajero',
                    fecha_cancelacion: new Date()
                }, {transaction})
                
                // Si avìa ofertas pendientes asociadas a este viaje, marcamos como cancelado
                if(['ofertas_recibidas', 'aceptado'].includes(estadoOriginal)){
                    await OfertaViaje.update(
                        {
                            estado: 'cancelado',
                            fecha_cancelacion: new Date()
                        },
                        {
                            where: {
                                viaje_id: rideId,
                                estado: ['pendiente', 'aceptado']
                            },
                            transaction
                        }
                    );
                }
                await transaction.commit();
                
            } catch (transactionError) {
                await transaction.rollback();
                throw transactionError; 
            }

            // luego haremos las notificaciones correspondientes a pasajeros
            try {
                // si el viaje estaba aceptado notificar al conductor
                if(estadoOriginal === 'aceptado' && viaje.conductor){

                    // con websocket
                    websocketServer.notifyDriver(viaje.conductor.id, 'ride:canceled_by_passenger', {
                        viaje_idd: rideId,
                        pasajero: {
                            nombre: viaje.pasajero.nombre_completo,
                            telefono: viaje.pasajero.telefono
                        },
                        motivo: motivo || 'Cancelado por el pasajero',
                        timestamp: new Date()
                    });

                    // Push notifications con firebase

                    await firebaseService.sendToDriver(viaje.conductor.id, {
                        title: '😡 Viaje cacelado',
                        body: `El pasajero ${viaje.pasajero.nombre_completo} cancelò el viaje`,
                        data: {
                            type: 'ride_cancelled',
                            viaje_id: rideId,
                            motivo: motivo || 'Cancelado por el pasajero'
                        }
                    });
                }
                if(estadoOriginal === 'ofertas_recibidas'){
                    const ofertasPendientes = await OfertaViaje.findAll({
                        where: {
                            viaje_id: rideId,
                            estado: 'cancelada'
                        },
                        attributes: ['conductor_id']
                    });
                    for (const oferta of ofertasPendientes){
                        // websocket 
                        websocketServer.notifyDriver(oferta.conductor_id, 'ride:cancelled_by_passenger', {
                            viaje_id: rideId,
                            mensaje: 'El pasajero cancelo la solitud de viaje'
                        });

                        // push notificatoins whit firebase
                        await firebaseService.sendToDriver(oferta.conductor_id, {
                            title: 'Solicitud cancelada',
                            body: 'El pasajero cancelò la solicitud de viaje',
                            data: {
                                type: 'ride_cancelled',
                                viaje_id: rideId
                            }
                        });
                    }
                }
                
            } catch (notificationError) {
                console.warn(' ☢️ Error enviando notificacines de cancelacion:', notificationError.message)                
            }
            console.log(`✅ Viaje ${rideId} cancelado exitosamente`);

            return {
                viaje: {
                    id: viaje.id,
                    estado: 'cancelado',
                    motivo_cancelacion: motivo || 'Cancelado  por el pasajero',
                    fecha_cancelacion: new Date(),
                    conductores_notificado: viaje.conductor ? true: false
                },
                mensaje: 'Viaje cancelado exitosamente'
            };
        }catch(error){
            console.error(' ❌ Ocurrio un en cancelRide: ', error.message);
            throw error;
             
        }
     }

     async rejectedOffer(rideId, offerId, userId){
        try {
            console.log(` 🙅‍♂️ Rechazando oferta ${offerId}, para viaje ${rideId}`);

            // verificamos qeu el viaje pertenece al usuario
            const viaje = await Viaje.findOne({
                where: {
                    id: rideId,
                    usuario_id: userId
                }
            });

            if(!viaje){
                throw new NotFoundError("NO se econtraron viajes que cancelar"); 
            }

            // verificaamos que la oferta solo este en estado ofertas recividas
            if(!['ofertas_recibidas'].includes(viaje.estado)){
                throw new ConflictError("No se puede rechazr ofertas si la ofeta no esta en estado {ofertas_recibidas}");         
            }
            
            // buscamso las ofertas a cancelar
            const oferta = await OfertaViaje.findOne({
                where: {
                    id: offerId,
                    viaje_id: rideId,
                    estado: 'pendiente'
                },
                include: [{
                    model: Conductor,
                    as: 'conductor',
                    attributes: ['id', 'nombre_completo']
                }]
            });
            if(!oferta){
                throw new NotFoundError("Ofert no econtada o ya no esta diponible"); 
            }

            // una vez encontrada, actulizamos la oferta como rezada
            await oferta.update({
                estado: 'rechazada',
                fecha_rechazo: new Date()
            });

            // verificamos si todavìa hay ofertar aparte de lo qeu se rechazo ahora
            const ofertasPendientes = await OfertaViaje.count({
                where: {
                    viaje_id: rideId,
                    estado: 'pendiente'
                }
            });

            // si no hay ofertas, cabiamos el estado del viaje en solicitado par que otros conductores puedan seguir ofertar
           if (ofertasPendientes === 0){
            await Viaje.update({
                estado: 'solicitado'
            });
           }

           // notificamos al conductor rechazada

          try {
            // Con websocket
            websocketServer.notifyDriver(oferta.conductor_id, 'ride:offer_rejected', {
                viaje_id: rideId,
                oferta_id: offerId,
                message: 'Tu Oferta fue rechazada por el pasajero'
            });

            // con push notifications
            await firebaseService.sendToDriver(oferta.conductor_id, {
                title: '😡 Oferta rechazada',
                body: 'El pasajero rechazò tu oferta',
                data: {
                    type: 'offer_rejected',
                    viaje_id: rideId,
                    oferta_id: offerId
                }
            });
            
           } catch (notificationError) {
                console.warn(' ☢️ Error enviado notificaiones al conducto rechazada: ', notificationError.message) 
           }
           console.log(`✅ Oferta ${offerId} rechazada`);

           return {
            oferta: {
                id: offerId,
                estado: 'rechazada',
                conductor: oferta.conductor.nombre_completo
            },
            viaje: {
                id: rideId,
                ofertas_pendientes: ofertasPendientes,
                estado: ofertasPendientes > 0 ? 'ofertas_recibidas': 'solicitado' 
            },
           };


        } catch (error) {
            console.error('❌ Error rechazada oferta: ', error.message) 
        }
     }

     async getRideStatus(rideId, userId){
        try {
            console.log(`Consultando estado del viaje ${rideId}`);
            const viaje = await Viaje.findOne({
                where: {
                    id: rideId,
                    usuario_id: userId
                },
                include: [
                    {
                        model: Usuario,
                        as: 'pasajero',
                        attributes: ['nombre_completo', 'telefono']
                    },
                    {
                        model: Conductor,
                        as: 'conductor',
                        attributes: ['id', 'nombre_completo', 'telefono', 'ubicacion_lat', 'ubicacion_lng'],
                        required: false,
                        include: [{
                            mode: Vehiculo,
                            as: 'vehiculos',
                            where: {active: true},
                            required: false,
                            attributes: ['placa', 'marca', 'modelo', 'color']
                        }]
                    },
                    {
                        model: OfertaViaje,
                        as: 'ofertas',
                        where: {estado: ['pendiente', 'aceptada']},
                        required: false,
                        include: [{
                            model: Conductor,
                            as: 'conductor',
                            attributes: ['nombre_completo']
                        }]
                    }
                ]
            });

            // pequeña validacion 
            if(!viaje){
                throw new NotFoundError('Viaje no econtrado');
            }

            const response = {
                viaje: {
                    id: viaje.id,
                    estado: viaje.estado,
                    origin: {
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
                        tarifa_acordada: viaje.tarifa_acordada,
                        fecha_solicitud: viaje.fecha_solicitud,
                        fecha_aceptacion: viaje.fecha_aceptacion,
                        fecha_cancelacion: viaje.fecha_cancelacion,
                        motivo_cancelacion: viaje.motivo_cancelacion
                }
            };

            // informamos al conductro de acerdo al estado del viaje
            switch(viaje.estado){
                case 'solicitado':
                    response.mensaje = 'Acualmente buscando conductores disponibles...';
                    response.ofertas_recibidas = 0;
                    break;
                case 'ofertas_recibidas':
                    response.mensaje = 'Actuamente tienes ofertas recividas paa tu viaje';
                    response.ofertas_pendientes = viaje.ofertas || [],
                    response.total_ofertas = viaje.ofertas?.length || 0;
                    break;
                case 'aceptado':
                case 'en_curso':
                    if(viaje.conductor){
                        response.conductor = {
                            id: viaje.conductor.nombre_completo,
                            nombre: viaje.conductor.nombre_completo,
                            telefono: viaje.conductor.telefono,
                            ubicacion_actual: {
                                lat: viaje.conductor.ubicacion_lat,
                                lng: viaje.conductor.ubicacion_lng
                            },
                            vehiculo : viaje.conductor.vehiculos?.[0] || null
                        };
                    }
                    response.mensaje = viaje.estado == 'aceptado'
                    ? 'El conductor se dirige hacìa tì'
                    : 'Viaje en curso';
                    break;
                case 'completado':
                    response.mensaje = 'Viaje completado exitosamente';
                    response.tarifa_final = viaje.tarifa_acordada;
                    break;
                case 'cancelado':
                    response.mensaje = `Vija cancelado por: ${viaje.motivo_cancelacion} `;
                    break;
                default:
                    response.mensaje = `Estado; ${viaje.estado}`;
            }
            return response;
        } catch (error) {
           console.error(' ❌ Error obteniendo estado del viaje', error.message) 
        }
     }

     async getActiveRides(userId){
        try {
            console.log(`Obteniendo viajes activos para usuario ${userId}`);
            
            const activaRides = await Viaje.findAll({
                where: {
                    usuario_id: userId,
                    estado: ['solicitado', 'ofertas_recibidas', 'aceptado', 'en_curso']
                },
                include: [
                    {
                        model: Conductor,
                        as: 'conductor',
                        attributes: ['id', 'nombre_completo', 'telefono'],
                        required: false,
                        include: [{
                            model: Vehiculo,
                            as: 'vehiculos',
                            where: {activo: true},
                            required: false,
                            attributes: ['placa', 'marca', 'modelo', 'color']
                        }]
                    },
                    {
                        mode: OfertaViaje,
                        as: 'ofertas',
                        where: [{estado: 'activo'}],
                        required: false,
                        attributes: ['id', 'tarifa_propuesta', 'tiempo_estimado_llegada_minutos'],
                        include: [{
                            model: Conductor,
                            as: 'conductor',
                            attributes: ['nombre_completo']
                        }]
                    }
                ],
                order: [['fecha_solicitud', 'DESC']]
            })
            return activaRides.map(viaje => ({
                id: viaje.id,
                estado: viaje.estado,
                origin: {
                    lat: viaje.origen_lat,
                    lng: viaje.origen_lng,
                    direccion: viaje.origen_direccion
                },
                destino: {
                    lat: viaje.destino_lat,
                    lng: viaje.destino_lng,
                    destino_direccion: viaje.destino_direccion
                },
                distancia_km: viaje.distancia_km,
                precio_sugerido: viaje.precio_sugerido,
                tarifa_acordada: viaje.tarifa_acordada,
                fecha_solicitud: viaje.fecha_solicitud,
                conductor: viaje.conductor ? {
                    id: viaje.conductor.id,
                    nombre: viaje.conductor.nombre_completo,
                    telefno: viaje.conductor.telefono,
                    vehiculo: viaje.conductor.vehiculos?.[0] || null
                } : null,
                ofertas_pendientes: viaje.ofertas?.length || 0
            }));
        } catch (error) {
            console.error('❌ Erro obteneindo viajes activos: ', error.message);
            throw error;
             
        }
     }

     /**
    *   Cremos la contraoferta solo para el pasajero
    */
     async createCounterOffer(rideId, userId, counterOfferData){
        try {
            const {nuevo_precio, mensaje} = counterOfferData;
            console.log(`Creando contraoferta para viaje ${rideId}: S/. ${nuevo_precio}`);

            // verificamos y traemos el viaje existente para para pasajero

            const viaje = await Viaje.findOne({
                where: {
                    id: rideId,
                    usuario_id: userId
                },
                include: [{
                    model: Usuario,
                    as: 'pasajero',
                    attributes: ['nombre_completo', 'telefono']
                }]
            });

            // pequeña validacion
            if(!viaje){
                throw new NotFoundError("Viaje no econtrado"); 
            }

            console.log(`🐛 DEBUG: Estado actual del viaje: "${viaje.estado}"`);

            // Verificamos el estado del viaje
            if(!['ofertas_recibidas'].includes(viaje.estado)){
                throw new ConflictError("No se puede crear contraofertas por que ya ofertaste"); 
            }
           
            // actulizamos el precio sugerido con el nuevo precio ofertado
            await viaje.update({
                precio_sugerido: nuevo_precio,
                fecha_contraoferta: new Date()
            })

            // Obtenemo todos los conductores que hicieron la oferta
            const conductoresConOfertas = await OfertaViaje.findAll({
                where:{
                    viaje_id: rideId,
                    estado: 'pendiente'
                },
                include: [{
                    model: Conductor,
                    as: 'conductor',
                    attributes: ['id', 'nombre_completo']
                }]
            });
            
            // 📣 Notificamos sobre la contraoferta
            //  a todos los conductores que ofertaron para ese viaje

            const notificationData = {
                viaje_id: rideId,
                nuevo_precio: nuevo_precio,
                mensaje: mensaje || 'El pasajero hizo una nueva contraoferta',
                pasajero: {
                    nombre: viaje.pasajero.nombre_completo
                },
                expira_en: 300 // 5 minutos
            };

            try {
                for (const oferta of conductoresConOfertas){
                    // con websokcet
                    websocketServer.notifyDriver(oferta.conductor.id, 'ride:counter_offer', notificationData);

                    // con Push notificatons

                    await firebaseService.sendToDriver(oferta.conductor.id, {
                        title: ' 💡 Contraoferta recibida',
                        body:`Nuevo precio sugerido: S/. ${nuevo_precio}`,
                        data: {
                            type: 'counter_offer',
                            viaje_id: rideId,
                            nuevo_precio: nuevo_precio.toString()
                        }
                    });
                }
            } catch (notificationError) {
                console.warn(' ☢️ Error enviadno notificaones de contraoferta: ', notificationError.message);
            }

            console.log(`✅ Contraaoferta creada: S/. ${nuevo_precio}`);
            
            return {
                viaje: {
                    id: rideId,
                    nuevo_precio: nuevo_precio,
                    mensaje: mensaje,
                    conductores_notificados: conductoresConOfertas.length
                },
                mensaje: 'Contraoferta enviada a todos los cudntores posibles'
            }; 
        } catch (error) {
            console.error('❌ Error creando contraorferta: ', error.message);
            throw error;
             
        }
     }

     /**
     * ✅ CONDUCTOR ACEPTA CONTRAOFERTA DEL PASAJERO
     */
     async acceptDriverCounterOffer(offerId, conductorId){
        try {
            console.log(`✅ Conductor ${conductorId}  acepta la contraofert para la oferta de ${offerId}`);

            // buscar la oferta y el viaje
            const oferta = await OfertaViaje.findOne({
                where: {
                    id: offerId,
                    conductor_id: conductorId,
                    estado: 'pendiente'
                },
                include: [{
                    model: Viaje,
                    as: 'viaje',
                    include: [{
                        model: Usuario,
                        as: 'pasajero',
                        attributes: ['id', 'nombre_completo', 'telefono']
                    }]
                }]
            });

            // peuqeña validacio
            if(!oferta){
                throw new NotFoundError('Oferta no encontrada  para pode aceptar');
            }
            const viaje = oferta.viaje;

            if(!viaje.fecha_contraoferta){
                throw new NotFoundError('NO hay oferta para que puedas acpetar');
            }

            // actualizamos la oferta con el nuevo precio contraofertado
            await oferta.update({
                tarifa_propuesta: viaje.precio_sugerido, // este el precio de la contraofer del pasajero
                mensaje: `Acepto tu contraoferta de S/. ${viaje.precio_sugerido}`,
                fecha_contraoferta_aceptada: new Date()
            });

                // Notificar al pasajero
            const notificationData = {
            oferta_id: offerId,
            viaje_id: viaje.id,
            conductor: {
                id: conductorId,
                nombre: oferta.conductor?.nombre_completo
            },
            tarifa_acordada: viaje.precio_sugerido,
            mensaje: `¡El conductor aceptó tu contraoferta de S/. ${viaje.precio_sugerido}!`
            };

            // WebSocket
            websocketServer.notifyUser(viaje.usuario_id, 'ride:counter_offer_accepted', notificationData);

            // Push notification
            await firebaseService.sendToUser(viaje.usuario_id, {
            title: '🎉 Contraoferta Aceptada',
            body: `El conductor aceptó tu precio de S/. ${viaje.precio_sugerido}`,
            data: {
                type: 'counter_offer_accepted',
                viaje_id: viaje.id,
                oferta_id: offerId
            }
            });

            return {
            oferta: {
                id: offerId,
                tarifa_acordada: viaje.precio_sugerido,
                estado: 'pendiente_aceptacion_pasajero'
            },
            mensaje: 'Contraoferta aceptada. Esperando confirmación del pasajero.'
            };
            
            
        } catch (error) {
            console.error('❌ Error acpetando contraoferta: ', error.message);     
        }
     }

     /**
 * ✅ CONDUCTOR RECHAZA CONTRAOFERTA DEL PASAJERO
    */

     async rejecDriverCounterOffer(offerId, conductorId, motivo){
        try {
            console.log(`❌ Conductor ${conductorId} rechaza contraoferta para oferta  ${offerId}` );

            const oferta = await OfertaViaje.findOne({
                where: {
                    id: offerId,
                    conductor_id: conductorId,
                    estaod: 'pendiente'
                },
                include: [{
                    model: Viaje,
                    as: 'viaje',
                    include: [{
                        model: Usuario,
                        as: 'pasajero'
                    }]
                }]
            });

            if(!oferta){
                throw new NotFoundError("No s encontro la oferta que esta rechazada"); 
            }

            // maercamo coo rechazada
            await oferta.update({
                estado: 'rechazada',
                motivo_rechazo: motivo || 'Cotraoferta rechazada por el conductor',
                fecha_rechazo: new Date()
            });

            // notificamos al psajero del rechazo
            websocketServer.notifyUser(oferta.viaje.usuario_id, 'ride:counter_offer_rejected', {
                oferta_id: offerId,
                viaje_id: oferta.viaje.id,
                motivo: motivo || 'El conductor recahzò tu contraoferta'
            });

            return {
                oferta: {
                    id: offerId,
                    estado: 'rechazad',
                    motivo: motivo
                }
            }; 
        } catch (error) {
            console.error('❌ Erro rechaznado contraofertas: ', error.message);
            throw error 
        }
     }

     /**
     * ✅ CONDUCTOR CREA CONTRAOFERTA - cuando el user ofrece y este quiere contraofertar
     */

     async createDriverCounterOffer(offerId, conductorId, counterData){
        try {
            const {nueva_tarifa, mensaje} = counterData;
            console.log(`🚕 Conducto ${conductorId} contraoferta con S/. ${nueva_tarifa}`);
            
            // buscamos la contraoferta al que se a actulizar con el nuevo prcio
            const oferta = await OfertaViaje.findOne({
                where: {
                    id: offerId,
                    conductor_id: conductorId,
                    estado: 'pendiente'
                },
                include: [{
                    model: Viaje,
                    as: 'viaje',
                    include: [{
                        model: Usuario,
                        as: 'pasajero'
                    }],
                },{
                    model: Conductor,
                    as: 'conductor',
                    attributes: ['nombre_completo']
                }]
            });

            if(!oferta){
                throw new NotFoundError('No se econtro la ofert que creaste como conductor');
            }

            // actualizamos la oferta con la nueva tarifa
            await oferta.update({
                tarifa_propuesta: nueva_tarifa,
                mensaje: mensaje,
                fecha_contraoferta_conductor: new Date()
            });

            // Notificamos al pasajero

            const notificationData = {
                oferta_id: offerId,
                viaje_id: oferta.viaje.id,
                conductor: {
                    id: conductorId,
                    nombre: oferta.conductor.nombre_completo
                },
                nueva_tarifa: nueva_tarifa,
                mensaje: mensaje,
                tipo: 'contraoferta_conductor'
            };
            //con websocket
            websocketServer.notifyUser(oferta.viaje.usuario_id, 'ride:driver_counter_offer',  notificationData);

            // connotificaciones push

            await firebaseService.sendToUser(oferta.viaje.usuario_id, {
                title: `💸 Nueva contraoferta`,
                boyd: `${oferta.conductor.nombre_completo} propone S/. ${nueva_tarifa} `,
                data: {
                    type: 'driver_counter_offer',
                    viaje_id: oferta.viaje_id,
                    oferta_id: offerId,
                    nueva_tarifa: nueva_tarifa.toString()
                }
            });

            return {
                oferta: {
                    id: offerId,
                    nueva_tarifa: nueva_tarifa,
                    mensaje: mensaje,
                    conductor: oferta.conductor.nombre_completo,
                },
                mensaje: 'Contraoferta envida al pasajero'
            }; 
        } catch (error) {
            console.error('❌ No se pudo crear un nueva contraofert por parte dle conductor', error.message);
            throw error;
            
            
        }
     }

     



}

module.exports = new RidesService();
