'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class AuditoriaConductor extends Model {
    static associate(models) {
      AuditoriaConductor.belongsTo(models.Conductor, {
        foreignKey: 'conductor_id',
        as: 'conductor'
      });
    }

    // Método estático para crear entrada de auditoría
    static async crearEntrada(conductorId, campo, valorAnterior, valorNuevo, modificadoPor, tipoUsuario) {
      return await AuditoriaConductor.create({
        conductor_id: conductorId,
        campo_modificado: campo,
        valor_anterior: valorAnterior,
        valor_nuevo: valorNuevo,
        modificado_por: modificadoPor,
        tipo_usuario: tipoUsuario
      });
    }
  }

  AuditoriaConductor.init({
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
    campo_modificado: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    valor_anterior: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    valor_nuevo: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    modificado_por: {
      type: DataTypes.UUID,
      allowNull: true
    },
    tipo_usuario: {
      type: DataTypes.ENUM('conductor', 'admin', 'sistema'),
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'AuditoriaConductor',
    tableName: 'auditoria_conductores',
    timestamps: true,
    createdAt: 'fecha_modificacion',
    updatedAt: false
  });

  return AuditoriaConductor;
};