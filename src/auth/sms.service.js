// src/auth/sms.service.js - VERSIÓN CORREGIDA SIN DUPLICADOS
const axios = require('axios');
const { getRedisClient, isRedisAvailable, createRedisConnection } = require('../utils/redis');

class SmsService {
  constructor() {
    this.twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
    this.twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
    this.twilioWhatsAppSandboxNumber = process.env.TWILIO_WHATSAPP_SANDBOX_NUMBER;
    
    console.log(`📞 Twilio WhatsApp Webhook: ${this.isTwilioConfigured() ? '✅ CONFIGURADO' : '❌ NO CONFIGURADO'}`);
    
    if (this.isTwilioConfigured()) {
      const twilio = require('twilio');
      this.twilioClient = twilio(this.twilioAccountSid, this.twilioAuthToken);
      console.log('✅ Cliente Twilio inicializado para WEBHOOK');
    }

    this.otpStore = {};
    
    this.connectRedis();
  }

  // ✅ MÉTODO PARA CONECTAR REDIS COMPARTIDO
  async connectRedis() {
    try {
      await createRedisConnection();
      console.log('✅ Redis compartido conectado en SMS Service');
    } catch (error) {
      console.error("❌ No se pudo conectar Redis en SMS service:", error.message);
    }
  }

  /**
   * ✅ GENERAR OTP
   */
  generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * ✅ MÉTODO PRINCIPAL - PROCESAR WEBHOOK
   */
  async processWebhookMessage(incomingMessage, fromNumber) {
    console.log(`📨 Webhook recibido: "${incomingMessage}" de ${fromNumber}`);
    
    if (this._isCodeRequest(incomingMessage)) {
      console.log(`✅ Usuario ${fromNumber} solicita código`);
      return await this._sendCodeResponse(fromNumber);
    } else {
      console.log(`❓ Mensaje no reconocido de ${fromNumber}`);
      return await this._sendHelpResponse(fromNumber);
    }
  }

 
  _isCodeRequest(incomingMessage) {
    if (!incomingMessage) return false;
    
    const message = incomingMessage.toLowerCase().trim();
    const keywords = [
      'quiero mi codigo',
      'codigo',
      'código', 
      'verification',
      'verificacion',
      'verificación',
      'otp',
      'code'
    ];
    
    return keywords.some(keyword => message.includes(keyword));
  }

  /**
   * ✅ ENVIAR CÓDIGO COMO RESPUESTA AL WEBHOOK
   */
  async _sendCodeResponse(fromNumber) {
    try {
      if (!this.isTwilioConfigured()) {
        throw new Error('Twilio no configurado');
      }

      const code = this.generateOtp();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      const cleanPhone = fromNumber.replace('whatsapp:', '');

         console.log(`\n🔥 === SEND CODE DEBUG ===`);
    console.log(`📱 fromNumber original: ${fromNumber}`);
    console.log(`📱 cleanPhone: ${cleanPhone}`);
    console.log(`🔐 Código generado: ${code}`);
    console.log(`📞 Twilio From: ${this.twilioWhatsAppSandboxNumber}`);
    console.log(`📞 Twilio To: ${fromNumber}`);
    console.log(`========================\n`);

  //  VERIFICAR QUE AMBOS SEAN WHATSAPP
    if (!fromNumber.startsWith('whatsapp:')) {
      throw new Error(`Tu numero debe tener formato whatsapp: ${fromNumber}`);
    }

    if (!this.twilioWhatsAppSandboxNumber.startsWith('whatsapp:')) {
      throw new Error(`El numero de cuenta sandbox  debe tener formato whatsapp: ${this.twilioWhatsAppSandboxNumber}`);
    }

      // ✅ ENVIAR VÍA TWILIO
      const message = await this.twilioClient.messages.create({
        from: this.twilioWhatsAppSandboxNumber,
        to: fromNumber,
        body: `🔐 *Tu código de verificación:*\n\n*${code}*\n\n⏰ Válido por 5 minutos\n✅ Ingrésalo en la app para continuar`
      });

      console.log(`✅ Mensaje enviado: ${message.sid}`);

     // ✅ GUARDAR EN REDIS COMPARTIDO CON DEBUG EXTREMO
    if (isRedisAvailable()) {
      try {
        const redis = getRedisClient();
        const verificationKey = `verification_code:${cleanPhone}`;
        
        console.log(`\n💾 === REDIS SAVE DEBUG ===`);
        console.log(`🔑 Key a guardar: ${verificationKey}`);
        console.log(`🔐 Código a guardar: ${code}`);
        console.log(`⏰ TTL: 300 segundos`);
        
        await redis.setEx(verificationKey, 300, code);
        console.log(`✅ Comando setEx ejecutado`);
        
        // ✅ VERIFICAR QUE SE GUARDÓ INMEDIATAMENTE
        const verificacion = await redis.get(verificationKey);
        console.log(`🔍 Verificación inmediata: ${verificationKey} = ${verificacion}`);
        
        // ✅ VERIFICAR TTL
        const ttl = await redis.ttl(verificationKey);
        console.log(`⏰ TTL verificado: ${ttl} segundos`);
        console.log(`========================\n`);
        
        if (verificacion !== code) {
          console.error(`❌ REDIS ERROR: Guardado ${code} pero recuperado ${verificacion}`);
        }
        
      } catch (redisError) {
        console.error('❌ Error guardando en Redis:', redisError.message);
        console.error('❌ Stack:', redisError.stack);
      }
    } else {
      console.log('⚠️ Redis no disponible, solo guardando en memoria local');
    }
      // ✅ BACKUP EN MEMORIA
      this.otpStore[cleanPhone] = { 
        code: code, 
        expiresAt: expiresAt,
        messageSid: message.sid,
        fromWebhook: true
      };
    console.log(`📋 Guardado en memoria: this.otpStore['${cleanPhone}'] = ${JSON.stringify(this.otpStore[cleanPhone])}`);
      return {
        success: true,
        code: code, // 
        messageSid: message.sid,
        status: message.status,
        provider: 'twilio-webhook-response',
        timestamp: new Date().toISOString(),
        telefono: cleanPhone,
        expiresAt: expiresAt
      };

    } catch (error) {
      console.error('❌ Error enviando código:', error.message);
       console.error('❌ Error stack:', error.stack);
      return {
        success: false,
        error: error.message,
        provider: 'twilio-webhook-error'
      };
    }
  }

