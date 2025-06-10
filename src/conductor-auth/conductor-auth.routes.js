const express = require('express');
const conductorAuthController = require('./conductor-auth.controller');
const { authenticateConductorToken } = require('../middleware/conductor-auth.middleware');

const router = express.Router();

// ====================================
// RUTAS PÚBLICAS (sin autenticación)
// ====================================

/**
 * POST /api/conductor-auth/register
 * Registro completo de conductor
 */
router.post('/register', conductorAuthController.register);

/**
 * POST /api/conductor-auth/login
 * Login con DNI y contraseña
 */
router.post('/login', conductorAuthController.login);

/**
 * POST /api/conductor-auth/refresh
 * Renovar access token usando refresh token
 */
router.post('/refresh', conductorAuthController.refreshToken);

/**
 * GET /api/conductor-auth/available
 * Buscar conductores disponibles (para testing/admin)
 */
router.get('/available', conductorAuthController.getAvailableConductors);

// ====================================
// RUTAS PROTEGIDAS (requieren autenticación)
// ====================================

/**
 * POST /api/conductor-auth/logout
 * Cerrar sesión
 */
router.post('/logout', authenticateConductorToken, conductorAuthController.logout);

/**
 * GET /api/conductor-auth/profile
 * Obtener perfil del conductor autenticado
 */
router.get('/profile', authenticateConductorToken, conductorAuthController.getProfile);

/**
 * PUT /api/conductor-auth/profile
 * Actualizar perfil del conductor
 */
router.put('/profile', authenticateConductorToken, conductorAuthController.updateProfile);

/**
 * POST /api/conductor-auth/vehicles
 * Agregar vehículo
 */
router.post('/vehicles', authenticateConductorToken, conductorAuthController.addVehicle);

/**
 * GET /api/conductor-auth/vehicles
 * Obtener vehículos del conductor
 */
router.get('/vehicles', authenticateConductorToken, conductorAuthController.getVehicles);

/**
 * POST /api/conductor-auth/documents
 * Subir/actualizar documentos (brevete)
 */
router.post('/documents', authenticateConductorToken, conductorAuthController.uploadDocuments);

/**
 * PUT /api/conductor-auth/location
 * Actualizar ubicación del conductor
 * ruta eliminaa ❌ AHORA en api/rides/driver/location
 */
// router.put('/location', authenticateConductorToken, conductorAuthController.updateLocation);

/**
 * PUT /api/conductor-auth/availability
 * Cambiar disponibilidad del conductor
 */
router.put('/availability', authenticateConductorToken, conductorAuthController.updateAvailability);

module.exports = router;