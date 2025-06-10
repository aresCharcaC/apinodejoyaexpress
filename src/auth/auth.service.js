const authRepository = require('./auth.repository');
//const verificationService = require('./verification.service');
const verificationService = require('./auth.verification');
const AuthSchema = require('./auth.schema');
const { 
  generateAccessToken, 
  generateRefreshToken,
  generateVerificationCode 
} = require('./auth.util');
const { AuthenticationError, ValidationError, ConflictError } = require('../utils/errors');

class AuthService {
  async sendVerificationCode(incomingMessage, telefono) {
    AuthSchema.validateSendCode({ telefono });
    
    return await verificationService.generateAndStoreCode(incomingMessage, telefono);
  }

  async verifyCode(telefono, codigo) {
    AuthSchema.validateVerifyCode({ telefono, codigo });
    
    return await verificationService.verifyCode(telefono, codigo);
  }

async completeRegistration(userData) {
  const { telefono, tempToken, password, nombre_completo, email, foto_perfil } = userData;
  
  try {
    console.log('🔍 Iniciando completeRegistration para:', telefono);

    // ✅ VALIDAR SCHEMA
    AuthSchema.validateCompleteRegistration(userData);
    console.log('✅ Schema validado');

    // ✅ VERIFICAR TEMP TOKEN
    console.log('🔍 Verificando tempToken...');
    await verificationService.verifyTempToken(telefono, tempToken);
    console.log('✅ Token verificado exitosamente');

    // ✅ VERIFICAR SI EXISTE USUARIO
    console.log('🔍 Verificando si existe usuario...');
    const existingUser = await authRepository.findUserByPhone(telefono);
    
    if (existingUser && existingUser.password) {
      console.log('❌ Usuario ya existe con contraseña');
      throw new ConflictError('El usuario ya está registrado. Use login en su lugar.');
    }
    
    console.log('✅ Usuario disponible para registro');

    let user;
    
    if (existingUser) {
      console.log('🔄 Actualizando usuario existente...');
      user = await authRepository.updateUser(existingUser.id, {
        password,
        nombre_completo,
        email,
        foto_perfil
      });
    } else {
      console.log('👤 Creando nuevo usuario...');
      user = await authRepository.createUser({
        telefono,
        password,
        nombre_completo,
        email,
        foto_perfil
      });
    }

    console.log('✅ Usuario creado/actualizado:', user.id);

    // ✅ LIMPIAR TOKEN TEMPORAL
    console.log('🗑️ Limpiando token temporal...');
    await verificationService.clearTempToken(telefono);

    // ✅ GENERAR TOKENS
    console.log('🔐 Generando tokens...');
    const tokens = this.generateTokens(user);

    // ✅ CREAR SESIÓN
    console.log('📝 Creando sesión...');
    await this.createSession(user.id, tokens.refreshToken);

    console.log('✅ Registro completado exitosamente');

    return {
      message: 'Registro completado exitosamente',
      user: user.toPublicJSON ? user.toPublicJSON() : user,
      tokens
    };

  } catch (error) {
    console.error('❌ Error en completeRegistration:', error.message);
    console.error('❌ Stack:', error.stack);
    throw error; 
  }
}

  /**
   * Login con teléfono y contraseña
   */
  async login(telefono, password) {
    AuthSchema.validateLogin({ telefono, password });
    console.log('✅ Schema validado');
    const user = await authRepository.findUserByPhone(telefono);
    if (!user || !user.password) {
      throw new AuthenticationError('Usuario no encontrado. Registrese primero.');
    }
    
    if (user.estado !== 'activo') {
      throw new AuthenticationError('Cuenta inactiva o suspendida');
    }
    
    const isPasswordValid = await user.verificarPassword(password);
    if (!isPasswordValid) {
      throw new AuthenticationError('Credenciales inválidas');
    }
    
    // Generar nuevos tokens
    const tokens = this.generateTokens(user);
    
    // Crear nueva sesión
    await this.createSession(user.id, tokens.refreshToken);
    
    return {
      message: 'Inicio de sesión exitoso',
      user: user.toPublicJSON(),
      tokens
    };
  }