  /**
   * ✅ MENSAJE DE AYUDA
   */
  async _sendHelpResponse(fromNumber) {
    try {
      if (!this.isTwilioConfigured()) {
        return { success: false, error: 'Twilio no configurado' };
      }

      const helpText = `👋 ¡Hola!\n\nPara obtener tu código escribe:\n*"Quiero mi código"*\n\n✨ ¡Es fácil!`;

      const message = await this.twilioClient.messages.create({
        from: this.twilioWhatsAppSandboxNumber,
        to: fromNumber,
        body: helpText
      });

      console.log(`💬 Ayuda enviada a ${fromNumber}`);

      return {
        success: true,
        messageSid: message.sid,
        provider: 'twilio-webhook-help',
        isHelpMessage: true
      };

    } catch (error) {
      console.error('❌ Error enviando ayuda:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * ✅ VALIDAR CÓDIGO
   */
  async validateCode(telefono, inputCode) {
    console.log(`🔍 SMS Service validando código para: ${telefono}`);
    
    const cleanPhone = telefono.replace('whatsapp:', '').replace(/\s/g, '');
    
    // ✅ INTENTAR REDIS COMPARTIDO PRIMERO
    if (isRedisAvailable()) {
      try {
        const redis = getRedisClient();
        const redisKey = `verification_code:${cleanPhone}`;
        const storedCode = await redis.get(redisKey);
        
        console.log(`🔍 Redis lookup: ${redisKey} = ${storedCode}`);
        
        if (storedCode && storedCode === inputCode) {
          await redis.del(redisKey);
          console.log(`✅ Código validado y limpiado de Redis para ${cleanPhone}`);
          
          return { 
            success: true, 
            message: 'Código verificado exitosamente',
            telefono: cleanPhone,
            source: 'redis'
          };
        } else if (storedCode) {
          console.log(`❌ Código incorrecto en Redis: esperado ${storedCode}, recibido ${inputCode}`);
          return { 
            success: false, 
            message: 'Código incorrecto' 
          };
        }
      } catch (redisError) {
        console.error('❌ Error consultando Redis:', redisError.message);
      }
    }

    // ✅ FALLBACK A MEMORIA LOCAL
    const phoneFormats = [
      cleanPhone,
      this.formatPhoneNumber(cleanPhone),
      `+51${cleanPhone.replace('+51', '')}`,
    ];

    let storedData = null;
    let foundPhone = null;

    for (const format of phoneFormats) {
      if (this.otpStore[format]) {
        storedData = this.otpStore[format];
        foundPhone = format;
        break;
      }
    }

    console.log(`📋 Memoria local lookup para formatos: ${phoneFormats.join(', ')}`);
    console.log(`📋 Datos encontrados: ${storedData ? 'SÍ' : 'NO'} en formato: ${foundPhone}`);

    if (!storedData) {
      return { 
        success: false, 
        message: 'No tienes código generado. Escribe "Quiero mi código" por WhatsApp.' 
      };
    }

    // ✅ VERIFICAR EXPIRACIÓN
    if (new Date() > storedData.expiresAt) {
      delete this.otpStore[foundPhone];
      return { 
        success: false, 
        message: 'Código expirado. Solicita uno nuevo por WhatsApp.' 
      };
    }

    // ✅ VERIFICAR CÓDIGO
    if (inputCode === storedData.code) {
      delete this.otpStore[foundPhone];
      console.log(`✅ Código validado en memoria local para ${foundPhone}`);
      return { 
        success: true, 
        message: 'Código verificado exitosamente',
        telefono: cleanPhone,
        source: 'memory'
      };
    } else {
      console.log(`❌ Código incorrecto en memoria: esperado ${storedData.code}, recibido ${inputCode}`);
      return { 
        success: false, 
        message: 'Código incorrecto. Intenta de nuevo.' 
      };
    }
  }

  /**
   * ✅ MÉTODO PRINCIPAL 
   */
  async sendVerificationCode(incomingMessage, telefono, forcedWhatsApp = false) {
    console.log(`📨 sendVerificationCode llamado con: "${incomingMessage}", ${telefono}`);
    
    if (incomingMessage) {
      console.log(`📞 Procesando como WEBHOOK - Usuario envió: "${incomingMessage}"`);
      
      if (this._isCodeRequest(incomingMessage)) {
        const fromNumber = telefono.startsWith('whatsapp:') ? telefono : `whatsapp:${telefono}`;
        return await this._sendCodeResponse(fromNumber);
      } else {
        return {
          success: false,
          error: 'Mensaje no reconocido',
          message: 'Envía "Quiero mi código" para recibir tu código de verificación'
        };
      }
    } else {
      console.log(`📱 Llamada directa para ${telefono} - generando código sin webhook`);
      
      const code = this.generateOtp();
      const cleanPhone = telefono.replace('whatsapp:', '');
      
     if (forcedWhatsApp) {
      // ENVIAR POR WHATSAPP 
      console.log(`📤 Forzando envío por WhatsApp para ${telefono}`);
      const fromNumber = telefono.startsWith('whatsapp:') ? telefono : `whatsapp:${telefono}`;
      return await this._sendCodeResponse(fromNumber);
    } else {
      //  registro normal
      console.log(`📝 Solo generando código para ${telefono} - sin envío por WhatsApp`);
      
      const code = this.generateOtp();
      const cleanPhone = telefono.replace('whatsapp:', '');
      
      if (isRedisAvailable()) {
        try {
          const redis = getRedisClient();
          const verificationKey = `verification_code:${cleanPhone}`;
          await redis.setEx(verificationKey, 300, code);
          console.log(`💾 Código directo guardado en Redis compartido: ${verificationKey} = ${code}`);
        } catch (redisError) {
          console.error('❌ Error guardando código directo:', redisError.message);
        }
      }
      
      return {
        success: true,
        code: code,
        provider: 'direct-generation',
        timestamp: new Date().toISOString(),
        telefono: cleanPhone,
        message: 'Código generado (sin envío por WhatsApp)'
      };
    }
    }
  }

  
  formatPhoneNumber(telefono) {
    let cleaned = telefono.replace(/\D/g, '');
   console.log("eltre al pemtdo formated phen") 
    if (!telefono.startsWith('+')) {
      if (cleaned.startsWith('57')) {
        cleaned = '+' + cleaned;
      } else if (cleaned.startsWith('51')) { 
        cleaned = '+' + cleaned;
      } else if (cleaned.length === 10) {
        cleaned = '+57' + cleaned;
      } else if (cleaned.length === 9) {
        cleaned = '+51' + cleaned;
      } else {
        cleaned = '+' + cleaned;
      }
    } else {
      cleaned = telefono;
    }
    
    return cleaned;
  }

  
  validatePhoneFormat(telefono) {
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    return phoneRegex.test(telefono.replace(/\s/g, ''));
  }

  /**
   * ✅ VERIFICAR CONFIGURACIÓN TWILIO
   */
  isTwilioConfigured() {
    return !!(this.twilioAccountSid && this.twilioAuthToken && this.twilioWhatsAppSandboxNumber);
  }

  /**
   * ✅ STATUS PARA DEBUG
   */
  getStatus() {
    return {
      twilioConfigured: this.isTwilioConfigured(),
      redisConnected: isRedisAvailable(),
      codesStored: Object.keys(this.otpStore).length,
      activeNumbers: Object.keys(this.otpStore)
    };
  }
}

module.exports = new SmsService();