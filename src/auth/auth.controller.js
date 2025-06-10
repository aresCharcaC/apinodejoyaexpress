const authService = require('./auth.service');
const { AppError } = require('../utils/errors');
const smsService = require('./sms.service');

class AuthController {

  /**
   * POST /api/auth/send-code
   * Envía instruccines par poder enviar còdigo por whatsapp
   */
   async sendCode(req, res) {
      console.log('\n🔥 === SEND CODE DEBUG ===');
  console.log('Headers completos:', req.headers);
  console.log('Body recibido:', req.body);
  console.log('Method:', req.method);
  console.log('URL completa:', req.url);
  console.log('Host:', req.get('host'));
  console.log('User-Agent:', req.get('user-agent'));
  console.log('=========================\n');
   try {
      const { telefono } = req.body;
      
      if (!telefono) {
              console.log('❌ Teléfono faltante en body:', req.body);
        return res.status(400).json({
          success: false,
          message: 'El número de teléfono es requerido'
        });
      }
      
      // ✅ VALIDAR Y FORMATEAR TELÉFONO
      const formattedPhone = smsService.formatPhoneNumber(telefono);
      
      if (!smsService.validatePhoneFormat(formattedPhone)) {
        return res.status(400).json({
          success: false,
          message: 'Formato de teléfono inválido. Use formato internacional (+57XXXXXXXXX)'
        });
      }
      
      // ✅ RESPONDER CON INSTRUCCIONES Y DATOS PARA FLUTTER
      res.status(200).json({
        success: true,
        message: 'Listo para verificación por WhatsApp',
        data: {
          telefono: formattedPhone,
          whatsapp: {
            number: '+14155238886', // Número de tu bot de Twilio
            message: 'Quiero mi codigo', // Mensaje predefinido
            url: `https://wa.me/14155238886?text=Quiero%20mi%20codigo` // URL para abrir WhatsApp
          },
          instructions: [
            '🔥 Presiona el botón "Abrir WhatsApp"',
            '📤 Envía el mensaje (ya está escrito)',
            '⏳ Espera tu código de 6 dígitos',
            '🔐 Ingresa el código en la app'
          ],
          provider: 'twilio-whatsapp-manual',
          timestamp: new Date().toISOString()
        }
      });
      
    } catch (error) {
      this.handleError(res, error);
    }
  }

