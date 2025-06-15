const conductorAuthService = require('./conductor-auth.service');
const { AppError } = require('../utils/errors');
const conductor = require('../models/conductor');

class ConductorAuthController {

  /**
   * POST /api/conductor-auth/register
   * Registro completo de conductor con vehículo y documentos
   */
  async register(req, res) {
    try {
      console.log('\n🔥 === CONDUCTOR REGISTER DEBUG ===');
      console.log('Headers completos:', req.headers);
      console.log('Body recibido:', req.body);
      console.log('Method:', req.method);
      console.log('URL completa:', req.url);
      console.log('Host:', req.get('host'));
      console.log('===================================\n');

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
      } = req.body;

      // ✅ VALIDACIONES BÁSICAS DETALLADAS
      const camposFaltantes = [];
      if (!dni) camposFaltantes.push('dni');
      if (!nombre_completo) camposFaltantes.push('nombre_completo');
      if (!telefono) camposFaltantes.push('telefono');
      if (!password) camposFaltantes.push('password');
      if (!placa) camposFaltantes.push('placa');
      if (!foto_brevete) camposFaltantes.push('foto_brevete');

      if (camposFaltantes.length > 0) {
        console.log('❌ Campos faltantes:', camposFaltantes);
        return res.status(400).json({
          success: false,
          message: `Faltan campos requeridos: ${camposFaltantes.join(', ')}`,
          campos_requeridos: {
            dni: 'DNI de 8 dígitos',
            nombre_completo: 'Nombre y apellidos completos',
            telefono: 'Número de teléfono',
            password: 'Contraseña (mínimo 6 caracteres)',
            placa: 'Placa del vehículo',
            foto_brevete: 'URL de la foto del brevete'
          },
          campos_opcionales: {
            foto_perfil: 'URL de foto de perfil',
            foto_lateral: 'URL de foto lateral del vehículo',
            fecha_expiracion_brevete: 'Fecha de expiración del brevete (YYYY-MM-DD)'
          }
        });
      }

      console.log(`📱 Iniciando registro para conductor DNI: ${dni}`);
      console.log(`👤 Nombre: ${nombre_completo}`);
      console.log(`📞 Teléfono: ${telefono}`);
      console.log(`🚗 Placa: ${placa}`);

      // ✅ REGISTRAR CONDUCTOR
      const result = await conductorAuthService.register({
        dni,
        nombre_completo,
        telefono,
        password,
        foto_perfil,
        placa,
        foto_lateral,
        foto_brevete,
        fecha_expiracion_brevete
      });

      console.log('✅ Registro completado exitosamente en controller');
      console.log('🔍 Result structure:', Object.keys(result));

      res.status(201).json({
        success: true,
        data: result
      });

    } catch (error) {
      console.error('❌ Error en register controller:', error.message);
      console.error('❌ Stack:', error.stack);
      //this.handleError(res, error);
      res.status(401).json({
        success: false,
        message: `${error.message}`
      })
    }
  }

  /**
   * POST /api/conductor-auth/login
   * Login con DNI y contraseña
   */
  async login(req, res) {
    try {
      console.log('\n🔥 === CONDUCTOR LOGIN DEBUG ===');
      console.log('Headers completos:', req.headers);
      console.log('Body recibido:', { dni: req.body.dni, password: '[HIDDEN]' });
      console.log('Method:', req.method);
      console.log('URL completa:', req.url);
      console.log('Host:', req.get('host'));
      console.log('User-Agent:', req.get('user-agent'));
      console.log('===============================\n');

      const { dni, password } = req.body;

      // ✅ VALIDACIONES BÁSICAS DETALLADAS
      if (!dni && !password) {
        return res.status(400).json({
          success: false,
          message: 'DNI y contraseña son requeridos',
          ejemplo: {
            dni: '12345678',
            password: 'tuContraseña'
          }
        });
      }

      if (!dni) {
        return res.status(400).json({
          success: false,
          message: 'DNI es requerido',
          formato: 'DNI debe tener 8 dígitos numéricos'
        });
      }

      if (!password) {
        return res.status(400).json({
          success: false,
          message: 'Contraseña es requerida'
        });
      }

      console.log(`📱 Intentando login para conductor DNI: ${dni}`);

      // ✅ INTENTAR LOGIN
      const result = await conductorAuthService.login(dni, password);
      console.log('✅ Login exitoso, configurando cookies...');

      // ✅ CONFIGURAR COOKIES MANUALMENTE
      if (result.tokens) {
        // Access Token - 15 minutos
        res.cookie('accessToken', result.tokens.accessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 15 * 60 * 1000,
          path: '/'
        });

        // Refresh Token - 7 días
        res.cookie('refreshToken', result.tokens.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 7 * 24 * 60 * 60 * 1000,
          path: '/'
        });

        console.log('🍪 Cookies de autenticación configuradas para conductor');
      }

      res.status(200).json({
        success: true,
        data: {
          message: result.message,
          conductor: result.conductor,
          accessToken: result.tokens?.accessToken
        }
      });

    } catch (error) {
      console.error('❌ Error en login controller:', error.message);
      console.error('❌ Stack:', error.stack);
      res.status(401).json({
        success: false,
        message: 'No se pudo autenticar al usuario',
        error: error.message
      });
    }
  }

  /**
   * POST /api/conductor-auth/refresh
   * Renovar access token usando refresh token
   */
  async refreshToken(req, res) {
    try {
      console.log('🔄 Renovando token para conductor...');
      const refreshToken = req.cookies.refreshToken;

      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          message: 'Refresh token requerido. Inicie sesión nuevamente.'
        });
      }

      const result = await conductorAuthService.refreshToken(refreshToken);

      // Configurar solo el nuevo access token
      res.cookie('accessToken', result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 15 * 60 * 1000,
        path: '/'
      });

      console.log('✅ Token renovado exitosamente para conductor');

      res.status(200).json({
        success: true,
        data: { message: 'Token renovado exitosamente' }
      });
    } catch (error) {
      console.error('❌ Error renovando token:', error.message);
      this.handleError(res, error);
    }
  }

  /**
   * POST /api/conductor-auth/logout
   * Cerrar sesión del conductor
   */
  async logout(req, res) {
    try {
      console.log('👋 Cerrando sesión de conductor...');
      const refreshToken = req.cookies.refreshToken;

      await conductorAuthService.logout(refreshToken);

      // Limpiar cookies
      res.clearCookie('accessToken', { path: '/' });
      res.clearCookie('refreshToken', { path: '/' });

      console.log('✅ Sesión cerrada exitosamente');

      res.status(200).json({
        success: true,
        data: { message: 'Sesión cerrada exitosamente' }
      });
    } catch (error) {
      console.error('❌ Error en logout:', error.message);
      this.handleError(res, error);
    }
  }

  /**
   * GET /api/conductor-auth/profile
   * Obtener perfil del conductor autenticado
   */
  async getProfile(req, res) {
    try {
      console.log(`📋 Obteniendo perfil para conductor: ${req.user.conductorId}`);
      
      const conductorId = req.user.conductorId;
      const profile = await conductorAuthService.getProfile(conductorId);

      res.status(200).json({
        success: true,
        data: profile
      });
    } catch (error) {
      console.error('❌ Error obteniendo perfil:', error.message);
      this.handleError(res, error);
    }
  }

  /**
   * PUT /api/conductor-auth/profile
   * Actualizar perfil del conductor
   */
  async updateProfile(req, res) {
    try {
      console.log(`✏️ Actualizando perfil para conductor: ${req.user.conductorId}`);
      console.log('Datos a actualizar:', req.body);

      const conductorId = req.user.conductorId;
      const { nombre_completo, telefono, foto_perfil } = req.body;

      if (!nombre_completo && !telefono && !foto_perfil) {
        return res.status(400).json({
          success: false,
          message: 'Debe proporcionar al menos un campo para actualizar',
          campos_permitidos: ['nombre_completo', 'telefono', 'foto_perfil']
        });
      }

      const result = await conductorAuthService.updateProfile(conductorId, {
        nombre_completo,
        telefono,
        foto_perfil
      });

      console.log('✅ Perfil actualizado exitosamente');

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('❌ Error actualizando perfil:', error.message);
      this.handleError(res, error);
    }
  }

  /**
   * POST /api/conductor-auth/vehicles
   * Agregar vehículo al conductor
   */
  async addVehicle(req, res) {
    try {
      console.log(`🚗 Agregando vehículo para conductor: ${req.user.conductorId}`);
      console.log('Datos del vehículo:', req.body);

      const conductorId = req.user.conductorId;
      const { placa, foto_lateral } = req.body;

      if (!placa) {
        return res.status(400).json({
          success: false,
          message: 'Placa es requerida',
          formato: 'Ejemplo: ABC-123, A1B-234, etc.',
          ejemplo: {
            placa: 'ABC-123',
            foto_lateral: 'https://example.com/vehiculo.jpg'
          }
        });
      }

      const result = await conductorAuthService.addVehicle(conductorId, {
        placa: placa.toUpperCase().trim(),
        foto_lateral
      });

      console.log(`✅ Vehículo agregado: ${placa}`);

      res.status(201).json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('❌ Error agregando vehículo:', error.message);
      this.handleError(res, error);
    }
  }

  /**
   * GET /api/conductor-auth/vehicles
   * Obtener vehículos del conductor
   */
  async getVehicles(req, res) {
    try {
      console.log(`🚗 Obteniendo vehículos para conductor: ${req.user.conductorId}`);
      
      const conductorId = req.user.conductorId;
      const vehiculos = await conductorAuthService.getVehicles(conductorId);

      res.status(200).json({
        success: true,
        data: vehiculos,
        total: vehiculos.length
      });
    } catch (error) {
      console.error('❌ Error obteniendo vehículos:', error.message);
      this.handleError(res, error);
    }
  }

  /**
   * POST /api/conductor-auth/documents
   * Subir/actualizar documentos del conductor
   */
  async uploadDocuments(req, res) {
    try {
      console.log(`📄 Subiendo documentos para conductor: ${req.user.conductorId}`);
      console.log('Datos de documentos:', req.body);

      const conductorId = req.user.conductorId;
      const { foto_brevete, fecha_expiracion } = req.body;

      if (!foto_brevete) {
        return res.status(400).json({
          success: false,
          message: 'Foto del brevete es requerida',
          ejemplo: {
            foto_brevete: 'https://example.com/brevete.jpg',
            fecha_expiracion: '2025-12-31'
          }
        });
      }

      const result = await conductorAuthService.uploadDocuments(conductorId, {
        foto_brevete,
        fecha_expiracion
      });

      console.log('✅ Documentos subidos exitosamente');

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('❌ Error subiendo documentos:', error.message);
      this.handleError(res, error);
    }
  }


  /**
   * PUT /api/conductor-auth/availability
   * Cambiar disponibilidad del conductor
   */
  async updateAvailability(req, res) {
    try {
      console.log(`🟢 Actualizando disponibilidad para conductor: ${req.user.conductorId}`);
      console.log('Nueva disponibilidad:', req.body);

      const conductorId = req.user.conductorId;
      const { disponible, lat, lng } = req.body;

      if (typeof disponible !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: 'Disponibilidad debe ser true o false',
          ejemplo: {
            disponible: true
          },
          opciones: {
            true: 'Disponible para recibir viajes',
            false: 'No disponible'
          }
        });
      }

      // Las coordenadas son opcionales
      // El conductor puede activar disponibilidad sin coordenadas

      const result = await conductorAuthService.updateAvailability(conductorId, disponible, disponible ? {lat, lng}: null);

      // ✅ USAR EL NUEVO SERVICIO DE UBICACIÓN DEL CONDUCTOR
      if(disponible && lat && lng){
        try {
          const driverLocationService = require('../rides/driver-location.service');
          await driverLocationService.startLocationUpdates(conductorId, lat, lng);
          console.log(`✅ Conductor ${conductorId} inicializado para actualizaciones automáticas`);
        } catch (redisError) {
          console.warn(`⚠️ Error inicializando actualizaciones automáticas: ${redisError.message}`);
          // Fallback al servicio básico
          try {
            const locationService = require('../rides/location.service');
            await locationService.initializeDriverLocation(conductorId, lat, lng);
            console.log(`✅ Conductor ${conductorId} inicializado en Redis (fallback)`);
          } catch (fallbackError) {
            console.warn(`⚠️ Error en fallback Redis: ${fallbackError.message}`);
          }
        }
      }
      
      if(!disponible){
        try {
          const driverLocationService = require('../rides/driver-location.service');
          await driverLocationService.stopLocationUpdates(conductorId);
          console.log(`✅ Conductor ${conductorId} desactivado de actualizaciones automáticas`);
        } catch (redisError) {
          console.warn(`⚠️ Error desactivando actualizaciones: ${redisError.message}`);
          // Fallback al servicio básico
          try {
            const locationService = require('../rides/location.service');
            await locationService.deactivateDriver(conductorId);
            console.log(`✅ Conductor ${conductorId} desactivado de Redis (fallback)`);
          } catch (fallbackError) {
            console.warn(`⚠️ Error en fallback desactivación: ${fallbackError.message}`);
          }
        }
      }

      res.status(200).json({
        success: true,
        message: disponible ? 'Disponibilidad activada': 'Disponibilidad desactivada',
        data: {
          conductor_id: conductorId,
          disponible: disponible,
          ubicacion_inicial: disponible ? {lat, lng} : null,
          siguiente_paso: disponible
          ? 'Envía actualizaciones de ubicación a /api/rides/driver/location'
          : 'Conductor desactivado de búsquedas'
        }
      });
    } catch (error) {
      console.error('❌ Error actualizando disponibilidad:', error.message);
      res.status(500).json({
        success: false,
        message: 'Error actualizando disponibilidad',
        error: error.message
      });
    }
  }

  /**
   * GET /api/conductor-auth/available
   * Buscar conductores disponibles cerca de una ubicación
   */
  async getAvailableConductors(req, res) {
    try {
      console.log('🔍 Buscando conductores disponibles...');
      console.log('Query params:', req.query);

      const { lat, lng, radius } = req.query;

      if (!lat || !lng) {
        return res.status(400).json({
          success: false,
          message: 'Latitud y longitud son requeridas',
          ejemplo: '/api/conductor-auth/available?lat=-12.0464&lng=-77.0428&radius=5',
          parametros: {
            lat: 'Latitud (número)',
            lng: 'Longitud (número)',
            radius: 'Radio en kilómetros (opcional, default: 5)'
          }
        });
      }

      const conductores = await conductorAuthService.findAvailableConductors(
        parseFloat(lat),
        parseFloat(lng),
        radius ? parseFloat(radius) : 5
      );

      console.log(`✅ Encontrados ${conductores.length} conductores disponibles`);

      res.status(200).json({
        success: true,
        data: conductores,
        total: conductores.length,
        ubicacion_busqueda: {
          lat: parseFloat(lat),
          lng: parseFloat(lng),
          radio_km: radius ? parseFloat(radius) : 5
        }
      });
    } catch (error) {
      console.error('❌ Error buscando conductores:', error.message);
      this.handleError(res, error);
    }
  }

  /**
   * Manejar errores específicos de login
   */
  handleLoginError(res, error) {
    console.error('🔥 Error en login:', error.message);
    
    // ✅ ERRORES ESPECÍFICOS DE AUTENTICACIÓN
    if (error.message.includes('DNI no encontrado')) {
      return res.status(404).json({
        success: false,
        message: 'DNI no encontrado. Regístrese primero.',
        accion: 'Registrarse en /api/conductor-auth/register'
      });
    }

    if (error.message.includes('pendiente de aprobación')) {
      return res.status(403).json({
        success: false,
        message: 'Su cuenta está pendiente de aprobación por el administrador.',
        estado: 'pendiente',
        accion: 'Espere la aprobación del administrador'
      });
    }

    if (error.message.includes('rechazada')) {
      return res.status(403).json({
        success: false,
        message: 'Su cuenta ha sido rechazada. Contacte al administrador.',
        estado: 'rechazado',
        accion: 'Contactar administrador'
      });
    }

    if (error.message.includes('suspendida')) {
      return res.status(403).json({
        success: false,
        message: 'Su cuenta está suspendida. Contacte al administrador.',
        estado: 'suspendido',
        accion: 'Contactar administrador'
      });
    }

    if (error.message.includes('DNI o contraseña incorrectos') || error.message.includes('incorrecto')) {
      return res.status(401).json({
        success: false,
        message: 'DNI o contraseña incorrectos. Verifique sus credenciales.',
        sugerencia: 'Asegúrese de ingresar el DNI de 8 dígitos y la contraseña correcta'
      });
    }

    if (error.message.includes('inactiva')) {
      return res.status(403).json({
        success: false,
        message: 'Cuenta inactiva. Contacte al administrador.',
        estado: 'inactivo'
      });
    }

    // ✅ ERROR GENERAL
    this.handleError(res, error);
  }

  /**
   * Manejar errores de forma consistente
   */
  handleError(res, error) {
    console.error('🔥 Error en ConductorAuthController:', error.message);
    console.error('🔥 Stack:', error.stack);

    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
        ...(process.env.NODE_ENV === 'development' && {
          stack: error.stack
        })
      });
    }

    // Errores específicos de Sequelize
    if (error.name === 'SequelizeUniqueConstraintError') {
      const field = error.errors[0]?.path;
      let message = 'Ya existe un registro con estos datos';
      let sugerencia = '';
      
      if (field === 'dni') {
        message = 'Ya existe un conductor registrado con este DNI';
        sugerencia = 'Si ya tienes cuenta, usa el login. Si olvidaste tu contraseña, contacta al administrador.';
      } else if (field === 'telefono') {
        message = 'Ya existe un conductor registrado con este teléfono';
        sugerencia = 'Usa un número de teléfono diferente o contacta al administrador.';
      } else if (field === 'placa') {
        message = 'Ya existe un vehículo registrado con esta placa';
        sugerencia = 'Verifica que la placa sea correcta o contacta al administrador.';
      }

      return res.status(409).json({
        success: false,
        message,
        sugerencia,
        campo_duplicado: field
      });
    }

    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        errores: error.errors.map(err => ({
          campo: err.path,
          mensaje: err.message,
          valor: err.value
        }))
      });
    }

    if (error.name === 'SequelizeForeignKeyConstraintError') {
      return res.status(400).json({
        success: false,
        message: 'Error de referencia en los datos',
        detalle: 'Uno de los datos proporcionados no existe en el sistema'
      });
    }

    // Error general
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      timestamp: new Date().toISOString(),
      ...(process.env.NODE_ENV === 'development' && {
        error: error.message,
        stack: error.stack
      })
    });
  }
}

module.exports = new ConductorAuthController();
