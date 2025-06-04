# se esta creando comnado para automtizar las migraciones

    "migrate": "sequelize-cli db:migrate", // Ejecutar migraciones
    "undo": "sequelize-cli db:migrate:undo", // Deshacer la última migración
    "undo:all": "sequelize-cli db:migrate:undo:all", // Deshacer todas las migraciones
    "migration": "sequelize-cli migration:generate --name", // Generar una migración nueva
    "seed": "sequelize-cli db:seed:all",    // Ejecutar seeders (si usas)
    "seed:undo": "sequelize-cli db:seed:undo:all" // Revertir todos los seeders

    
# 1. Reiniciar servidor
docker-compose restart backend_node

# 2. Verificar configuración
curl http://localhost:3000/api/auth/status

# 3. Simular webhook (para testing)
curl -X POST http://localhost:3000/api/auth/twilio/webhook \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "Body=Quiero mi codigo&From=whatsapp:+573001234567"

# 4. Verificar código
curl -X POST http://localhost:3000/api/auth/verify-code \
  -H "Content-Type: application/json" \
  -d '{"telefono":"+573001234567","codigo":"123456"}'