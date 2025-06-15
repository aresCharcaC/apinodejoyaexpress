'use strict'

const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {

  class Viaje extends Model {
    static associate(models) {
      // ✅ ASOCIACIONES REQUERIDAS
      Viaje.belongsTo(models.Usuario, { foreignKey: 'usuario_id', as: 'pasajero' });
      Viaje.belongsTo(models.Conductor, { foreignKey: 'conductor_id', as: 'conductor' });
      Viaje.belongsTo(models.Vehiculo, { foreignKey: 'vehiculo_id', as: 'vehiculo' });
      Viaje.belongsTo(models.MetodoPago, { foreignKey: 'metodo_pago_id', as: 'metodoDePago' });
      Viaje.hasMany(models.OfertaViaje, { foreignKey: 'viaje_id', as: 'ofertas' });
      Viaje.hasMany(models.SeguimientoViaje, { foreignKey: 'viaje_id', as: 'seguimiento' });
    }

    // ✅ MÉTODOS CRÍTICOS PARA MÓDULO VIAJES
    async aceptar(conductorId, vehiculoId) {
      this.estado = 'aceptado';
      this.conductor_id = conductorId;
      this.vehiculo_id = vehiculoId;
      this.fecha_aceptacion = new Date();
      await this.save();
    }
    
    async iniciar() {
      this.estado = 'en_curso';
      this.fecha_inicio = new Date();
      await this.save();
    }

    async finalizar(tiempoReal) {
      this.estado = 'completado';
      this.tiempo_real_minutos = tiempoReal;  // ← Usar nombre de alltables
      this.fecha_finalizacion = new Date();
      await this.save();
    }

    async cancelar(motivo, canceladoPor) {
      this.estado = 'cancelado';
      this.motivo_cancelacion = motivo;
      this.cancelado_por = canceladoPor;
      this.fecha_cancelacion = new Date();
      await this.save();
    }
  }

  Viaje.init({
    id: { 
      type: DataTypes.UUID,  // ← Cambiar de STRING a UUID
      defaultValue: DataTypes.UUIDV4, 
      primaryKey: true, 
      allowNull: false 
    },
    usuario_id: { 
      type: DataTypes.UUID,  // ← Cambiar de STRING a UUID
      allowNull: false 
    },
    conductor_id: {
      type: DataTypes.UUID,  // ← Cambiar de STRING a UUID
      allowNull: true
    },
    vehiculo_id: {
      type: DataTypes.UUID,  // ← Cambiar de STRING a UUID
      allowNull: true
    },
    
    // ✅ CAMPOS DE UBICACIÓN (ya están bien)
    origen_direccion: { type: DataTypes.TEXT, allowNull: true },  // ← TEXT, no STRING
    origen_lat: { type: DataTypes.DECIMAL(10, 8), allowNull: false },
    origen_lng: { type: DataTypes.DECIMAL(11, 8), allowNull: false },
    destino_direccion: { type: DataTypes.TEXT, allowNull: true }, // ← TEXT, no STRING
    destino_lat: { type: DataTypes.DECIMAL(10, 8), allowNull: false },
    destino_lng: { type: DataTypes.DECIMAL(11, 8), allowNull: false },
    
    // ✅ AGREGAR CAMPOS FALTANTES CRÍTICOS:
    distancia_km: DataTypes.DECIMAL(8, 2),
    tiempo_estimado_minutos: DataTypes.INTEGER,  // ← Nombre completo como alltables
    tiempo_real_minutos: DataTypes.INTEGER,      // ← Nombre completo como alltables
    tarifa_referencial: DataTypes.DECIMAL(8, 2),
    tarifa_acordada: DataTypes.DECIMAL(8, 2),
    metodo_pago_id: {
      type: DataTypes.UUID,  // ← UUID, no STRING
      allowNull: true
    },
    estado: { 
      type: DataTypes.STRING(30),  // ← Especificar longitud
      allowNull: false 
    },
    
    // ✅ FECHAS COMPLETAS (faltaban muchas):
    fecha_solicitud: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    fecha_aceptacion: DataTypes.DATE,
    fecha_inicio: DataTypes.DATE,
    fecha_finalizacion: DataTypes.DATE,
    fecha_cancelacion: DataTypes.DATE,
    motivo_cancelacion: DataTypes.TEXT,      // ← TEXT, no STRING
    cancelado_por: DataTypes.STRING(50)  // Aumentar límite para evitar truncamiento
  }, {
    sequelize,
    modelName: 'Viaje',
    tableName: 'viajes',
    timestamps: false  // ✅ Correcto, usa fechas manuales
  });
  
  return Viaje;
};