  /**
   * Renovar access token usando refresh token
   */
  async refreshToken(refreshToken) {
    if (!refreshToken) {
      throw new AuthenticationError('Refresh token requerido');
    }
    
    const session = await authRepository.findActiveSession(refreshToken);
    if (!session) {
      throw new AuthenticationError('Sesión inválida o expirada');
    }
    
    const tokenPayload = {
      userId: session.pasajero.id,
      telefono: session.pasajero.telefono,
      tipo: 'pasajero'
    };
    
    const newAccessToken = generateAccessToken(tokenPayload);
    
    return { accessToken: newAccessToken };
  }

  /**
   * Cerrar sesión
   */
  async logout(refreshToken) {
    if (refreshToken) {
      await authRepository.deactivateSession(refreshToken);
    }
    
    return { message: 'Sesión cerrada exitosamente' };
  }

  /**
   * RECUPERACIÓN DE CONTRASEÑA - Paso 1: Enviar código
   */
  async forgotPassword(telefono) {
    try {
      console.log('🔍 Iniciando forgotPassword para:', telefono);
      
      AuthSchema.validateForgotPassword({ telefono });
      console.log('✅ Schema validado');
      
      const smsService = require('./sms.service');
      const formattedPhone = smsService.formatPhoneNumber(telefono);
      console.log('📱 Teléfono formateado:', formattedPhone);
      
      const user = await authRepository.findUserByPhone(formattedPhone);
      if (!user || !user.password) {
        console.log('❌ Usuario no encontrado o sin contraseña');
        return { 
          message: 'Si el número está registrado, recibirá un código de recuperación',
          telefono: formattedPhone 
        };
      }
      
      console.log('✅ Usuario encontrado:', user.id);
      
      console.log('📤 Generando código de recuperación...');
      
      // ✅ PASAR NULL COMO incomingMessage Y EL TELÉFONO FORMATEADO
      const result = await verificationService.generateAndStoreCode(null, formattedPhone, true);
      
      console.log('✅ Código de recuperación generado exitosamente');
      
      return { 
        message: 'Código de recuperación enviado por WhatsApp',
        telefono: formattedPhone,
        provider: result.provider,
        timestamp: result.timestamp,
        ...(process.env.NODE_ENV === 'development' && {
          testCode: result.testCode // Solo en desarrollo
        })
      };
      
    } catch (error) {
      console.error('❌ Error en forgotPassword:', error.message);
      throw error;
    }
  }

  /**
   * RECUPERACIÓN DE CONTRASEÑA - Paso 2: Verificar código y cambiar contraseña
   */
async resetPassword(telefono, codigo, nuevaPassword) {
  try {
    console.log('🔐 Iniciando resetPassword...');
    
    const smsService = require('./sms.service');
    const formattedPhone = smsService.formatPhoneNumber(telefono);
    
    const verificationResult = await verificationService.verifyCode(formattedPhone, codigo);
    console.log('✅ Código verificado exitosamente');
    
    const user = await authRepository.findUserByPhone(formattedPhone);
    
    if (!user) {
      throw new Error('Usuario no encontrado');
    }
    
    console.log(`📋 Usuario encontrado: ${user.id}, pasajero_id: ${user.pasajero_id}, conductor_id: ${user.conductor_id}`);
    
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(nuevaPassword, 12);
    
    const updatedUser = await authRepository.updateUserPassword(user.id, hashedPassword);
    
    console.log('✅ Contraseña actualizada correctamente');
    
    await verificationService.clearTempToken(formattedPhone);
    
    return {
      message: 'Contraseña actualizada exitosamente',
      telefono: formattedPhone
    };
    
  } catch (error) {
    console.error('❌ Error en resetPassword:', error.message);
    throw error;
  }
}

  /**
   * Obtener perfil del usuario
   */
  async getProfile(userId) {
    const user = await authRepository.findUserById(userId);
    return user.toPublicJSON();
  }

  /**
   * Generar tokens de acceso y refresco
   */
  generateTokens(user) {
    const tokenPayload = {
      userId: user.id,
      telefono: user.telefono,
      tipo: 'pasajero'
    };
    
    return {
      accessToken: generateAccessToken(tokenPayload),
      refreshToken: generateRefreshToken(tokenPayload)
    };
  }

  /**
   * Crear sesión en la base de datos
   */
  async createSession(userId, refreshToken) {
    const fechaExpiracion = new Date();
    fechaExpiracion.setDate(fechaExpiracion.getDate() + 7); // 1 semana
    
    return await authRepository.createSession({
      pasajero_id: userId,
      token: refreshToken,
      fecha_expiracion: fechaExpiracion
    });
  }
}

module.exports = new AuthService();