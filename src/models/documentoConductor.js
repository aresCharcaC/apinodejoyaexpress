'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class DocumentoConductor extends Model {
    static associate(models) {
      DocumentoConductor.belongsTo(models.Conductor, {
        foreignKey: 'conductor_id',
        as: 'conductor'
      });
    }

    // Verificar si está vencido
    estaVencido() {
      if (!this.fecha_expiracion) return false;
      return new Date() > new Date(this.fecha_expiracion);
    }

    // Verificar si está verificado y vigente
    esValido() {
      return this.verificado && !this.estaVencido();
    }
  }

  DocumentoConductor.init({
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
    foto_brevete: {
      type: DataTypes.STRING(500),
      allowNull: false,
      validate: {
        notEmpty: true,
        isUrl: true
      }
    },
    fecha_subida: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false
    },
    fecha_expiracion: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    verificado: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false
    },
    fecha_verificacion: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'DocumentoConductor',
    tableName: 'documentos_conductor',
    timestamps: false
  });

  return DocumentoConductor;
};