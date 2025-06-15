'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      // Verificar si la tabla viajes existe
      const tableExists = await queryInterface.describeTable('viajes').catch(() => null);
      
      if (tableExists) {
        // Si la tabla existe, modificar el campo cancelado_por
        await queryInterface.changeColumn('viajes', 'cancelado_por', {
          type: Sequelize.STRING(50),
          allowNull: true
        });
        console.log('✅ Campo cancelado_por actualizado a VARCHAR(50)');
      } else {
        // Si la tabla no existe, crearla completa
        await queryInterface.createTable('viajes', {
          id: {
            type: Sequelize.UUID,
            defaultValue: Sequelize.UUIDV4,
            primaryKey: true,
            allowNull: false
          },
          usuario_id: {
            type: Sequelize.UUID,
            allowNull: false,
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
            references: {
              model: 'conductores',
              key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL'
          },
          vehiculo_id: {
            type: Sequelize.UUID,
            allowNull: true,
            references: {
              model: 'vehiculos',
              key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL'
          },
          origen_direccion: {
            type: Sequelize.TEXT,
            allowNull: true
          },
          origen_lat: {
            type: Sequelize.DECIMAL(10, 8),
            allowNull: false
          },
          origen_lng: {
            type: Sequelize.DECIMAL(11, 8),
            allowNull: false
          },
          destino_direccion: {
            type: Sequelize.TEXT,
            allowNull: true
          },
          destino_lat: {
            type: Sequelize.DECIMAL(10, 8),
            allowNull: false
          },
          destino_lng: {
            type: Sequelize.DECIMAL(11, 8),
            allowNull: false
          },
          distancia_km: {
            type: Sequelize.DECIMAL(8, 2),
            allowNull: true
          },
          tiempo_estimado_minutos: {
            type: Sequelize.INTEGER,
            allowNull: true
          },
          tiempo_real_minutos: {
            type: Sequelize.INTEGER,
            allowNull: true
          },
          tarifa_referencial: {
            type: Sequelize.DECIMAL(8, 2),
            allowNull: true
          },
          tarifa_acordada: {
            type: Sequelize.DECIMAL(8, 2),
            allowNull: true
          },
          precio_sugerido: {
            type: Sequelize.DECIMAL(8, 2),
            allowNull: true
          },
          metodo_pago_id: {
            type: Sequelize.UUID,
            allowNull: true
          },
          estado: {
            type: Sequelize.STRING(30),
            allowNull: false,
            defaultValue: 'solicitado'
          },
          fecha_solicitud: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.NOW
          },
          fecha_aceptacion: {
            type: Sequelize.DATE,
            allowNull: true
          },
          fecha_inicio: {
            type: Sequelize.DATE,
            allowNull: true
          },
          fecha_finalizacion: {
            type: Sequelize.DATE,
            allowNull: true
          },
          fecha_cancelacion: {
            type: Sequelize.DATE,
            allowNull: true
          },
          fecha_contraoferta: {
            type: Sequelize.DATE,
            allowNull: true
          },
          motivo_cancelacion: {
            type: Sequelize.TEXT,
            allowNull: true
          },
          cancelado_por: {
            type: Sequelize.STRING(50),  // ✅ Campo corregido con 50 caracteres
            allowNull: true
          }
        });
        console.log('✅ Tabla viajes creada con campo cancelado_por VARCHAR(50)');
      }
    } catch (error) {
      console.error('❌ Error en migración de viajes:', error.message);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      // Verificar si la tabla existe antes de intentar modificarla
      const tableExists = await queryInterface.describeTable('viajes').catch(() => null);
      
      if (tableExists && tableExists.cancelado_por) {
        // Revertir el campo a VARCHAR(20)
        await queryInterface.changeColumn('viajes', 'cancelado_por', {
          type: Sequelize.STRING(20),
          allowNull: true
        });
        console.log('✅ Campo cancelado_por revertido a VARCHAR(20)');
      }
    } catch (error) {
      console.error('❌ Error revirtiendo migración:', error.message);
      throw error;
    }
  }
};
