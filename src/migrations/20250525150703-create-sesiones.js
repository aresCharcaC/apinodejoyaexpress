'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('sesiones', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      pasajero_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'usuarios',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      conductor_id: {
        type: Sequelize.UUID,
        allowNull: true,
        // Referencia futura 
        // references: {
        //   model: 'conductores',
        //   key: 'id'
        // }
      },
      token: {
        type: Sequelize.TEXT,
        allowNull: false,
        unique: true
      },
      activa: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false
      },
      fecha_creacion: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
        allowNull: false
      },
      fecha_expiracion: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    // Índices específicos
    await queryInterface.addIndex('sesiones', ['token', 'activa'], {
      name: 'idx_sesiones_token'
    });
    await queryInterface.addIndex('sesiones', ['fecha_expiracion'], {
      name: 'idx_sesiones_expiracion'
    });
    await queryInterface.addIndex('sesiones', ['pasajero_id']);
    await queryInterface.addIndex('sesiones', ['conductor_id']);

    //  solo uno de pasajero_id o conductor_id debe estar poblado
    await queryInterface.addConstraint('sesiones', {
      fields: ['pasajero_id', 'conductor_id'],
      type: 'check',
      name: 'check_one_user_type',
      where: {
        [Sequelize.Op.or]: [
          {
            [Sequelize.Op.and]: [
              { pasajero_id: { [Sequelize.Op.ne]: null } },
              { conductor_id: { [Sequelize.Op.eq]: null } }
            ]
          },
          {
            [Sequelize.Op.and]: [
              { pasajero_id: { [Sequelize.Op.eq]: null } },
              { conductor_id: { [Sequelize.Op.ne]: null } }
            ]
          }
        ]
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('sesiones');
  }
};