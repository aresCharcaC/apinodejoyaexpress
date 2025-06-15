// Lonardo tendràs que adecuar este codigo para tus notificaciones, 


const admin = require('firebase-admin');
const { Usuario, Conductor } = require('../models');

class FirebaseService {
  constructor() {
    this.initialized = false;
    this.init();
  }

  /**
   * ✅ INICIALIZAR FIREBASE ADMIN
   */
  init() {
    try {
      // Solo inicializar si hay configuración de Firebase
      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: serviceAccount.project_id
        });

        this.initialized = true;
        console.log('✅ Firebase Admin inicializado correctamente');
      } else {
        throw new Error('Firebase no configurado. Se requiere FIREBASE_SERVICE_ACCOUNT en variables de entorno.');
      }
    } catch (error) {
      console.error('❌ Error inicializando Firebase:', error.message);
      this.initialized = false;
    }
  }

  /**
   * ✅ ENVIAR NOTIFICACIÓN A USUARIO (PASAJERO)
   */
  async sendToUser(userId, notification) {
    try {
      console.log(`� Enviando push a usuario ${userId}: ${notification.title}`);

      if (!this.initialized) {
        throw new Error('Firebase no está inicializado correctamente');
      }

      // Obtener token FCM del usuario
      const usuario = await Usuario.findByPk(userId, {
        attributes: ['id', 'nombre_completo', 'fcm_token']
      });

      if (!usuario) {
        throw new Error('Usuario no encontrado');
      }

      if (!usuario.fcm_token) {
        console.warn(`⚠️ Usuario ${userId} no tiene token FCM registrado`);
        return { success: false, reason: 'No FCM token' };
      }

      // Configurar mensaje
      const message = {
        token: usuario.fcm_token,
        notification: {
          title: notification.title,
          body: notification.body
        },
        data: notification.data || {},
        android: {
          notification: {
            icon: 'ic_notification',
            color: '#FF6B35',
            sound: 'default',
            priority: 'high'
          }
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1
            }
          }
        }
      };

      // Enviar notificación
      const response = await admin.messaging().send(message);
      
      console.log(`✅ Push enviado a usuario ${userId}: ${response}`);
      
      return {
        success: true,
        messageId: response,
        userId: userId
      };

    } catch (error) {
      console.error(`❌ Error enviando push a usuario ${userId}:`, error.message);
      
      // Si el token es inválido, limpiarlo
      if (error.code === 'messaging/registration-token-not-registered' || 
          error.code === 'messaging/invalid-registration-token') {
        await this.clearInvalidToken('usuario', userId);
      }
      
      return {
        success: false,
        error: error.message,
        userId: userId
      };
    }
  }

  /**
   * ✅ ENVIAR NOTIFICACIÓN A CONDUCTOR
   */
  async sendToDriver(conductorId, notification) {
    try {
      console.log(`� Enviando push a conductor ${conductorId}: ${notification.title}`);

      if (!this.initialized) {
        throw new Error('Firebase no está inicializado correctamente');
      }

      // Obtener token FCM del conductor
      const conductor = await Conductor.findByPk(conductorId, {
        attributes: ['id', 'nombre_completo', 'fcm_token']
      });

      if (!conductor) {
        throw new Error('Conductor no encontrado');
      }

      if (!conductor.fcm_token) {
        console.warn(`⚠️ Conductor ${conductorId} no tiene token FCM registrado`);
        return { success: false, reason: 'No FCM token' };
      }

      // Configurar mensaje con prioridad alta para conductores
      const message = {
        token: conductor.fcm_token,
        notification: {
          title: notification.title,
          body: notification.body
        },
        data: notification.data || {},
        android: {
          notification: {
            icon: 'ic_driver_notification',
            color: '#00C851',
            sound: 'driver_alert',
            priority: 'max',
            vibrate: [500, 500, 500]
          },
          priority: 'high'
        },
        apns: {
          payload: {
            aps: {
              sound: 'driver_alert.wav',
              badge: 1,
              'content-available': 1
            }
          },
          headers: {
            'apns-priority': '10'
          }
        }
      };

      // Enviar notificación
      const response = await admin.messaging().send(message);
      
      console.log(`✅ Push enviado a conductor ${conductorId}: ${response}`);
      
      return {
        success: true,
        messageId: response,
        conductorId: conductorId
      };

    } catch (error) {
      console.error(`❌ Error enviando push a conductor ${conductorId}:`, error.message);
      
      // Si el token es inválido, limpiarlo
      if (error.code === 'messaging/registration-token-not-registered' || 
          error.code === 'messaging/invalid-registration-token') {
        await this.clearInvalidToken('conductor', conductorId);
      }
      
      return {
        success: false,
        error: error.message,
        conductorId: conductorId
      };
    }
  }

  /**
   * ✅ ENVIAR A MÚLTIPLES CONDUCTORES
   */
  async sendToMultipleDrivers(conductorIds, notification) {
    try {
      console.log(`📡 Enviando push a ${conductorIds.length} conductores`);

      const results = await Promise.allSettled(
        conductorIds.map(conductorId => 
          this.sendToDriver(conductorId, notification)
        )
      );

      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const failed = results.length - successful;

      console.log(`📊 Push masivo: ${successful} exitosos, ${failed} fallidos`);

      return {
        total: conductorIds.length,
        successful,
        failed,
        results: results.map((result, index) => ({
          conductorId: conductorIds[index],
          success: result.status === 'fulfilled' && result.value.success,
          error: result.status === 'rejected' ? result.reason : null
        }))
      };

    } catch (error) {
      console.error('❌ Error en push masivo:', error.message);
      throw error;
    }
  }

  /**
   * ✅ REGISTRAR TOKEN FCM
   */
  async registerToken(userType, userId, fcmToken) {
    try {
      console.log(`🔔 Registrando token FCM para ${userType} ${userId}`);

      if (userType === 'usuario') {
        await Usuario.update(
          { fcm_token: fcmToken },
          { where: { id: userId } }
        );
      } else if (userType === 'conductor') {
        await Conductor.update(
          { fcm_token: fcmToken },
          { where: { id: userId } }
        );
      } else {
        throw new Error('Tipo de usuario inválido');
      }

      console.log(`✅ Token FCM registrado para ${userType} ${userId}`);
      
      return { success: true };

    } catch (error) {
      console.error(`❌ Error registrando token FCM:`, error.message);
      throw error;
    }
  }

  /**
   * ✅ LIMPIAR TOKEN INVÁLIDO
   */
  async clearInvalidToken(userType, userId) {
    try {
      console.log(`🧹 Limpiando token inválido para ${userType} ${userId}`);

      if (userType === 'usuario') {
        await Usuario.update(
          { fcm_token: null },
          { where: { id: userId } }
        );
      } else if (userType === 'conductor') {
        await Conductor.update(
          { fcm_token: null },
          { where: { id: userId } }
        );
      }

      console.log(`✅ Token inválido limpiado para ${userType} ${userId}`);

    } catch (error) {
      console.error(`❌ Error limpiando token inválido:`, error.message);
    }
  }


  /**
   * ✅ VERIFICAR ESTADO DEL SERVICIO
   */
  isReady() {
    return this.initialized;
  }

  /**
   * ✅ OBTENER ESTADÍSTICAS
   */
  async getStats() {
    try {
      const usuariosConToken = await Usuario.count({
        where: {
          fcm_token: { [require('sequelize').Op.ne]: null }
        }
      });

      const conductoresConToken = await Conductor.count({
        where: {
          fcm_token: { [require('sequelize').Op.ne]: null }
        }
      });

      return {
        firebase_initialized: this.initialized,
        usuarios_con_token: usuariosConToken,
        conductores_con_token: conductoresConToken,
        total_dispositivos: usuariosConToken + conductoresConToken
      };

    } catch (error) {
      console.error('❌ Error obteniendo estadísticas FCM:', error.message);
      return {
        firebase_initialized: this.initialized,
        error: error.message
      };
    }
  }
}
module.exports = new FirebaseService();
