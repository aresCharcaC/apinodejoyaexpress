'use strict';
const { Model } = require('sequelize');
const bcrypt = require('bcryptjs');

module.exports = (sequelize, DataTypes) => {
  class Conductor extends Model {
    static associate(models) {
      // Relaciones
      Conductor.hasMany(models.DocumentoConductor, {
        foreignKey: 'conductor_id',
        as: 'documentos'
      });
      
      Conductor.hasMany(models.Vehiculo, {
        foreignKey: 'conductor_id',
        as: 'vehiculos'
      });
      
      Conductor.hasMany(models.AuditoriaConductor, {
        foreignKey: 'conductor_id',
        as: 'auditoria'
      });

      Conductor.hasMany(models.Sesion, {
        foreignKey: 'conductor_id',
        as: 'sesiones'
      });

      Conductor.hasMany(models.Viaje, { 
        foreignKey: 'conductor_id',
         as: 'viajes'
         });

      Conductor.hasMany(models.OfertaViaje, {
        foreignKey: 'conductor_id',
        as: 'ofertas'
      });
      Conductor.hasMany(models.UbicacionConductor, {
        foreignKey: 'conductor_id',
        as: 'historialUbicaciones'
      });
      //Conductor.hasMany(models.CalificacionConductor, { foreignKey: 'conductor_id', as: 'calificaciones' });
    };

    // Verificar contraseña
    async verificarPassword(password) {
      if (!this.password) return false;
      return await bcrypt.compare(password, this.password);
    };

    // Método para obtener datos públicos (sin contraseña)
    toPublicJSON() {
      const conductor = this.toJSON();
      delete conductor.password;
      delete conductor.token_recuperacion;
      delete conductor.fecha_expiracion_token_recuperacion;
      return conductor;
    }

    // Verificar si está activo
    estaActivo() {
      return this.estado === 'activo';
    }

    // Verificar si está disponible para viajes
    estaDisponible() {
      return this.estado === 'activo' && this.disponible === true;
    }

    // Actualizar ubicación
    async actualizarUbicacion(lat, lng) {
      this.ubicacion_lat = lat;
      this.ubicacion_lng = lng;
      await this.save();
    }

    // Cambiar disponibilidad
    async cambiarDisponibilidad(disponible) {
      this.disponible = disponible;
      await this.save();
    }

    // Hook para hashear contraseña
    static async hashPassword(conductor) {
      if (conductor.changed('password') && conductor.password) {
        const salt = await bcrypt.genSalt(12);
        conductor.password = await bcrypt.hash(conductor.password, salt);
      }
    }
  }

  Conductor.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    dni: {
      type: DataTypes.STRING(8),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
        is: /^[0-9]{8}$/,
        len: [8, 8]
      }
    },
    nombre_completo: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [2, 100]
      }
    },
    telefono: {
      type: DataTypes.STRING(15),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
        is: /^[\+]?[0-9]{8,15}$/
      }
    },
    foto_perfil: {
      type: DataTypes.STRING(500),
      allowNull: true,
      validate: {
        isUrl: true
      }
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        len: [6, 255]
      }
    },
    estado: {
      type: DataTypes.ENUM('pendiente', 'activo', 'inactivo', 'suspendido', 'rechazado'),
      defaultValue: 'pendiente',
      allowNull: false
    },
    total_viajes: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
      validate: {
        min: 0
      }
    },
    ubicacion_lat: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true,
      validate: {
        min: -90,
        max: 90
      }
    },
    ubicacion_lng: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: true,
      validate: {
        min: -180,
        max: 180
      }
    },
    disponible: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false
    },
    token_recuperacion: {
      type: DataTypes.STRING,
      allowNull: true
    },
    fecha_expiracion_token_recuperacion: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'Conductor',
    tableName: 'conductores',
    timestamps: true,
    createdAt: 'fecha_registro',
    updatedAt: 'fecha_actualizacion',
    hooks: {
      beforeCreate: Conductor.hashPassword,
      beforeUpdate: Conductor.hashPassword
    }
  });

  return Conductor;
};