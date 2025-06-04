const { ValidationError } = require('../utils/errors');

class AuthSchema {
  
  static validateSendCode(data) {
    const { telefono } = data;
    
    if (!telefono || typeof telefono !== 'string') {
      throw new ValidationError('Número de teléfono es requerido');
    }
    
    const phoneRegex = /^[\+]?[0-9]{8,15}$/;
    if (!phoneRegex.test(telefono.replace(/\s/g, ''))) {
      throw new ValidationError('Formato de teléfono inválido');
    }
    
    return true;
  }

  static validateVerifyCode(data) {
    const { telefono, codigo } = data;
    
    if (!telefono || typeof telefono !== 'string') {
      throw new ValidationError('Número de teléfono es requerido');
    }
    
    if (!codigo || typeof codigo !== 'string') {
      throw new ValidationError('Código de verificación es requerido');
    }
    
    if (codigo.length !== 6 || !/^\d{6}$/.test(codigo)) {
      throw new ValidationError('El código debe tener 6 dígitos');
    }
    
    return true;
  }

  static validateCompleteRegistration(data) {
    const { telefono, tempToken, password, nombre_completo, email, foto_perfil } = data;
    
    if (!telefono || typeof telefono !== 'string') {
      throw new ValidationError('Número de teléfono es requerido');
    }
    
    if (!tempToken || typeof tempToken !== 'string') {
      throw new ValidationError('Token de verificación requerido');
    }
    
    if (!password || typeof password !== 'string') {
      throw new ValidationError('Contraseña es requerida');
    }
    
    if (password.length < 6) {
      throw new ValidationError('La contraseña debe tener al menos 6 caracteres');
    }
    
    if (!nombre_completo || typeof nombre_completo !== 'string') {
      throw new ValidationError('Nombre completo es requerido');
    }
    
    if (nombre_completo.length < 2) {
      throw new ValidationError('Nombre completo debe tener al menos 2 caracteres');
    }
   // se deve validar antes el correo 
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ValidationError('Formato de email inválido');
    }
    // podrìamos estar empezando con el almacenamineto de ES3 
    if (foto_perfil && !this.isValidUrl(foto_perfil)) {
      throw new ValidationError('URL de foto de perfil inválida');
    }
    
    return true;
  }

  static validateLogin(data) {
    const { telefono, password } = data;
    
    if (!telefono || typeof telefono !== 'string') {
      throw new ValidationError('Número de teléfono es requerido');
    }
    
    if (!password || typeof password !== 'string') {
      throw new ValidationError('Contraseña es requerida');
    }
    
    return true;
  }

  static validateForgotPassword(data) {
    const { telefono } = data;
    
    if (!telefono || typeof telefono !== 'string') {
      throw new ValidationError('Número de teléfono es requerido');
    }
    
    return true;
  }

  static validateResetPassword(data) {
    const { telefono, codigo, nuevaPassword } = data;
    
    if (!telefono || typeof telefono !== 'string') {
      throw new ValidationError('Número de teléfono es requerido');
    }
    
    if (!codigo || typeof codigo !== 'string') {
      throw new ValidationError('Código de verificación es requerido');
    }
    
    if (codigo.length !== 6 || !/^\d{6}$/.test(codigo)) {
      throw new ValidationError('El código debe tener 6 dígitos');
    }
    
    if (!nuevaPassword || typeof nuevaPassword !== 'string') {
      throw new ValidationError('Nueva contraseña es requerida');
    }
    
    if (nuevaPassword.length < 6) {
      throw new ValidationError('La nueva contraseña debe tener al menos 6 caracteres');
    }
    
    return true;
  }

  static isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }
}

module.exports = AuthSchema;