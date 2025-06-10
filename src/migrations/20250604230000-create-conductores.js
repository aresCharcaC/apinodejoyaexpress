'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('conductores', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      dni: {
        type: Sequelize.STRING(8),
        allowNull: false,
        unique: true,
        validate: {
          is: /^[0-9]{8}$/
        }
      },
      nombre_completo: {
        type: Sequelize.STRING(100),
        allowNull: false,
        validate: {
          len: [2, 100]
        }
      },
      telefono: {
        type: Sequelize.STRING(15),
        allowNull: false,
        unique: true,
        validate: {
          is: /^[\+]?[0-9]{8,15}$/
        }
      },
      foto_perfil: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      password: {
        type: Sequelize.STRING,
        allowNull: false
      },
      estado: {
        type: Sequelize.ENUM('pendiente', 'activo', 'inactivo', 'suspendido', 'rechazado'),
        defaultValue: 'pendiente',
        allowNull: false
      },
      total_viajes: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false
      },
      ubicacion_lat: {
        type: Sequelize.DECIMAL(10, 8),
        allowNull: true
      },
      ubicacion_lng: {
        type: Sequelize.DECIMAL(11, 8),
        allowNull: true
      },
      disponible: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      },
      token_recuperacion: {
        type: Sequelize.STRING,
        allowNull: true
      },
      fecha_expiracion_token_recuperacion: {
        type: Sequelize.DATE,
        allowNull: true
      },
      fecha_registro: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
        allowNull: false
      },
      fecha_actualizacion: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
        allowNull: false
      }
    });

    // Índices optimizados
    await queryInterface.addIndex('conductores', ['ubicacion_lat', 'ubicacion_lng', 'disponible', 'estado'], {
      name: 'idx_conductores_ubicacion'
    });
    await queryInterface.addIndex('conductores', ['estado', 'disponible'], {
      name: 'idx_conductores_estado'
    });
    await queryInterface.addIndex('conductores', ['telefono'], {
      name: 'idx_conductores_telefono'
    });
    await queryInterface.addIndex('conductores', ['dni'], {
      name: 'idx_conductores_dni'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('conductores');
  }
};