  /**
   * POST /api/auth/twilio/webhook
   * PROCESAR MENSAJES DE TWILIO - AQUÍ SÍ SE ENVÍA EL CÓDIGO
   */

async twilioWebhook(req, res) {
  try {
    console.log('\n🔥 === TWILIO WEBHOOK DEBUG ===');
    console.log('Headers:', req.headers);
    console.log('Body completo:', req.body);
    console.log('===============================\n');

    const { Body: incomingMessage, From: fromNumber } = req.body;

    if (!incomingMessage || !fromNumber) {
      console.log('❌ Webhook incompleto:', { incomingMessage, fromNumber });
      return res.status(400).send('Webhook incompleto');
    }

    console.log(`📞 Webhook recibido: "${incomingMessage}" de ${fromNumber}`);

    //  ASEGURAR FORMATO WHATSAPP CORRECTO
    let cleanFromNumber = fromNumber;
    
    //  SI NO TIENE PREFIJO WHATSAPP, AGREGARLO
    if (!fromNumber.startsWith('whatsapp:')) {
      // Limpiar número si viene con prefijo incorrecto
      cleanFromNumber = fromNumber.replace(/^tel:/, '').replace(/^sms:/, '');
      
      // Asegurar formato +país
      if (!cleanFromNumber.startsWith('+')) {
        // Si es número peruano sin +51
        if (cleanFromNumber.length === 9) {
          cleanFromNumber = '+51' + cleanFromNumber;
        } else {
          cleanFromNumber = '+' + cleanFromNumber;
        }
      }
      
      // AGREGAR PREFIJO WHATSAPP
      cleanFromNumber = `whatsapp:${cleanFromNumber}`;
    }

    console.log(`📱 Número original: ${fromNumber}`);
    console.log(`📱 Número corregido: ${cleanFromNumber}`);

    //  PROCESAR CON NÚMERO CORREGIDO
    const result = await smsService.processWebhookMessage(incomingMessage, cleanFromNumber);

    if (result.success) {
      console.log(`✅ Webhook procesado exitosamente:`, {
        provider: result.provider,
        messageSid: result.messageSid,
        telefono: result.telefono,
        code: result.code // Solo para debug
      });

      // RESPUESTA VACÍA PARA TWILIO (evitar loops)
      res.status(200).send('');
    } else {
      console.log(`⚠️ Error procesando webhook: ${result.error}`);
      
      // ✅ ENVIAR MENSAJE DE AYUDA SI HAY ERROR
      if (result.error !== 'Mensaje no reconocido') {
        try {
          const helpResult = await smsService._sendHelpResponse(cleanFromNumber);
          console.log(`💬 Mensaje de ayuda enviado: ${helpResult.messageSid}`);
        } catch (helpError) {
          console.error('❌ Error enviando ayuda:', helpError.message);
        }
      }
      
      res.status(200).send('');
    }

  } catch (error) {
    console.error('❌ Error en twilioWebhook:', error.message);
    console.error('❌ Stack:', error.stack);
    
    // ✅ SIEMPRE RESPONDER 200 A TWILIO
    res.status(200).send('');
  }
}
  /**
   * ✅ POST /api/auth/verify-code
   * Verificar código recibido por WhatsApp
   */

    async verifyCode(req, res) {
        console.log('\n🔥 === VERIFY CODE DEBUG ===');
  console.log('Headers completos:', req.headers);
  console.log('Body recibido:', req.body);
  console.log('Method:', req.method);
  console.log('URL completa:', req.url);
  console.log('==============================\n');
    try {
      const { telefono, codigo } = req.body;
          console.log(`📱 Parámetros recibidos: telefono="${telefono}", codigo="${codigo}"`);
      if (!telefono || !codigo) {
              console.log('❌ Parámetros faltantes:', { telefono, codigo });
        return res.status(400).json({
          success: false,
          message: 'Teléfono y código son requeridos'
        });
      }

      if (codigo.length !== 6) {
        return res.status(400).json({
          success: false,
          message: 'El código debe tener 6 dígitos'
        });
      }

      // ✅ VERIFICAR CÓDIGO
      const result = await authService.verifyCode(telefono, codigo);
      
      res.status(200).json({
        success: true,
        data: result
      });
      
    } catch (error) {
            console.log('❌ Error en verifyCode:', error.message);
    
            // ✅ MANEJO DE ERROR CORRECTO
            if (error.message.includes('expirado') || error.message.includes('no encontrado')) {
              return res.status(400).json({
                success: false,
                message: 'Código expirado o no encontrado. Solicita uno nuevo por WhatsApp.'
              });
            }
            
            if (error.message.includes('incorrecto')) {
              return res.status(400).json({
                success: false,
                message: 'Código incorrecto. Verifica e intenta de nuevo.'
              });
            }
            
            // ✅ ERROR GENERAL
            res.status(500).json({
              success: false,
              message: 'Error interno del servidor',
              ...(process.env.NODE_ENV === 'development' && {
                error: error.message,
                stack: error.stack
              })
            });
    }
  }

