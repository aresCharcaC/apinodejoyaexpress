'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('documentos_conductor', {
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
      foto_brevete: {
        type: Sequelize.STRING(500),
        allowNull: false
      },
      fecha_subida: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
        allowNull: false
      },
      fecha_expiracion: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      verificado: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      },
      fecha_verificacion: {
        type: Sequelize.DATE,
        allowNull: true
      }
    });

    // Índices
    await queryInterface.addIndex('documentos_conductor', ['conductor_id'], {
      name: 'idx_documentos_conductor'
    });
    await queryInterface.addIndex('documentos_conductor', ['verificado'], {
      name: 'idx_documentos_verificado'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('documentos_conductor');
  }
};