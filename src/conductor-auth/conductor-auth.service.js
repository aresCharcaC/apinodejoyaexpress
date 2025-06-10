const conductorAuthRepository = require('./conductor-auth.repository');
const ConductorAuthSchema = require('./conductor-auth.schema');
const { 
  generateAccessToken, 
  generateRefreshToken 
} = require('../auth/auth.util');
const { AuthenticationError, ValidationError, ConflictError } = require('../utils/errors');

class ConductorAuthService {
  
  /**
   * Registro completo de conductor
   */
  async register(userData) {
    try {
      console.log('🔍 Iniciando registro de conductor para DNI:', userData.dni);

      // ✅ VALIDAR SCHEMA
      ConductorAuthSchema.validateRegister(userData);
      console.log('✅ Schema validado');

      const {
        dni,
        nombre_completo,
        telefono,
        password,
        foto_perfil,
        placa,
        foto_lateral,
        foto_brevete,
        fecha_expiracion_brevete
      } = userData;

      // ✅ PREPARAR DATOS DEL CONDUCTOR
      const conductorData = {
        dni,
        nombre_completo,
        telefono,
        password,
        foto_perfil,
        estado: 'pendiente' // Requiere aprobación manual
      };

      // ✅ PREPARAR DATOS DEL VEHÍCULO
      const vehiculoData = {
        placa: placa.toUpperCase(),
        foto_lateral
      };

      // ✅ PREPARAR DATOS DEL DOCUMENTO
      const documentoData = {
        foto_brevete,
        fecha_expiracion: fecha_expiracion_brevete || null
      };

      // ✅ CREAR CONDUCTOR CON VEHÍCULO Y DOCUMENTOS
      const conductor = await conductorAuthRepository.createConductor(
        conductorData,
        vehiculoData,
        documentoData
      );

      console.log('✅ Conductor registrado exitosamente:', conductor.id);

      return {
        message: 'Registro exitoso. Tu cuenta está pendiente de aprobación.',
        conductor: conductor.toPublicJSON(),
        estado: 'pendiente'
      };

    } catch (error) {
      console.error('❌ Error en registro de conductor:', error.message);
      throw error;
    }
  }

  /**
   * Login con DNI y contraseña
   */
  async login(dni, password) {
    try {
      ConductorAuthSchema.validateLogin({ dni, password });
      console.log('✅ Schema de login validado');

      const conductor = await conductorAuthRepository.findConductorByDni(dni);
      if (!conductor) {
        throw new AuthenticationError('DNI no encontrado. Regístrese primero.');
      }

      // ✅ VERIFICAR ESTADO DEL CONDUCTOR
      if (conductor.estado !== 'activo') {
        if (conductor.estado === 'pendiente') {
          throw new AuthenticationError('Su cuenta está pendiente de aprobación. Contacte al administrador.');
        } else if (conductor.estado === 'rechazado') {
          throw new AuthenticationError('Su cuenta ha sido rechazada. Contacte al administrador.');
        } else if (conductor.estado === 'suspendido') {
          throw new AuthenticationError('Su cuenta está suspendida. Contacte al administrador.');
        } else {
          throw new AuthenticationError('Cuenta inactiva. Contacte al administrador.');
        }
      }

      // ✅ VERIFICAR CONTRASEÑA
      const isPasswordValid = await conductor.verificarPassword(password);
      if (!isPasswordValid) {
        throw new AuthenticationError('DNI o contraseña incorrectos');
      }

      // ✅ GENERAR TOKENS
      const tokens = this.generateTokens(conductor);

      // ✅ CREAR SESIÓN
      await this.createSession(conductor.id, tokens.refreshToken);

      console.log('✅ Login exitoso para conductor:', conductor.dni);

      return {
        message: 'Inicio de sesión exitoso',
        conductor: conductor.toPublicJSON(),
        tokens
      };

    } catch (error) {
      console.error('❌ Error en login de conductor:', error.message);
      throw error;
    }
  }

  /**
   * Renovar access token usando refresh token
   */
  async refreshToken(refreshToken) {
    if (!refreshToken) {
      throw new AuthenticationError('Refresh token requerido');
    }

    const session = await conductorAuthRepository.findActiveSession(refreshToken);
    if (!session || !session.conductor) {
      throw new AuthenticationError('Sesión inválida o expirada');
    }

    const tokenPayload = {
      conductorId: session.conductor.id,
      dni: session.conductor.dni,
      tipo: 'conductor'
    };

    const newAccessToken = generateAccessToken(tokenPayload);

    return { accessToken: newAccessToken };
  }

