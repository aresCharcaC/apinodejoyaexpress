const express = require('express');
const authController = require('./auth.controller');
const { authenticateAccessToken } = require('../middleware/auth.middleware');

const router = express.Router();

// rutas para el front
router.post('/send-code', authController.sendCode);
router.post('/verify-code', authController.verifyCode);
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/refresh', authController.refreshToken);
router.post('/logout', authController.logout);

router.post('/twilio/webhook', authController.twilioWebhook); 
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

// rutas protegidas
router.get('/profile', authenticateAccessToken, authController.getProfile);

module.exports = router;