  /**
   * POST /api/auth/register
   * Completa el registro con todos los datos
   */
  async register(req, res) {
    try {
      const { telefono, tempToken, password, nombre_completo, email, foto_perfil } = req.body;
      console.log('📱 Iniciando registro para:', telefono);

      const result = await authService.completeRegistration({
        telefono,
        tempToken,
        password,
        nombre_completo,
        email,
        foto_perfil
      });
         console.log('✅ Registro completado exitosamente en controller');
        console.log('🔍 Result structure:', Object.keys(result));
      // Configurar cookies
     
        if (result.tokens) {
      // ✅ CONFIGURAR COOKIES MANUALMENTE
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 días
      };

      res.cookie('refreshToken', result.tokens.refreshToken, cookieOptions);
      console.log('🍪 Cookies configuradas');
    }
      res.status(201).json({
        success: true,
        data: {
          message: result.message,
          user: result.user,
          accessToken: result.tokens?.accessToken
        }
      });
    } catch (error) {
       console.error('❌ Error en register controller:', error.message);
    console.error('❌ Stack:', error.stack);
     handleRegistrationError(res, error);
    }
  }

  /**
   * POST /api/auth/login
   * Login con teléfono y contraseña
   */
async login(req, res) {
  try {
    const { telefono, password } = req.body;
    console.log("💀 Estoy entrando al metodo para ingresar a login");
    
    // ✅ VALIDACIONES BÁSICAS
    if (!telefono || !password) {
      return res.status(400).json({
        success: false,
        message: 'Teléfono y contraseña son requeridos'
      });
    }



    // ✅ FORMATEAR TELÉFONO
    const smsService = require('./sms.service');
    const formattedPhone = smsService.formatPhoneNumber(telefono);
    console.log(`📱 Teléfono formateado: ${formattedPhone}`);

    // ✅ INTENTAR LOGIN
    const result = await authService.login(formattedPhone, password); 
    console.log("💀 Ya salí del metodo para ingresar a login");

    // ✅ CONFIGURAR COOKIES MANUALMENTE (SIN THIS)
    if (result.tokens) {
      // Access Token - 15 minutos
      res.cookie('accessToken', result.tokens.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 15 * 60 * 1000
      });

      // Refresh Token - 1 semana
      res.cookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      console.log('🍪 Cookies de autenticación configuradas');
    }
    
    res.status(200).json({
      success: true,
      data: {
        message: result.message,
        user: result.user,
        accessToken: result.tokens?.accessToken
      }
    });

  } catch (error) {
    console.error('❌ Error en login controller:', error.message);
    console.error('❌ Stack:', error.stack);

    handleLoginError(res, error);
  }
}

  /**
   * POST /api/auth/refresh
   * Renovar access token
   */

async refreshToken(req, res) {
  try {
    const refreshToken = req.cookies.refreshToken;
    
    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token requerido'
      });
    }
    
    const result = await authService.refreshToken(refreshToken);
    
    // Configurar solo el nuevo access token
    res.cookie('accessToken', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000 // 15 minutos
    });
    
    res.status(200).json({
      success: true,
      data: { message: 'Token renovado exitosamente' }
    });
    
  } catch (error) {
    console.error('❌ Error en refreshToken controller:', error.message);
    
    // ✅ MANEJO DE ERRORES SIN THIS
    if (error.message.includes('Refresh token requerido')) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token requerido'
      });
    }
    
    if (error.message.includes('Sesión inválida') || error.message.includes('expirada')) {
      return res.status(401).json({
        success: false,
        message: 'Sesión expirada. Inicie sesión nuevamente.'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      ...(process.env.NODE_ENV === 'development' && {
        error: error.message
      })
    });
  }
}

  /**
   * POST /api/auth/logout
   * Cerrar sesión
   */

async logout(req, res) {
  try {
    const refreshToken = req.cookies.refreshToken;
    
    await authService.logout(refreshToken);
    
    // Limpiar cookies
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    
    res.status(200).json({
      success: true,
      data: { message: 'Sesión cerrada exitosamente' }
    });
    
  } catch (error) {
    console.error('❌ Error en logout controller:', error.message);
    
    // ✅ MANEJO DE ERRORES SIN THIS
    res.status(500).json({
      success: false,
      message: 'Error cerrando sesión',
      ...(process.env.NODE_ENV === 'development' && {
        error: error.message
      })
    });
  }
}

  /**
   * POST /api/auth/forgot-password
   * Solicitar código para recuperar contraseña
   */
