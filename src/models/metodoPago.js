'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class MetodoPago extends Model {
    static associate(models) {
      MetodoPago.belongsTo(models.Usuario, {
        foreignKey: 'usuario_id',
        as: 'usuario'
      });
      MetodoPago.hasMany(models.Viaje, {
        foreignKey: 'metodo_pago_id',
        as: 'viajes'
      });
    }
  }

  MetodoPago.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    usuario_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    tipo: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: { notEmpty: true }
    },
    nombre: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: { notEmpty: true }
    },
    detalles: DataTypes.JSONB,
    activo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    sequelize,
    modelName: 'MetodoPago',
    tableName: 'metodos_pago',
    timestamps: true,
    createdAt: 'fecha_creacion',
    updatedAt: false
  });

  return MetodoPago;
};