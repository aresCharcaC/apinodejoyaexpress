const express = require('express');
const router = express.Router();
const ridesController = require('./rides.controller');
const {authenticateAccessToken}  = require('../middleware/auth.middleware');
const {authenticateConductorToken} = require('../middleware/conductor-auth.middleware');

/**
 * 🚗 RUTAS ESPECÍFICAS PARA CONDUCTORES
 */
// ✅ GESTIÓN DE UBICACIÓN EN TIEMPO REAL
// Actualizar ubicación del conductor (cada 5 segundos)
router.put('/driver/location', authenticateConductorToken, ridesController.updateDriverLocation);

// Inicializar actualizaciones automáticas de ubicación
router.post('/driver/start-location', authenticateConductorToken, ridesController.startDriverLocationUpdates);

// Detener actualizaciones automáticas de ubicación
router.post('/driver/stop-location', authenticateConductorToken, ridesController.stopDriverLocationUpdates);

// Obtener estadísticas del servicio de ubicación
router.get('/driver/stats', authenticateConductorToken, ridesController.getDriverLocationStats);

// ✅ GESTIÓN DE SOLICITUDES Y OFERTAS
// Obtener solicitudes cercanas
router.get('/driver/nearby-requests', authenticateConductorToken, ridesController.getNearbyRequests);

// Crear oferta para un viaje
router.post('/driver/offers', authenticateConductorToken, ridesController.createDriverOffer);

// Obtener ofertas del conductor
router.get('/driver/my-offers', authenticateConductorToken, ridesController.getDriverOffers);

// Aceptar contraoferta del pasajero
router.post('/driver/offers/:offerId/accept-counter', authenticateConductorToken, ridesController.acceptCounterOffer);

// Rechazar contraoferta del pasajero
router.post('/driver/offers/:offerId/reject-counter', authenticateConductorToken, ridesController.rejectCounterOffer);

// Crear contraoferta como conductor
router.post('/driver/offers/:offerId/counter-offer', authenticateConductorToken, ridesController.createDriverCounterOffer);

/**
 * 🚗 RUTAS DE SOLICITUD DE VIAJE (PASAJEROS)
 */
router.use(authenticateAccessToken);

// Crea una nueva solicitud de viaje 
router.post('/request', ridesController.createRideRequest);

// Ver todas las ofertas recividas de un viaje
router.get('/:rideId/offers', ridesController.getRideOffers);

// Aceptar la primera oferta 
router.post('/:rideId/offers/:offerId/accept', ridesController.acceptOffer);

// Rechazar  una oferta especifica 
router.post('/:rideId/offers/:offerId/reject', ridesController.rejectOffer);

// Contraoferta por el pasajero
router.post('/:rideId/counter-offer', ridesController.createCounterOffer);

// Cancelar solicitud de viaje
router.delete('/:rideId', ridesController.cancelRide);

// Cancelar y eliminar búsqueda activa (elimina completamente las solicitudes pendientes)
router.delete('/cancel-and-delete', ridesController.cancelAndDeleteSearch);

// consultar el estado del viaje actual
router.get('/:rideId/status', ridesController.getRideStatus);

// Ver viajes activo del conductor (pasajero y conductor)
router.get('/active', ridesController.getActiveRides);

// En rides.routes.js
//router.get('/debug-redis-drivers', ridesController.debugRedisDrivers);

module.exports = router;
