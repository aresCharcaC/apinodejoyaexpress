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
    throw error; // ✅ RE-LANZAR EL ERROR PARA QUE LO MANEJE EL CONTROLLER
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
    AuthSchema.validateForgotPassword({ telefono });
    
    // Verificar que el usuario existe
    const user = await authRepository.findUserByPhone(telefono);
    if (!user || !user.password) {
      // Por seguridad, no revelar si el usuario existe o no
      return { message: 'Si el número está registrado, recibirá un código de recuperación' };
    }
    
    // Generar y enviar código
    await verificationService.generateAndStoreCode(telefono);
    
    return { message: 'Si el número está registrado, recibirá un código de recuperación' };
  }

  /**
   * RECUPERACIÓN DE CONTRASEÑA - Paso 2: Verificar código y cambiar contraseña
   */
  async resetPassword(telefono, codigo, nuevaPassword) {
    AuthSchema.validateResetPassword({ telefono, codigo, nuevaPassword });
    
    // Verificar código
    await verificationService.verifyCode(telefono, codigo);
    
    // Buscar usuario
    const user = await authRepository.findUserByPhone(telefono);
    if (!user) {
      throw new AuthenticationError('Usuario no encontrado');
    }
    
    // Actualizar contraseña
    await authRepository.updateUserPassword(user.id, nuevaPassword);
    
    // Desactivar todas las sesiones del usuario por seguridad
    await authRepository.deactivateAllUserSessions(user.id);
    
    return { message: 'Contraseña actualizada exitosamente' };
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