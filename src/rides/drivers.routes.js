const express = require('express');
const router = express.Router();
const ridesController = require('./rides.controller');
const {authenticateConductorToken} = require('../middleware/conductor-auth.middleware');

router.use(authenticateConductorToken);

// rutas para cliestes en flutter

// ruta para actualizar la ubicacion en teimpo real (cada 1 - 10 segundo)
router.put('/location', ridesController.updateDriverLocation);

// ruta para crear un nueva oferta para una solicitud de viaje
router.post('/offers', ridesController.createDriverOffer);

// ver solicitude de viaje ceracanas para mostra en mapa
router.get('/nearby-requests', ridesController.getNearbyRequests);

// historal de ofertas del conductor
router.get('/my-offers', ridesController.getDriverOffers);

// Rutas para contraofertar como condutor

// rutaa para aceptar al contraoferta ddel pasajero como conductor
router.post('/offers/:offerId/accept-counter', ridesController.acceptCounterOffer);

// conductor rechaza la contraorfetaa
router.post('/offers/:offerId/reject-counter', ridesController.rejectCounterOffer);

// conductor hace contraoferta
router.post('/offers/:offerId/counter-offer', ridesController.createDriverCounterOffer)

module.exports = router;