async forgotPassword(req, res) {
  try {
    console.log('\n🔥 === FORGOT PASSWORD DEBUG ===');
    console.log('Body recibido:', req.body);
    console.log('================================\n');
    
    const { telefono } = req.body;
    
    // ✅ VALIDACIONES BÁSICAS
    if (!telefono) {
      return res.status(400).json({
        success: false,
        message: 'El número de teléfono es requerido'
      });
    }
    
    console.log('📱 Iniciando recuperación para:', telefono);
    
    // ✅ LLAMAR SERVICIO
    const result = await authService.forgotPassword(telefono);
    
    console.log('✅ Código de recuperación procesado');
    
    // ✅ RESPUESTA EXITOSA
    res.status(200).json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('❌ Error en forgotPassword controller:', error.message);
    console.error('❌ Stack:', error.stack);
    
    // ✅ MANEJO DE ERRORES SIN THIS
    handleForgotPasswordError(res, error);
  }
}

  /**
   * POST /api/auth/reset-password
   * Verificar código y cambiar contraseña
   */

async resetPassword(req, res) {
  try {
    console.log('\n🔥 === RESET PASSWORD DEBUG ===');
    console.log('Body recibido:', req.body);
    console.log('================================\n');
    
    const { telefono, codigo, nuevaPassword } = req.body;
    
    // ✅ VALIDACIONES BÁSICAS
    if (!telefono || !codigo || !nuevaPassword) {
      return res.status(400).json({
        success: false,
        message: 'Teléfono, código y nueva contraseña son requeridos'
      });
    }

    if (codigo.length !== 6) {
      return res.status(400).json({
        success: false,
        message: 'El código debe tener 6 dígitos'
      });
    }

    if (nuevaPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'La contraseña debe tener al menos 6 caracteres'
      });
    }
    
    console.log('🔐 Iniciando reset de contraseña para:', telefono);
    
    // ✅ LLAMAR SERVICIO
    const result = await authService.resetPassword(telefono, codigo, nuevaPassword);
    
    console.log('✅ Contraseña actualizada exitosamente');
    
    // ✅ RESPUESTA EXITOSA
    res.status(200).json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('❌ Error en resetPassword controller:', error.message);
    console.error('❌ Stack:', error.stack);
    
    // ✅ MANEJO DE ERRORES SIN THIS
    handleResetPasswordError(res, error);
  }
}

  /**
   * GET /api/auth/profile
   * Obtener perfil del usuario autenticado
   */

async getProfile(req, res) {
  try {
    const userId = req.user.userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Token de usuario inválido'
      });
    }
    
    const user = await authService.getProfile(userId);
    
    res.status(200).json({
      success: true,
      data: user
    });
    
  } catch (error) {
    console.error('❌ Error en getProfile controller:', error.message);
    
    // ✅ MANEJO DE ERRORES SIN THIS
    if (error.message.includes('Usuario no encontrado')) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error obteniendo perfil',
      ...(process.env.NODE_ENV === 'development' && {
        error: error.message
      })
    });
  }
}

  /**
   * Configurar cookies de tokens
   */
  setTokenCookies(res, tokens) {
    // Access Token - 15 minutos
    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000
    });

    // Refresh Token - 1 semana
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
  }

  /**
   * Manejar errores de forma consistente
   */
   handleError(res, error) {
    console.error('🔥 Error en AuthController:', error.message);
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
    
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
       ...(process.env.NODE_ENV === 'development' && {
        error: error.message
      })
    });
  }
}
function handleRegistrationError(res, error) {
  console.error('🔥 Error en registro:', error.message);
  
  // ✅ ERRORES ESPECÍFICOS
  if (error.message.includes('Token temporal inválido')) {
    return res.status(400).json({
      success: false,
      message: 'Token temporal inválido o expirado. Verifica tu código primero.'
    });
  }

  if (error.message.includes('ya está registrado')) {
    return res.status(409).json({
      success: false,
      message: 'El usuario ya está registrado. Use login en su lugar.'
    });
  }

  if (error.message.includes('email ya está registrado')) {
    return res.status(409).json({
      success: false,
      message: 'El email ya está registrado.'
    });
  }

  if (error.message.includes('Validation error')) {
    return res.status(400).json({
      success: false,
      message: 'Datos de entrada inválidos'
    });
  }

  // ✅ ERROR GENERAL
  res.status(500).json({
    success: false,
    message: 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && {
      error: error.message
    })
  });
}

