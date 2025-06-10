'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('vehiculos', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      conductor_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'conductores',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      placa: {
        type: Sequelize.STRING(10),
        allowNull: false,
        unique: true,
        validate: {
          is: /^[A-Z0-9\-]{6,10}$/i
        }
      },
      foto_lateral: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      activo: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false
      },
      fecha_registro: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
        allowNull: false
      }
    });

    // Índices
    await queryInterface.addIndex('vehiculos', ['conductor_id'], {
      name: 'idx_vehiculos_conductor'
    });
    await queryInterface.addIndex('vehiculos', ['placa'], {
      name: 'idx_vehiculos_placa'
    });
    await queryInterface.addIndex('vehiculos', ['activo'], {
      name: 'idx_vehiculos_activo'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('vehiculos');
  }
};