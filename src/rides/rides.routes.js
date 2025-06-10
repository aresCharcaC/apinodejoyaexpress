const express = require('express');
const router = express.Router();
const ridesController = require('./rides.controller');
const {authenticateAccessToken}  = require('../middleware/auth.middleware');



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

// consultar el estado del viaje actual
router.get('/:rideId/status', ridesController.getRideStatus);

// Ver viajes activo del conductor (pasajero y conductor)
router.get('/active', ridesController.getActiveRides);

// En rides.routes.js
//router.get('/debug-redis-drivers', ridesController.debugRedisDrivers);

module.exports = router;