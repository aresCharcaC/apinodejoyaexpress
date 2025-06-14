const config = {
  database: {
    url: process.env.DATABASE_URL,
    dialect: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    },
    logging: false
  },
  redis: {
    url: process.env.REDIS_URL || process.env.REDISCLOUD_URL
  },
  cors: {
    origin: [
      'http://localhost:3000',
      'http://localhost:8080',
      'http://127.0.0.1:3000',                
        'http://192.168.1.10:3000',
          /\.ngrok\.io$/             
    ]
  }
};

module.exports = config;