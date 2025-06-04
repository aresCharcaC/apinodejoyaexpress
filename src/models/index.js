'use strict';

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const process = require('process');
const basename = path.basename(__filename);
const env = process.env.NODE_ENV || 'development';

console.log('🔍 Inicializando Sequelize...');
console.log('Environment:', env);

let config;
try {
  config = require(__dirname + '/../config/config.js')[env];
  console.log('✅ Configuración cargada:', {
    database: config.database,
    host: config.host,
    port: config.port,
    dialect: config.dialect
  });
} catch (error) {
  console.error('❌ Error cargando configuración:', error.message);
  throw error;
}

const db = {};

let sequelize;
try {
  if (config.use_env_variable) {
    sequelize = new Sequelize(process.env[config.use_env_variable], config);
  } else {
    sequelize = new Sequelize(config.database, config.username, config.password, {
      host: config.host,
      port: config.port,
      dialect: config.dialect,
      logging: config.logging || false,
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
      },
      define: {
        timestamps: true,
        underscored: false,
        freezeTableName: true
      }
    });
  }
  console.log('✅ Instancia de Sequelize creada');
} catch (error) {
  console.error('❌ Error creando instancia Sequelize:', error.message);
  throw error;
}

// Cargar modelos
try {
  const modelFiles = fs
    .readdirSync(__dirname)
    .filter(file => {
      return (
        file.indexOf('.') !== 0 &&
        file !== basename &&
        file.slice(-3) === '.js' &&
        file.indexOf('.test.js') === -1
      );
    });

  console.log('📁 Archivos de modelos encontrados:', modelFiles);

  modelFiles.forEach(file => {
    try {
      console.log(`📝 Cargando modelo: ${file}`);
      const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
      db[model.name] = model;
      console.log(`✅ Modelo ${model.name} cargado`);
    } catch (error) {
      console.error(`❌ Error cargando modelo ${file}:`, error.message);
    }
  });

  console.log('📊 Modelos cargados:', Object.keys(db));
} catch (error) {
  console.error('❌ Error leyendo directorio de modelos:', error.message);
}

// Configurar asociaciones
try {
  Object.keys(db).forEach(modelName => {
    if (db[modelName].associate) {
      console.log(`🔗 Configurando asociaciones para: ${modelName}`);
      db[modelName].associate(db);
    }
  });
  console.log('✅ Asociaciones configuradas');
} catch (error) {
  console.error('❌ Error configurando asociaciones:', error.message);
}

db.sequelize = sequelize;
db.Sequelize = Sequelize;

console.log('✅ Sequelize inicializado completamente');

module.exports = db;