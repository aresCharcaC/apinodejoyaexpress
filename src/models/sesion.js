'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Sesion extends Model {
    static associate(models) {
      // una sesión pertenece a un usuario (pasajero)
      Sesion.belongsTo(models.Usuario, {
        foreignKey: 'pasajero_id',
        as: 'pasajero'
      });
      
      // ✅ NUEVA RELACIÓN: una sesión pertenece a un conductor
      Sesion.belongsTo(models.Conductor, {
        foreignKey: 'conductor_id',
        as: 'conductor'
      });
    }

    // metodo para verificar si la sesiòn està activa y no ha expirado
    estaActiva() {
      return this.activa && new Date() < new Date(this.fecha_expiracion);
    }

    // Método para desactivar la sesión
    async desactivar() {
      this.activa = false;
      await this.save();
    }

    // ✅ NUEVO: Verificar tipo de usuario
    esPasajero() {
      return !!this.pasajero_id;
    }

    esConductor() {
      return !!this.conductor_id;
    }

    // ✅ NUEVO: Obtener el usuario asociado
    getUsuario() {
      return this.pasajero || this.conductor;
    }
  }

  Sesion.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    pasajero_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'usuarios',
        key: 'id'
      }
    },
    conductor_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'conductores',
        key: 'id'
      }
    },
    token: {
      type: DataTypes.TEXT,
      allowNull: false,
      unique: true
    },
    activa: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false
    },
    fecha_expiracion: {
      type: DataTypes.DATE,
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'Sesion',
    tableName: 'sesiones',
    timestamps: true,
    createdAt: 'fecha_creacion',
    updatedAt: false, // No necesitamos updatedAt para sesiones
    validate: {
      // Validación: solo uno de pasajero_id o conductor_id debe estar poblado
      soloUnTipoUsuario() {
        if ((this.pasajero_id && this.conductor_id) || (!this.pasajero_id && !this.conductor_id)) {
          throw new Error('Debe especificar exactamente uno: pasajero_id o conductor_id');
        }
      }
    }
  });

  return Sesion;
};