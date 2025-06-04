'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('usuarios', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      telefono: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      nombre_completo: {
        type: Sequelize.STRING,
        allowNull: true
      },
      email: {
        type: Sequelize.STRING,
        allowNull: true,
        validate: {
          isEmail: true
        }
      },
      foto_perfil: {
        type: Sequelize.STRING,
        allowNull: true
      },
      gps_activo: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false
      },
      contrasena: {
        type: Sequelize.STRING,
        allowNull: false
      },
      token_recuperacion_contrasena: {
        type: Sequelize.STRING,
        allowNull: true
      },
      fecha_expiracion_token_recuperacion: {
        type: Sequelize.DATE,
        allowNull: true
      },
      estado: {
        type: Sequelize.ENUM('activo', 'inactivo', 'suspendido'),
        defaultValue: 'activo',
        allowNull: false
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

    // Índices
    await queryInterface.addIndex('usuarios', ['telefono']);
    await queryInterface.addIndex('usuarios', ['email']);
    await queryInterface.addIndex('usuarios', ['estado']);
    await queryInterface.renameColumn('usuarios', 'contrasena', 'password');
     await queryInterface.changeColumn('usuarios', 'password', {
      type: Sequelize.STRING,
      allowNull: true // Temporal, luego será required
    });
  },

  async down(queryInterface, Sequelize) {
        await queryInterface.renameColumn('usuarios', 'password', 'contrasena');
}
};