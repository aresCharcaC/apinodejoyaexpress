const { Usuario, Sesion } = require('../models');
const { generateId } = require('./auth.util');
const { NotFoundError, ConflictError } = require('../utils/errors');

class AuthRepository {
  
  /**
   * Buscar usuario por teléfono
   */
  async findUserByPhone(telefono) {
    return await Usuario.findOne({
      where: { telefono }
    });
  }

  /**
   * Buscar usuario por ID
   */
  async findUserById(id) {
    const user = await Usuario.findByPk(id);
    if (!user) {
      throw new NotFoundError('Usuario no encontrado');
    }
    return user;
  }

  /**
   * Crear nuevo usuario
   */
  async createUser(userData) {
    try {
      const user = await Usuario.create(userData);
      return user.toPublicJSON(); // Sin contraseña
    } catch (error) {
      if (error.name === 'SequelizeUniqueConstraintError') {
        throw new ConflictError('El número de teléfono ya está registrado');
      }
      throw error;
    }
  }

  /**
   * Actualizar contraseña del usuario
   */
  async updateUserPassword(userId, nuevaContrasena) {
    const user = await this.findUserById(userId);
    user.password = nuevaContrasena; // Se hasheará automáticamente por el hook
    await user.save();
    return user.toPublicJSON();
  }

  /**
   * Crear sesión en la base de datos
   */
  async createSession(sessionData) {
    return await Sesion.create(sessionData);
  }

  /**
   * Buscar sesión activa por token
   */
  async findActiveSession(token) {
    return await Sesion.findOne({
      where: { 
        token,
        activa: true,
        fecha_expiracion: {
          [require('sequelize').Op.gt]: new Date()
        }
      },
      include: [
        {
          model: Usuario,
          as: 'pasajero',
          attributes: ['id', 'telefono', 'nombre_completo', 'email']
        }
      ]
    });
  }

  /**
   * Desactivar sesión
   */
  async deactivateSession(token) {
    const session = await Sesion.findOne({ where: { token } });
    if (session) {
      await session.desactivar();
    }
  }

  /**
   * Desactivar todas las sesiones de un usuario
   */
  async deactivateAllUserSessions(userId) {
    await Sesion.update(
      { activa: false },
      { where: { pasajero_id: userId } }
    );
  }
  // actualizar usuario
  async updateUser(userId, userData) {
    try {
      const user = await Usuario.findByPk(userId);
      if (!user) {
        throw new NotFoundError('Usuario no encontrado');
      }
      
      await user.update(userData);
      return user;
    } catch (error) {
      if (error.name === 'SequelizeUniqueConstraintError') {
        throw new ConflictError('El número de teléfono ya está registrado');
      }
      throw error;
    }
  }

  /**
   * Limpiar sesiones expiradas
   */
  async cleanExpiredSessions() {
    const count = await Sesion.destroy({
      where: {
        [require('sequelize').Op.or]: [
          { fecha_expiracion: { [require('sequelize').Op.lt]: new Date() } },
          { activa: false }
        ]
      }
    });
    return count;
  }
}

module.exports = new AuthRepository();