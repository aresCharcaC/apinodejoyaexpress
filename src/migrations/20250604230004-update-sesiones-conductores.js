'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Agregar constraint para conductor_id si no existe
    try {
      await queryInterface.addConstraint('sesiones', {
        fields: ['conductor_id'],
        type: 'foreign key',
        name: 'fk_sesiones_conductor',
        references: {
          table: 'conductores',
          field: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      });
    } catch (error) {
      console.log('Foreign key ya existe o error:', error.message);
    }

    // Actualizar el check constraint para incluir conductores
    await queryInterface.removeConstraint('sesiones', 'check_one_user_type');
    
    await queryInterface.addConstraint('sesiones', {
      fields: ['pasajero_id', 'conductor_id'],
      type: 'check',
      name: 'check_one_user_type_updated',
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
    await queryInterface.removeConstraint('sesiones', 'fk_sesiones_conductor');
    await queryInterface.removeConstraint('sesiones', 'check_one_user_type_updated');
    
    // Restaurar constraint original
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
  }
};