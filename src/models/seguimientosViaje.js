// src/models/seguimientosViaje.js - CORREGIR ESTRUCTURA COMPLETA

module.exports = (sequelize, DataTypes) => {
  const { Model } = require('sequelize');
  
  class SeguimientoViaje extends Model {
    static associate(models) {
      SeguimientoViaje.belongsTo(models.Viaje, { 
        foreignKey: 'viaje_id', 
        as: 'viaje' 
      });
    }
  }

  SeguimientoViaje.init({
    id: { 
      type: DataTypes.BIGINT,  // ← BIGINT como en alltables (no STRING)
      primaryKey: true, 
      autoIncrement: true      // ← Agregar autoIncrement
    },
    viaje_id: { 
      type: DataTypes.UUID,    // ← UUID, no STRING
      allowNull: false 
    },
    conductor_lat: { 
      type: DataTypes.DECIMAL(10, 8), 
      allowNull: false 
    },
    conductor_lng: { 
      type: DataTypes.DECIMAL(11, 8), 
      allowNull: false 
    },
    timestamp: { 
      type: DataTypes.DATE, 
      defaultValue: DataTypes.NOW 
    }
  }, {
    sequelize,
    modelName: 'SeguimientoViaje',
    tableName: 'seguimiento_viaje',
    timestamps: false  
  });
  
  return SeguimientoViaje;
};