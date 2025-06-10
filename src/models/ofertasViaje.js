// src/models/ofertasViaje.js - COMPLETAR ESTRUCTURA

module.exports = (sequelize, DataTypes) => {
  const { Model } = require('sequelize');
  
  class OfertaViaje extends Model {
    static associate(models) {
      OfertaViaje.belongsTo(models.Viaje, { foreignKey: 'viaje_id', as: 'viaje' });
      OfertaViaje.belongsTo(models.Conductor, { foreignKey: 'conductor_id', as: 'conductor' });
    }
  }

  OfertaViaje.init({
    id: { 
      type: DataTypes.UUID,  // ← Cambiar de STRING a UUID
      defaultValue: DataTypes.UUIDV4, 
      primaryKey: true, 
      allowNull: false 
    },
    viaje_id: { 
      type: DataTypes.UUID,  // ← Cambiar de STRING a UUID
      allowNull: false 
    },
    conductor_id: { 
      type: DataTypes.UUID,  // ← Cambiar de STRING a UUID
      allowNull: false 
    },
    tarifa_propuesta: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: false,
      validate: { isDecimal: true }  // ← Agregar validación de alltables
    },
    
    // ✅ CORREGIR NOMBRE SEGÚN ALLTABLES:
    tiempo_estimado_llegada_minutos: {  // ← Nombre completo
      type: DataTypes.INTEGER,
      validate: { isInt: true, min: 0 }  // ← Agregar validaciones de alltables
    },
    
    mensaje: DataTypes.TEXT,  // ← TEXT, no STRING
    estado: { 
      type: DataTypes.STRING(20),  // ← Especificar longitud
      defaultValue: 'pendiente' 
    },
    fecha_expiracion: DataTypes.DATE,
    visto_por_usuario: { 
      type: DataTypes.BOOLEAN, 
      defaultValue: false 
    }
  }, {
    sequelize,
    modelName: 'OfertaViaje',
    tableName: 'ofertas_viaje',
    timestamps: true,
    createdAt: 'fecha_oferta',  // ✅ Correcto según alltables
    updatedAt: false
  });
  
  return OfertaViaje;
};