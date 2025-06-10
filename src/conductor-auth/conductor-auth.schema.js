const { ValidationError } = require('../utils/errors');

class ConductorAuthSchema {
  
  static validateRegister(data) {
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
    } = data;
    
    // Validar DNI
    if (!dni || typeof dni !== 'string') {
      throw new ValidationError('DNI es requerido');
    }
    
    if (!/^[0-9]{8}$/.test(dni)) {
      throw new ValidationError('DNI debe tener 8 dígitos numéricos');
    }
    
    // Validar nombre completo
    if (!nombre_completo || typeof nombre_completo !== 'string') {
      throw new ValidationError('Nombre completo es requerido');
    }
    
    if (nombre_completo.length < 2 || nombre_completo.length > 100) {
      throw new ValidationError('Nombre completo debe tener entre 2 y 100 caracteres');
    }
    
    // Validar teléfono
    if (!telefono || typeof telefono !== 'string') {
      throw new ValidationError('Número de teléfono es requerido');
    }
    
    const phoneRegex = /^[\+]?[0-9]{8,15}$/;
    if (!phoneRegex.test(telefono.replace(/\s/g, ''))) {
      throw new ValidationError('Formato de teléfono inválido');
    }
    
    // Validar contraseña
    if (!password || typeof password !== 'string') {
      throw new ValidationError('Contraseña es requerida');
    }
    
    if (password.length < 6) {
      throw new ValidationError('La contraseña debe tener al menos 6 caracteres');
    }
    
    // Validar foto de perfil (opcional)
    if (foto_perfil && !this.isValidUrl(foto_perfil)) {
      throw new ValidationError('URL de foto de perfil inválida');
    }
    
    // Validar placa
    if (!placa || typeof placa !== 'string') {
      throw new ValidationError('Placa del vehículo es requerida');
    }
    
    if (!/^[A-Z0-9\-]{6,10}$/i.test(placa)) {
      throw new ValidationError('Formato de placa inválido');
    }
    
    // Validar foto lateral (opcional)
    if (foto_lateral && !this.isValidUrl(foto_lateral)) {
      throw new ValidationError('URL de foto lateral inválida');
    }
    
    // Validar foto brevete
    if (!foto_brevete || typeof foto_brevete !== 'string') {
      throw new ValidationError('Foto del brevete es requerida');
    }
    
    if (!this.isValidUrl(foto_brevete)) {
      throw new ValidationError('URL de foto del brevete inválida');
    }
    
    // Validar fecha de expiración del brevete (opcional)
    if (fecha_expiracion_brevete && !/^\d{4}-\d{2}-\d{2}$/.test(fecha_expiracion_brevete)) {
      throw new ValidationError('Formato de fecha de expiración inválido (YYYY-MM-DD)');
    }
    
    return true;
  }

  static validateLogin(data) {
    const { dni, password } = data;
    
    if (!dni || typeof dni !== 'string') {
      throw new ValidationError('DNI es requerido');
    }
    
    if (!/^[0-9]{8}$/.test(dni)) {
      throw new ValidationError('DNI debe tener 8 dígitos numéricos');
    }
    
    if (!password || typeof password !== 'string') {
      throw new ValidationError('Contraseña es requerida');
    }
    
    return true;
  }

  static validateUpdateProfile(data) {
    const { nombre_completo, telefono, foto_perfil } = data;
    
    if (nombre_completo !== undefined) {
      if (typeof nombre_completo !== 'string' || nombre_completo.length < 2 || nombre_completo.length > 100) {
        throw new ValidationError('Nombre completo debe tener entre 2 y 100 caracteres');
      }
    }
    
    if (telefono !== undefined) {
      if (typeof telefono !== 'string') {
        throw new ValidationError('Teléfono debe ser una cadena');
      }
      
      const phoneRegex = /^[\+]?[0-9]{8,15}$/;
      if (!phoneRegex.test(telefono.replace(/\s/g, ''))) {
        throw new ValidationError('Formato de teléfono inválido');
      }
    }
    
    if (foto_perfil !== undefined && foto_perfil !== null && !this.isValidUrl(foto_perfil)) {
      throw new ValidationError('URL de foto de perfil inválida');
    }
    
    return true;
  }

  static validateAddVehicle(data) {
    const { placa, foto_lateral } = data;
    
    if (!placa || typeof placa !== 'string') {
      throw new ValidationError('Placa es requerida');
    }
    
    if (!/^[A-Z0-9\-]{6,10}$/i.test(placa)) {
      throw new ValidationError('Formato de placa inválido');
    }
    
    if (foto_lateral && !this.isValidUrl(foto_lateral)) {
      throw new ValidationError('URL de foto lateral inválida');
    }
    
    return true;
  }

  static validateUploadDocuments(data) {
    const { foto_brevete, fecha_expiracion } = data;
    
    if (!foto_brevete || typeof foto_brevete !== 'string') {
      throw new ValidationError('Foto del brevete es requerida');
    }
    
    if (!this.isValidUrl(foto_brevete)) {
      throw new ValidationError('URL de foto del brevete inválida');
    }
    
    if (fecha_expiracion && !/^\d{4}-\d{2}-\d{2}$/.test(fecha_expiracion)) {
      throw new ValidationError('Formato de fecha de expiración inválido (YYYY-MM-DD)');
    }
    
    return true;
  }

  static validateLocation(data) {
    const { lat, lng } = data;
    
    if (typeof lat !== 'number' || lat < -90 || lat > 90) {
      throw new ValidationError('Latitud debe ser un número entre -90 y 90');
    }
    
    if (typeof lng !== 'number' || lng < -180 || lng > 180) {
      throw new ValidationError('Longitud debe ser un número entre -180 y 180');
    }
    
    return true;
  }

  static validateAvailability(data) {
    const { disponible } = data;
    
    if (typeof disponible !== 'boolean') {
      throw new ValidationError('Disponibilidad debe ser true o false');
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

module.exports = ConductorAuthSchema;