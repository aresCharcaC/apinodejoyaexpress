'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class UbicacionConductor extends Model {
    static associate(models) {
      UbicacionConductor.belongsTo(models.Conductor, { 
        foreignKey: 'conductor_id', 
        as: 'conductor' 
      });
    }
  }

  UbicacionConductor.init({
    id: { 
      type: DataTypes.BIGINT,  // ← BIGINT como en alltables
      primaryKey: true, 
      autoIncrement: true      // ← autoIncrement
    },
    conductor_id: { 
      type: DataTypes.UUID, 
      allowNull: false 
    },
    latitud: { 
      type: DataTypes.DECIMAL(10, 8), 
      allowNull: false 
    },
    longitud: { 
      type: DataTypes.DECIMAL(11, 8), 
      allowNull: false 
    },
    timestamp: { 
      type: DataTypes.DATE, 
      defaultValue: DataTypes.NOW 
    }
  }, {
    sequelize,
    modelName: 'UbicacionConductor',
    tableName: 'ubicaciones_conductor',
    timestamps: false  // ✅ Usa timestamp manual
  });

  return UbicacionConductor;
};