function handleLoginError(res, error) {
  console.error('🔥 Error en login:', error.message);
  
  // ✅ ERRORES ESPECÍFICOS DE AUTENTICACIÓN
  if (error.message.includes('Usuario no encontrado')) {
    return res.status(404).json({
      success: false,
      message: 'Usuario no encontrado. Regístrese primero.'
    });
  }

  if (error.message.includes('Credenciales inválidas') || error.message.includes('incorrecto')) {
    return res.status(401).json({
      success: false,
      message: 'Teléfono o contraseña incorrectos.'
    });
  }

  if (error.message.includes('Cuenta inactiva') || error.message.includes('suspendida')) {
    return res.status(403).json({
      success: false,
      message: 'Cuenta inactiva o suspendida. Contacte soporte.'
    });
  }

  if (error.message.includes('Registrese primero')) {
    return res.status(404).json({
      success: false,
      message: 'No hay cuenta asociada a este número. Regístrese primero.'
    });
  }

  // ✅ ERROR GENERAL
  res.status(500).json({
    success: false,
    message: 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && {
      error: error.message
    })
  });
}
function handleForgotPasswordError(res, error) {
  console.error('🔥 Error en forgot password:', error.message);
  
  // ✅ ERRORES ESPECÍFICOS
  if (error.message.includes('Formato de telefono inválido')) {
    return res.status(400).json({
      success: false,
      message: 'Formato de teléfono inválido. Use formato internacional (+51XXXXXXXXX)'
    });
  }
  
  if (error.message.includes('Teléfono es requerido')) {
    return res.status(400).json({
      success: false,
      message: 'El número de teléfono es requerido'
    });
  }
  
  // ✅ ERROR GENERAL (no revelar detalles por seguridad)
  res.status(500).json({
    success: false,
    message: 'Error interno del servidor. Intente nuevamente.',
    ...(process.env.NODE_ENV === 'development' && {
      error: error.message
    })
  });
}


function handleResetPasswordError(res, error) {
  console.error('🔥 Error en reset password:', error.message);
  
  // ✅ ERRORES ESPECÍFICOS DE VERIFICACIÓN
  if (error.message.includes('expirado') || error.message.includes('no encontrado')) {
    return res.status(400).json({
      success: false,
      message: 'Código expirado o no encontrado. Solicite un nuevo código de recuperación.'
    });
  }
  
  if (error.message.includes('incorrecto')) {
    return res.status(400).json({
      success: false,
      message: 'Código incorrecto. Verifique e intente de nuevo.'
    });
  }
  
  if (error.message.includes('Usuario no encontrado')) {
    return res.status(404).json({
      success: false,
      message: 'Usuario no encontrado. Verifique el número de teléfono.'
    });
  }
  
  if (error.message.includes('Token temporal inválido')) {
    return res.status(400).json({
      success: false,
      message: 'Token temporal inválido. Solicite un nuevo código de recuperación.'
    });
  }
  
  // ✅ ERRORES DE VALIDACIÓN
  if (error.message.includes('Teléfono') || error.message.includes('código') || error.message.includes('contraseña')) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
  
  // ✅ ERROR GENERAL
  res.status(500).json({
    success: false,
    message: 'Error interno del servidor. Intente nuevamente.',
    ...(process.env.NODE_ENV === 'development' && {
      error: error.message
    })
  });
}

module.exports = new AuthController();