  /**
   * Cerrar sesión
   */
  async logout(refreshToken) {
    if (refreshToken) {
      await conductorAuthRepository.deactivateSession(refreshToken);
    }

    return { message: 'Sesión cerrada exitosamente' };
  }

  /**
   * Obtener perfil del conductor
   */
  async getProfile(conductorId) {
    const conductor = await conductorAuthRepository.findConductorById(conductorId);
    const stats = await conductorAuthRepository.getConductorStats(conductorId);
    
    return {
      ...conductor.toPublicJSON(),
      estadisticas: stats
    };
  }

  /**
   * Actualizar perfil del conductor
   */
  async updateProfile(conductorId, updateData) {
    ConductorAuthSchema.validateUpdateProfile(updateData);

    const conductor = await conductorAuthRepository.updateConductor(conductorId, updateData);

    return {
      message: 'Perfil actualizado exitosamente',
      conductor: conductor.toPublicJSON()
    };
  }

  /**
   * Agregar vehículo
   */
  async addVehicle(conductorId, vehiculoData) {
    ConductorAuthSchema.validateAddVehicle(vehiculoData);

    const vehiculo = await conductorAuthRepository.addVehicle(conductorId, {
      ...vehiculoData,
      placa: vehiculoData.placa.toUpperCase()
    });

    return {
      message: 'Vehículo agregado exitosamente',
      vehiculo
    };
  }

  /**
   * Obtener vehículos del conductor
   */
  async getVehicles(conductorId) {
    const vehiculos = await conductorAuthRepository.getConductorVehicles(conductorId);
    return vehiculos;
  }

  /**
   * Subir/actualizar documentos
   */
  async uploadDocuments(conductorId, documentoData) {
    ConductorAuthSchema.validateUploadDocuments(documentoData);

    const documento = await conductorAuthRepository.updateDocuments(conductorId, documentoData);

    return {
      message: 'Documentos subidos exitosamente. Pendiente de verificación.',
      documento
    };
  }

  /**
   * Actualizar ubicación
   */
  async updateLocation(conductorId, lat, lng) {
    ConductorAuthSchema.validateLocation({ lat, lng });

    const conductor = await conductorAuthRepository.updateLocation(conductorId, lat, lng);

    return {
      message: 'Ubicación actualizada exitosamente',
      ubicacion: {
        lat: conductor.ubicacion_lat,
        lng: conductor.ubicacion_lng
      }
    };
  }

  /**
   * Cambiar disponibilidad
   */
  async updateAvailability(conductorId, disponible) {
    ConductorAuthSchema.validateAvailability({ disponible });

    const conductor = await conductorAuthRepository.updateAvailability(conductorId, disponible);

    return {
      message: `Estado cambiado a ${disponible ? 'disponible' : 'no disponible'}`,
      disponible: conductor.disponible
    };
  }

  /**
   * Buscar conductores disponibles (para admin o testing)
   */
  async findAvailableConductors(lat, lng, radius = 5) {
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      throw new ValidationError('Coordenadas inválidas');
    }

    const conductores = await conductorAuthRepository.findAvailableConductorsNear(lat, lng, radius);

    return conductores.map(conductor => ({
      id: conductor.id,
      nombre_completo: conductor.nombre_completo,
      telefono: conductor.telefono,
      ubicacion: {
        lat: conductor.ubicacion_lat,
        lng: conductor.ubicacion_lng
      },
      vehiculos: conductor.vehiculos,
      total_viajes: conductor.total_viajes
    }));
  }

  /**
   * Generar tokens de acceso y refresco
   */
  generateTokens(conductor) {
    const tokenPayload = {
      conductorId: conductor.id,
      dni: conductor.dni,
      tipo: 'conductor'
    };

    return {
      accessToken: generateAccessToken(tokenPayload),
      refreshToken: generateRefreshToken(tokenPayload)
    };
  }

  /**
   * Crear sesión en la base de datos
   */
  async createSession(conductorId, refreshToken) {
    return await conductorAuthRepository.createSession(conductorId, refreshToken);
  }
}

module.exports = new ConductorAuthService();