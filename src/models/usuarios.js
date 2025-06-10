'use strict';
const { Model } = require('sequelize');
const bcrypt = require('bcryptjs');

module.exports = (sequelize, DataTypes) => {
  class Usuario extends Model {
    static associate(models) {
      Usuario.hasMany(models.Viaje, {
        foreignKey: 'usuario_id',
        as: 'viajes'
      })

       Usuario.hasMany(models.MetodoPago, {
        foreignKey: 'usuario_id',
        as: 'metodosDePago'
      });
      Usuario.hasMany(models.Sesion, {
        foreignKey: 'pasajero_id',
        as: 'sesiones'
      });
     
    }

    // corregio a 'password'
    async verificarPassword(password) {
      if (!this.password) return false;
      return await bcrypt.compare(password, this.password);
    }

  
    toPublicJSON() {
      const user = this.toJSON();
      delete user.password; // ← Cambio aquí
      delete user.token_recuperacion_contrasena;
      delete user.fecha_expiracion_token_recuperacion;
      return user;
    }

    
    static async hashPassword(usuario) {
      if (usuario.changed('password') && usuario.password) {
        const salt = await bcrypt.genSalt(12);
        usuario.password = await bcrypt.hash(usuario.password, salt); 
      }
    }
  }

  Usuario.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    telefono: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
        is: /^[\+]?[0-9]{8,15}$/ 
      }
    },
    nombre_completo: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        len: [2, 100] 
      }
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isEmail: true
      }
    },
    foto_perfil: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isUrl: true
      }
    },
    gps_activo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false
    },
  
    password: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        len: [6, 255] 
      }
    },
    token_recuperacion_contrasena: {
      type: DataTypes.STRING,
      allowNull: true
    },
    fecha_expiracion_token_recuperacion: {
      type: DataTypes.DATE,
      allowNull: true
    },
    estado: {
      type: DataTypes.ENUM('activo', 'inactivo', 'suspendido'),
      defaultValue: 'activo',
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'Usuario',
    tableName: 'usuarios',
    timestamps: true,
    createdAt: 'fecha_registro',
    updatedAt: 'fecha_actualizacion',
    hooks: {
      // ✅ HOOKS CORREGIDOS
      beforeCreate: Usuario.hashPassword,
      beforeUpdate: Usuario.hashPassword
    }
  });

  return Usuario;
};