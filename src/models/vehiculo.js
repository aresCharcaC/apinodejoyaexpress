'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Vehiculo extends Model {
    static associate(models) {
      Vehiculo.belongsTo(models.Conductor, {
        foreignKey: 'conductor_id',
        as: 'conductor'
      });

      // Futuras relaciones
      // Vehiculo.hasMany(models.Viaje, { foreignKey: 'vehiculo_id', as: 'viajes' });
    }

    // Activar/desactivar vehículo
    async cambiarEstado(activo) {
      this.activo = activo;
      await this.save();
    }
  }

  Vehiculo.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    conductor_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'conductores',
        key: 'id'
      }
    },
    placa: {
      type: DataTypes.STRING(10),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
        is: /^[A-Z0-9\-]{6,10}$/i
      }
    },
    foto_lateral: {
      type: DataTypes.STRING(500),
      allowNull: true,
      validate: {
        isUrl: true
      }
    },
    activo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'Vehiculo',
    tableName: 'vehiculos',
    timestamps: true,
    createdAt: 'fecha_registro',
    updatedAt: false
  });

  return Vehiculo;
};