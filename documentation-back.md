# 🚗 JOYA EXPRESS - DOCUMENTACIÓN COMPLETA BACKEND

## 📋 ÍNDICE
1. [Estado Actual del Proyecto](#estado-actual)
2. [Arquitectura del Sistema](#arquitectura)
3. [Tecnologías Utilizadas](#tecnologías)
4. [Estructura del Proyecto](#estructura)
5. [Base de Datos](#base-de-datos)
6. [API Endpoints Implementados](#endpoints-implementados)
7. [WebSocket Events](#websocket-events)
8. [Autenticación y Seguridad](#autenticación)
9. [Redis y Geolocalización](#redis-geo)
10. [Notificaciones Push](#push-notifications)
11. [Módulos Pendientes por Implementar](#módulos-pendientes)
12. [Guías para Continuar el Desarrollo](#guías-desarrollo)
13. [Testing y Debug](#testing-debug)

---

## 📋 ESTADO ACTUAL DEL PROYECTO {#estado-actual}

### ✅ MÓDULOS COMPLETAMENTE IMPLEMENTADOS
- **Autenticación JWT** para pasajeros y conductores
- **Solicitud de viajes** completa (pasajeros)
- **Sistema de ofertas y contraofertas** (bidireccional)
- **Geolocalización en tiempo real** con Redis GeoSets
- **WebSocket para notificaciones** en tiempo real
- **Push notifications** con Firebase FCM
- **Middleware de autenticación** robusto para ambos roles
- **Timeout automático** para viajes sin ofertas
- **Debug endpoints** para desarrollo

### � MÓDULOS POR IMPLEMENTAR (PRIORIDAD ALTA)
1. **Seguimiento de viaje en tiempo real** (tracking durante el viaje)
2. **Sistema de chat** entre pasajero y conductor
3. **Historial de viajes** y valoraciones
4. **Sistema de pagos** integrado
5. **Panel de administración**

---

## 🏗️ ARQUITECTURA DEL SISTEMA {#arquitectura}

### Patrón de Arquitectura: MVC + Servicios
```
├── Controllers    → Manejan HTTP requests/responses
├── Services       → Lógica de negocio
├── Models         → Modelos Sequelize (ORM)
├── Middleware     → Autenticación, validación, CORS
├── Routes         → Definición de endpoints
├── Utils          → Utilidades compartidas (Redis, errores)
├── Config         → Configuración de BD, Redis, Firebase
└── WebSocket      → Eventos en tiempo real
```

### Flujo de una Request:
```
Cliente → Route → Middleware → Controller → Service → Model → Database
                                    ↓
Cliente ← WebSocket ← Notification Service ← Redis ← Response
```

---

## 🛠️ TECNOLOGÍAS UTILIZADAS {#tecnologías}

### Core Backend:
- **Node.js** (v16+) - Runtime
- **Express.js** - Framework web
- **Sequelize** - ORM para PostgreSQL/MySQL
- **Socket.IO** - WebSocket para tiempo real
- **JWT** - Autenticación basada en tokens
- **bcrypt** - Hash de contraseñas

### Base de Datos:
- **PostgreSQL/MySQL** - Base de datos principal
- **Redis** - Cache, geolocalización, sesiones

### Servicios Externos:
- **Firebase FCM** - Push notifications
- **Twilio** (opcional) - SMS de verificación

### Utilidades:
- **cors** - CORS policy
- **dotenv** - Variables de entorno

```bash
# Instalación completa de dependencias
npm install express sequelize pg pg-hstore
npm install redis socket.io firebase-admin
npm install jsonwebtoken bcryptjs joi
npm install cors helmet dotenv morgan
npm install express-validator
```

---

## � ESTRUCTURA DEL PROYECTO {#estructura}

```
src/
├── server.js                 # Servidor principal
├── server-debug.js           # Servidor con debug adicional
├── config/
│   ├── config.js            # Configuración BD, Redis, JWT
│   └── config_0.json        # Config Sequelize
├── models/                  # Modelos Sequelize
│   ├── index.js            # Inicialización Sequelize
│   ├── usuarios.js         # Modelo Usuarios (pasajeros)
│   ├── conductor.js        # Modelo Conductores
│   ├── vehiculo.js         # Modelo Vehículos
│   ├── viajes.js           # Modelo Viajes
│   ├── ofertasViaje.js     # Ofertas de conductores
│   ├── seguimientosViaje.js # Para tracking (pendiente implementar)
│   ├── ubicacionConductor.js # Geolocalización fallback
│   ├── metodoPago.js       # Métodos de pago
│   └── sesion.js           # Sesiones activas
├── auth/                   # Autenticación pasajeros
│   ├── auth.controller.js
│   ├── auth.service.js
│   ├── auth.routes.js
│   ├── auth.schema.js
│   └── ...
├── conductor-auth/         # Autenticación conductores
│   ├── conductor-auth.controller.js
│   ├── conductor-auth.service.js
│   ├── conductor-auth.routes.js
│   └── ...
├── rides/                  # Sistema de viajes (MÓDULO CORE)
│   ├── rides.controller.js # Controlador principal
│   ├── rides.service.js    # Lógica de negocio
│   ├── rides.routes.js     # Rutas pasajeros
│   ├── drivers.routes.js   # Rutas conductores
│   ├── rides.schema.js     # Validaciones
│   └── location.service.js # Geolocalización Redis
├── middleware/
│   ├── auth.middleware.js           # Auth pasajeros
│   └── conductor-auth.middleware.js # Auth conductores
├── notifications/
│   └── firebase.service.js # Push notifications FCM
├── websocket/
│   └── websocket.server.js # Configuración Socket.IO
├── utils/
│   ├── errors.js          # Manejo de errores
│   └── redis.js           # Cliente Redis
└── migrations/            # Migraciones BD
    └── ...archivos de migración
---
```

## 🗄️ BASE DE DATOS {#base-de-datos}

### Modelos Principales Implementados:

#### 👤 Usuarios (Pasajeros)


```javascript
{
  id: UUID (PK),
  nombre: STRING,
  email: STRING UNIQUE,
  telefono: STRING,
  password: STRING (nullable - para auth social),
  verificado: BOOLEAN,
  activo: BOOLEAN,
  fecha_registro: DATE,
  fcm_token: STRING
}
```

#### 🚗 Conductores
```javascript
{
  id: UUID (PK),
  nombre: STRING,
  email: STRING UNIQUE,
  telefono: STRING,
  password: STRING,
  licencia_numero: STRING,
  verificado: BOOLEAN,
  disponible: BOOLEAN,
  calificacion: DECIMAL,
  fecha_registro: DATE,
  fcm_token: STRING
}
```

#### 🚙 Vehículos
```javascript
{
  id: UUID (PK),
  conductor_id: UUID (FK),
  placa: STRING,
  marca: STRING,
  modelo: STRING,
  año: INTEGER,
  color: STRING,
  foto_lateral: TEXT
}
```

#### 🛣️ Viajes
```javascript
{
  id: UUID (PK),
  usuario_id: UUID (FK),
  conductor_id: UUID (FK, nullable),
  origen_lat: DECIMAL,
  origen_lng: DECIMAL,
  destino_lat: DECIMAL,
  destino_lng: DECIMAL,
  origen_direccion: TEXT,
  destino_direccion: TEXT,
  distancia_km: DECIMAL,
  precio_sugerido: DECIMAL,
  tarifa_acordada: DECIMAL,
  estado: ENUM, // 'solicitado', 'ofertas_recibidas', 'aceptado', 'iniciado', 'completado', 'cancelado'
  metodo_pago_preferido: ENUM,
  notas: TEXT,
  fecha_solicitud: DATE,
  fecha_aceptacion: DATE,
  fecha_inicio: DATE,
  fecha_completado: DATE
}
```

#### 💰 Ofertas de Viaje
```javascript
{
  id: UUID (PK),
  viaje_id: UUID (FK),
  conductor_id: UUID (FK),
  tarifa_propuesta: DECIMAL,
  tiempo_estimado_llegada: INTEGER,
  mensaje: TEXT,
  estado: ENUM, // 'pendiente', 'aceptada', 'rechazada', 'expirada'
  es_contraoferta: BOOLEAN,
  oferta_padre_id: UUID (FK, nullable),
  fecha_oferta: DATE
}
```

### Estados de viaje implementados:
```javascript
const ESTADOS_VIAJE = {
  SOLICITADO: 'solicitado',
  OFERTAS_RECIBIDAS: 'ofertas_recibidas',
  ACEPTADO: 'aceptado',
  INICIADO: 'iniciado',
  COMPLETADO: 'completado',
  CANCELADO: 'cancelado'
};
```

### Relaciones:
- Usuario 1:N Viajes
- Conductor 1:N Ofertas
- Conductor 1:1 Vehículo
- Viaje 1:N Ofertas
- Oferta puede tener OfertaPadre (contraofertas)

---

## 🌐 API ENDPOINTS IMPLEMENTADOS {#endpoints-implementados}

### 🔐 Autenticación Pasajeros (`/api/auth`)
```javascript
POST   /register     # Registro de usuario
POST   /login        # Login con email/password
POST   /refresh      # Renovar token JWT
POST   /logout       # Cerrar sesión
POST   /verify-phone # Verificar teléfono (SMS)
```

### 🚗 Autenticación Conductores (`/api/conductor-auth`)
```javascript
POST   /register     # Registro de conductor
POST   /login        # Login conductor
POST   /refresh      # Renovar token
POST   /logout       # Cerrar sesión
PUT    /availability # Activar/desactivar disponibilidad
```

### 🛣️ Viajes - Pasajeros (`/api/rides`)
```javascript
POST   /request                    # Solicitar viaje
GET    /:rideId/offers             # Ver ofertas recibidas
POST   /:rideId/offers/:offerId/accept  # Aceptar oferta
POST   /:rideId/offers/:offerId/reject  # Rechazar oferta
POST   /:rideId/counter-offer      # Hacer contraoferta
DELETE /:rideId                    # Cancelar viaje
GET    /:rideId/status             # Estado del viaje
GET    /active                     # Viajes activos
```

### 🚙 Viajes - Conductores (`/api/rides/driver`)
```javascript
PUT    /location                   # Actualizar ubicación
POST   /offers                     # Crear oferta
GET    /nearby-requests            # Ver solicitudes cercanas
GET    /my-offers                  # Historial de ofertas
POST   /offers/:offerId/accept-counter   # Aceptar contraoferta
POST   /offers/:offerId/reject-counter   # Rechazar contraoferta
POST   /offers/:offerId/counter-offer    # Contraoferta de conductor
```

---

## 🔌 WEBSOCKET EVENTS {#websocket-events}

### Configuración Socket.IO:
```javascript
// websocket/websocket.server.js
io.use(authenticateSocket);  // Middleware JWT
```

### Rooms utilizados:
- `user_${userId}` - Para pasajeros individuales
- `driver_${driverId}` - Para conductores individuales
- `ride_${rideId}` - Para todos los participantes del viaje

### Eventos Implementados:

#### Para Pasajeros:
```javascript
'ride:offer_received'    // Nueva oferta recibida
'ride:offer_accepted'    // Oferta aceptada por conductor
'ride:timeout'           // Timeout sin ofertas
'ride:status_update'     // Cambio de estado del viaje
'ride:counter_offer'     // Contraoferta recibida
```

#### Para Conductores:
```javascript
'ride:new_request'       // Nueva solicitud cercana
'ride:offer_accepted'    // Tu oferta fue aceptada
'ride:offer_rejected'    // Tu oferta fue rechazada
'ride:request_cancelled' // Solicitud cancelada
'ride:counter_offer'     // Contraoferta del pasajero
```

---

## 🔐 AUTENTICACIÓN Y SEGURIDAD {#autenticación}

### JWT Configuration:
```javascript
// config/config.js
jwt: {
  secret: process.env.JWT_SECRET,
  expiresIn: '24h',
  refreshSecret: process.env.JWT_REFRESH_SECRET,
  refreshExpiresIn: '7d'
}
```

### Middleware de Autenticación:
```javascript
// middleware/auth.middleware.js - Para pasajeros
const authenticateAccessToken = (req, res, next) => {
  // Verifica JWT en header Authorization o cookies
}

// middleware/conductor-auth.middleware.js - Para conductores
const authenticateConductorToken = (req, res, next) => {
  // Verifica JWT de conductor con diferentes claims
}
```

### Headers Requeridos:
```javascript
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

---

## 📍 REDIS Y GEOLOCALIZACIÓN {#redis-geo}

### Configuración Redis:
```javascript
// utils/redis.js
const redis = require('redis');
const client = redis.createClient({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT
});
```

### Geolocalización en Tiempo Real:
```javascript
// Almacenar ubicación conductor
GEOADD drivers_locations {lng} {lat} {conductor_id}
EXPIRE drivers_locations 300  // TTL 5 minutos

// Buscar conductores cercanos
GEORADIUS drivers_locations {lng} {lat} 10 km WITHDIST WITHCOORD

// Estado de disponibilidad
SET driver_status:{conductor_id} "disponible" EX 300
```

### Funciones Implementadas:
```javascript
// location.service.js
updateDriverLocation(driverId, lat, lng)     // Actualizar ubicación
getNearbyDrivers(lat, lng, radiusKm)         // Buscar cercanos
removeDriverLocation(driverId)               // Quitar de mapa
getDriverStatus(driverId)                    // Verificar estado
```

---

## 📱 NOTIFICACIONES PUSH {#push-notifications}

### Firebase FCM Setup:
```javascript
// notifications/firebase.service.js
const admin = require('firebase-admin');

// Inicialización con service account
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
```

### Tipos de Notificaciones:
```javascript
// Para Conductores
{
  type: 'new_ride_request',
  ride_id: 'uuid',
  origen: 'Dirección origen',
  precio_sugerido: 15.50
}

// Para Pasajeros
{
  type: 'offer_received',
  offer_id: 'uuid',
  conductor_nombre: 'Juan Pérez',
  tarifa_propuesta: 18.00
}
```

---

## 🚧 MÓDULOS PENDIENTES POR IMPLEMENTAR {#módulos-pendientes}

### 1. 📍 SEGUIMIENTO DE VIAJE EN TIEMPO REAL
**Prioridad: ALTA** - Necesario para MVP

#### Funcionalidades Requeridas:
- Tracking GPS conductor durante viaje
- Actualización de ubicación cada 3-5 segundos
- ETA dinámico para pasajero
- Ruta sugerida y navegación
- Estados: "conductor_llegando", "viaje_iniciado", "en_destino"

#### Archivos a Crear/Modificar:
```
src/tracking/
├── tracking.controller.js    # Endpoints de seguimiento
├── tracking.service.js       # Lógica de tracking
├── tracking.routes.js        # Rutas /api/tracking
└── tracking.schema.js        # Validaciones
```

#### Endpoints Sugeridos:
```javascript
PUT  /api/tracking/driver/location     # Actualizar ubicación durante viaje
GET  /api/tracking/ride/:rideId        # Obtener ubicación actual del viaje
POST /api/tracking/ride/:rideId/start  # Iniciar seguimiento
POST /api/tracking/ride/:rideId/arrive # Conductor llegó al origen
POST /api/tracking/ride/:rideId/pickup # Pasajero recogido
POST /api/tracking/ride/:rideId/complete # Viaje completado
```

#### WebSocket Events Adicionales:
```javascript
'tracking:driver_location'    # Ubicación en tiempo real
'tracking:driver_arriving'    # Conductor llegando (< 2 min)
'tracking:driver_arrived'     # Conductor en punto de recogida
'tracking:ride_started'       # Viaje iniciado
'tracking:eta_updated'        # ETA actualizado
```

#### Modelos Adicionales:
```javascript
// models/seguimientosViaje.js (ya existe)
{
  id: UUID,
  viaje_id: UUID,
  conductor_lat: DECIMAL,
  conductor_lng: DECIMAL,
  timestamp: DATE,
  eta_minutos: INTEGER,
  distancia_restante_km: DECIMAL,
  estado_seguimiento: ENUM
}
```

---

### 2. 💬 SISTEMA DE CHAT
**Prioridad: MEDIA** - Importante para UX

#### Funcionalidades Requeridas:
- Chat 1:1 entre pasajero y conductor
- Mensajes en tiempo real
- Historial de conversación
- Mensajes predefinidos (estoy llegando, etc.)
- Indicador de "escribiendo..."

#### Archivos a Crear:
```
src/chat/
├── chat.controller.js        # CRUD mensajes
├── chat.service.js          # Lógica de chat
├── chat.routes.js           # Rutas /api/chat
└── chat.schema.js           # Validaciones

models/
└── mensajes.js              # Nuevo modelo
```

#### Modelo Sugerido:
```javascript
// models/mensajes.js
{
  id: UUID,
  viaje_id: UUID,
  remitente_id: UUID,
  remitente_tipo: ENUM('usuario', 'conductor'),
  mensaje: TEXT,
  mensaje_tipo: ENUM('texto', 'predefinido', 'ubicacion'),
  leido: BOOLEAN,
  fecha_mensaje: DATE
}
```

#### Endpoints Sugeridos:
```javascript
GET  /api/chat/rides/:rideId/messages    # Obtener mensajes del viaje
POST /api/chat/rides/:rideId/messages    # Enviar mensaje
PUT  /api/chat/messages/:messageId/read  # Marcar como leído
GET  /api/chat/predefined-messages       # Mensajes predefinidos
```

#### WebSocket Events:
```javascript
'chat:message_received'      # Nuevo mensaje
'chat:user_typing'          # Usuario escribiendo
'chat:message_read'         # Mensaje leído
```

---

### 3. 📊 HISTORIAL Y VALORACIONES
**Prioridad: MEDIA** - Para retención de usuarios

#### Funcionalidades:
- Historial de viajes completados
- Sistema de valoraciones (1-5 estrellas)
- Comentarios opcionales
- Estadísticas de conductor/pasajero
- Reportes de problemas

#### Archivos a Crear:
```
src/ratings/
├── ratings.controller.js
├── ratings.service.js
├── ratings.routes.js
└── ratings.schema.js

src/history/
├── history.controller.js
├── history.service.js
└── history.routes.js
```

#### Modelos Adicionales:
```javascript
// models/valoraciones.js
{
  id: UUID,
  viaje_id: UUID,
  evaluador_id: UUID,
  evaluador_tipo: ENUM('usuario', 'conductor'),
  evaluado_id: UUID,
  evaluado_tipo: ENUM('usuario', 'conductor'),
  calificacion: INTEGER, // 1-5
  comentario: TEXT,
  fecha_valoracion: DATE
}

// models/reportes.js
{
  id: UUID,
  viaje_id: UUID,
  reportante_id: UUID,
  reportante_tipo: ENUM,
  tipo_reporte: ENUM,
  descripcion: TEXT,
  estado: ENUM('pendiente', 'revisado', 'resuelto'),
  fecha_reporte: DATE
}
```

---

### 4. 💳 SISTEMA DE PAGOS
**Prioridad: ALTA** - Para monetización

#### Funcionalidades:
- Múltiples métodos de pago
- Integración con pasarelas (Stripe, PayPal, Culqi)
- Billetera interna
- Comisiones automáticas
- Facturación electrónica

#### Archivos a Crear:
```
src/payments/
├── payments.controller.js
├── payments.service.js
├── payments.routes.js
├── stripe.service.js
└── billing.service.js
```

#### Modelos:
```javascript
// models/metodoPago.js (ya existe)
// models/transacciones.js
{
  id: UUID,
  viaje_id: UUID,
  monto_total: DECIMAL,
  comision_plataforma: DECIMAL,
  monto_conductor: DECIMAL,
  metodo_pago: STRING,
  estado_pago: ENUM,
  referencia_externa: STRING,
  fecha_transaccion: DATE
}
```

---

### 5. 🏢 PANEL DE ADMINISTRACIÓN
**Prioridad: BAJA** - Para gestión

#### Funcionalidades:
- Dashboard de métricas
- Gestión de usuarios/conductores
- Moderación de reportes
- Configuración de tarifas
- Análisis de viajes


### Logging implementado:
```javascript
// En todos los servicios
console.log('[SERVICE_NAME]', 'mensaje descriptivo', data);

// Errores
console.error('[ERROR]', error.message, error.stack);
```

### Testing sugerido:
```bash
# Instalar dependencias de testing
npm install --save-dev jest supertest

# Estructura de tests
tests/
├── auth.test.js
├── rides.test.js
├── websocket.test.js
└── utils/
    └── testHelpers.js
```

## 📈 OPTIMIZACIONES Y BUENAS PRÁCTICAS

### Performance:
1. **Índices de base de datos** en campos frecuentemente consultados
2. **TTL en Redis** para datos temporales (5 minutos ubicaciones)
3. **Paginación** en endpoints de historial
4. **Rate limiting** para prevenir spam

### Seguridad:
1. **Validación de input** con Joi en todos los endpoints
2. **Sanitización** de datos de usuarios
3. **CORS** configurado correctamente
4. **Helmet** para headers de seguridad

### Monitoreo:
1. **Logs estructurados** para producción
2. **Health checks** para servicios externos
3. **Métricas** de uso de endpoints
4. **Alertas** para errores críticos

## 🚀 DEPLOYMENT

### Docker (ya configurado):
```bash
# Construcción
docker build -t joya-express-api .

# Ejecución
docker-compose up -d
```

### Variables de producción adicionales:
```env
# Producción
NODE_ENV=production
DB_SSL=true
REDIS_TLS=true

# Logging
LOG_LEVEL=info
LOG_FILE=/app/logs/app.log

# Rate limiting
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100
```

## 📞 CONTACTO Y CONTINUIDAD

### Próximos pasos recomendados:
1. **Implementar seguimiento de viaje** (prioridad alta)
2. **Sistema de chat** básico
3. **Valoraciones y historial**
4. **Integración de pagos**
5. **Panel de administración**


### Archivos importantes para revisar:
- `src/rides/rides.service.js` - Lógica principal de viajes
- `src/websocket/websocket.server.js` - Manejo de eventos en tiempo real
- `src/rides/location.service.js` - Geolocalización con Redis
- `documentation-front.md` - Guía completa para Flutter

---

## 🛠️ GUÍAS PARA CONTINUAR EL DESARROLLO {#guías-desarrollo}

### 📐 Estándares de Código

#### Estructura de Controladores:
```javascript
// Ejemplo: tracking.controller.js
const trackingService = require('./tracking.service');
const { validationResult } = require('express-validator');

const updateDriverLocationDuringRide = async (req, res) => {
  try {
    // 1. Validar entrada
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Datos inválidos',
        errors: errors.array()
      });
    }

    // 2. Extraer datos
    const { rideId } = req.params;
    const { lat, lng } = req.body;
    const conductorId = req.conductor.id;

    // 3. Llamar servicio
    const result = await trackingService.updateLocationDuringRide(
      rideId, 
      conductorId, 
      lat, 
      lng
    );

    // 4. Respuesta consistente
    res.json({
      success: true,
      message: 'Ubicación actualizada durante viaje',
      data: result
    });

  } catch (error) {
    console.error('Error updating location during ride:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  updateDriverLocationDuringRide,
  // ... otros métodos
};
```

#### Estructura de Servicios:
```javascript
// Ejemplo: tracking.service.js
const { Viajes, Conductor, OfertasViaje } = require('../models');
const locationService = require('../rides/location.service');
const websocketService = require('../websocket/websocket.server');
const redis = require('../utils/redis');

class TrackingService {
  
  async updateLocationDuringRide(rideId, conductorId, lat, lng) {
    // 1. Validar que el viaje existe y está activo
    const viaje = await Viajes.findOne({
      where: { 
        id: rideId, 
        conductor_id: conductorId,
        estado: ['aceptado', 'iniciado']
      }
    });

    if (!viaje) {
      throw new Error('Viaje no encontrado o no activo');
    }

    // 2. Actualizar ubicación en Redis
    await locationService.updateDriverLocation(conductorId, lat, lng);

    // 3. Calcular ETA si es necesario
    const eta = await this.calculateETA(viaje, lat, lng);

    // 4. Emitir evento WebSocket
    const locationData = {
      conductor_id: conductorId,
      lat,
      lng,
      eta_minutos: eta,
      timestamp: new Date()
    };

    websocketService.emitToRoom(`ride_${rideId}`, 'tracking:driver_location', locationData);
    websocketService.emitToRoom(`user_${viaje.usuario_id}`, 'tracking:driver_location', locationData);

    // 5. Guardar en historial si es necesario
    // await this.saveLocationHistory(rideId, lat, lng, eta);

    return locationData;
  }

  async calculateETA(viaje, currentLat, currentLng) {
    // Implementar cálculo de ETA usando Google Maps API o similar
    // Por ahora retornamos un valor estimado
    const distance = this.calculateDistance(
      currentLat, currentLng,
      viaje.estado === 'aceptado' ? viaje.origen_lat : viaje.destino_lat,
      viaje.estado === 'aceptado' ? viaje.origen_lng : viaje.destino_lng
    );
    
    // Asumir velocidad promedio de 30 km/h en ciudad
    const etaMinutes = Math.ceil((distance / 30) * 60);
    return Math.max(1, etaMinutes); // Mínimo 1 minuto
  }

  calculateDistance(lat1, lng1, lat2, lng2) {
    // Implementar fórmula de Haversine
    const R = 6371; // Radio de la Tierra en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
}

module.exports = new TrackingService();
```

### 📝 Validaciones con express-validator:
```javascript
// tracking.schema.js
const { body, param } = require('express-validator');

const updateLocationSchema = [
  param('rideId').isUUID().withMessage('ID de viaje inválido'),
  body('lat').isFloat({ min: -90, max: 90 }).withMessage('Latitud inválida'),
  body('lng').isFloat({ min: -180, max: 180 }).withMessage('Longitud inválida')
];

module.exports = {
  updateLocationSchema
};
```



### 🔧 Variables de Entorno Necesarias:
```bash
# .env
NODE_ENV=development
PORT=3000

# Base de datos
DB_HOST=localhost
DB_PORT=5432
DB_NAME=joya_express
DB_USER=usuario
DB_PASS=password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT
JWT_SECRET=tu-secreto-super-seguro
JWT_REFRESH_SECRET=otro-secreto-para-refresh

# Firebase FCM (falta)
FIREBASE_PROJECT_ID=tu-proyecto
FIREBASE_CLIENT_EMAIL=email-del-service-account
FIREBASE_PRIVATE_KEY=clave-privada-del-service-account

# APIs externa
TWILIO_ACCOUNT_SID=tu-account-sid
TWILIO_AUTH_TOKEN=tu-auth-token
```





## 🚀 PRÓXIMOS PASOS RECOMENDADOS

### Prioridad 1 (Inmediata):
1. **Implementar seguimiento de viaje** - Es crítico para la experiencia
2. **Optimizar performance de Redis** - Añadir índices, cleanup automático
3. **Mejorar manejo de errores** - Respuestas más específicas

### Prioridad 2 (Corto plazo):
1. **Sistema de chat** - Mejora UX significativamente
2. **Valoraciones básicas** - Para confianza entre usuarios
3. **Tests automatizados** - Para estabilidad

### Prioridad 3 (Mediano plazo):
1. **Sistema de pagos** - Para monetización
2. **Panel de administración** - Para gestión
3. **Optimizaciones de performance** - Caching, indices DB

---

## 📚 RECURSOS ADICIONALES

### Documentación Técnica:
- **Sequelize**: https://sequelize.org/docs/v6/
- **Socket.IO**: https://socket.io/docs/v4/
- **Redis**: https://redis.io/documentation
- **Firebase FCM**: https://firebase.google.com/docs/cloud-messaging

### Librerías Recomendadas:
```json
{
  "geolib": "^3.3.3",           // Cálculos geográficos
  "node-cron": "^3.0.2",       // Tareas programadas
  "joi": "^17.9.2",            // Validación de schemas

}
```



*Esta documentación está viva y debe actualizarse conforme se agreguen nuevos módulos y funcionalidades.*

