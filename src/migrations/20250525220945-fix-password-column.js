'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Verificar si la columna 'contrasena' existe
    const tableDescription = await queryInterface.describeTable('usuarios');
    
    if (tableDescription.contrasena && !tableDescription.password) {
      // Renombrar 'contrasena' a 'password'
      await queryInterface.renameColumn('usuarios', 'contrasena', 'password');
      console.log('✅ Columna contrasena renombrada a password');
    }
    
    // Asegurar que la columna password permita null
    await queryInterface.changeColumn('usuarios', 'password', {
      type: Sequelize.STRING,
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.renameColumn('usuarios', 'password', 'contrasena');
  }
};