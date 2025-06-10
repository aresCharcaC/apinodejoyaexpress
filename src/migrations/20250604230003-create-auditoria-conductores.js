'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('auditoria_conductores', {
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
      campo_modificado: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      valor_anterior: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      valor_nuevo: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      modificado_por: {
        type: Sequelize.UUID,
        allowNull: true
      },
      tipo_usuario: {
        type: Sequelize.ENUM('conductor', 'admin', 'sistema'),
        allowNull: false
      },
      fecha_modificacion: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
        allowNull: false
      }
    });

    // Índices
    await queryInterface.addIndex('auditoria_conductores', ['conductor_id', 'fecha_modificacion'], {
      name: 'idx_auditoria_conductor_fecha'
    });
    await queryInterface.addIndex('auditoria_conductores', ['campo_modificado'], {
      name: 'idx_auditoria_campo'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('auditoria_conductores');
  }
};