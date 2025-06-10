# 📱 JOYA EXPRESS - DOCUMENTACIÓN COMPLETA FRONTEND

## 📋 ÍNDICE
1. [Introducción y Configuración](#introducción)
2. [Autenticación](#autenticación)
3. [Endpoints para Pasajeros](#endpoints-pasajeros)
4. [Endpoints para Conductores](#endpoints-conductores)
5. [WebSocket Events](#websocket-events)
6. [Códigos de Error](#códigos-error)
7. [Flujos Completos](#flujos-completos)
8. [Configuración Flutter](#configuración-flutter)
9. [Ejemplos de Implementación](#ejemplos-implementación)

---

## 🚀 INTRODUCCIÓN Y CONFIGURACIÓN {#introducción}

### URL Base API:
```
http://localhost:3000/api  # Desarrollo
https://api.joyaexpress.com/api  # Producción
```

### WebSocket URL:
```
ws://localhost:3000  # Desarrollo
wss://api.joyaexpress.com  # Producción
```

### Headers Estándar:
```dart
Map<String, String> headers = {
  'Authorization': 'Bearer $jwtToken',
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};
```

---

## 🔐 AUTENTICACIÓN {#autenticación}

### 1. Login Pasajero
```dart
POST /api/auth/login

{
  "email": "user@example.com",
  "password": "password123"
}

// Respuesta exitosa:
{
  "success": true,
  "message": "Login exitoso",
  "data": {
    "user": {
      "id": "uuid",
      "nombre": "Juan Pérez",
      "email": "juan@example.com",
      "telefono": "+51987654321",
      "verificado": true
    },
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_in": 86400
  }
}
```

### 2. Login Conductor
```dart
POST /api/conductor-auth/login

{
  "email": "conductor@example.com",
  "password": "password123"
}

// Respuesta similar con datos de conductor
```

### 3. Renovar Token
```dart
POST /api/auth/refresh

{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 4. Registro Pasajero
```dart
POST /api/auth/register

{
  "nombre": "Juan Pérez",
  "email": "juan@example.com",
  "telefono": "+51987654321",
  "password": "password123"
}
```

---

## 🚗 ENDPOINTS PARA PASAJEROS {#endpoints-pasajeros}

### 1. Solicitar Viaje
```dart
POST /api/rides/request
Authorization: Bearer {jwt_token}

{
  "origen_lat": -12.0464,
  "origen_lng": -77.0428,
  "destino_lat": -12.0889,
  "destino_lng": -77.0174,
  "origen_direccion": "Av. Brasil 123, Lima",    // opcional
  "destino_direccion": "Plaza de Armas, Lima",   // opcional
  "precio_sugerido": 15.50,                      // opcional
  "notas": "Tengo equipaje",                     // opcional
  "metodo_pago_preferido": "efectivo"            // efectivo|tarjeta|app|transferencia
}

// Respuesta exitosa:
{
  "success": true,
  "message": "Solicitud de viaje creada exitosamente",
  "data": {
    "viaje": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "estado": "solicitado",
      "origen": {
        "lat": -12.0464,
        "lng": -77.0428,
        "direccion": "Av. Brasil 123, Lima"
      },
      "destino": {
        "lat": -12.0889,
        "lng": -77.0174,
        "direccion": "Plaza de Armas, Lima"
      },
      "distancia_km": 5.2,
      "precio_sugerido": 15.50,
      "fecha_solicitud": "2025-06-07T14:30:00Z"
    },
    "conductores_notificados": 8,
    "timeout_segundos": 30
  }
}
```

### 2. Ver Ofertas Recibidas
```dart
GET /api/rides/{rideId}/offers
Authorization: Bearer {jwt_token}

// Respuesta:
{
  "success": true,
  "data": {
    "ofertas": [
      {
        "id": "offer-uuid",
        "conductor": {
          "id": "conductor-uuid",
          "nombre": "Carlos Rodríguez",
          "calificacion": 4.8,
          "telefono": "+51987654321"
        },
        "vehiculo": {
          "placa": "ABC-123",
          "marca": "Toyota",
          "modelo": "Corolla",
          "color": "Blanco",
          "foto_lateral": "https://..."
        },
        "tarifa_propuesta": 18.00,
        "tiempo_estimado_llegada": 5,
        "mensaje": "Estoy muy cerca de tu ubicación",
        "es_contraoferta": false,
        "fecha_oferta": "2025-06-07T14:32:00Z"
      }
    ],
    "total_ofertas": 1
  }
}
```

### 3. Aceptar Oferta
```dart
POST /api/rides/{rideId}/offers/{offerId}/accept
Authorization: Bearer {jwt_token}

// Respuesta:
{
  "success": true,
  "message": "Oferta aceptada exitosamente",
  "data": {
    "viaje": {
      "id": "ride-uuid",
      "estado": "aceptado",
      "conductor_id": "conductor-uuid",
      "tarifa_acordada": 18.00,
      "fecha_aceptacion": "2025-06-07T14:35:00Z"
    },
    "conductor": {
      "nombre": "Carlos Rodríguez",
      "telefono": "+51987654321",
      "vehiculo_placa": "ABC-123"
    }
  }
}
```

### 4. Rechazar Oferta
```dart
POST /api/rides/{rideId}/offers/{offerId}/reject
Authorization: Bearer {jwt_token}

{
  "motivo": "Precio muy alto" // opcional
}
```

### 5. Hacer Contraoferta
```dart
POST /api/rides/{rideId}/counter-offer
Authorization: Bearer {jwt_token}

{
  "oferta_id": "offer-uuid",
  "nueva_tarifa": 16.00,
  "mensaje": "¿Podrías hacerlo por S/ 16.00?"
}
```

### 6. Cancelar Viaje
```dart
DELETE /api/rides/{rideId}
Authorization: Bearer {jwt_token}

{
  "motivo": "Ya no necesito el viaje" // opcional
}
```

### 7. Estado del Viaje
```dart
GET /api/rides/{rideId}/status
Authorization: Bearer {jwt_token}

// Respuesta:
{
  "success": true,
  "data": {
    "viaje": {
      "id": "ride-uuid",
      "estado": "aceptado", // solicitado|ofertas_recibidas|aceptado|iniciado|completado|cancelado
      "conductor": {
        "nombre": "Carlos Rodríguez",
        "telefono": "+51987654321",
        "vehiculo_placa": "ABC-123"
      },
      "tarifa_acordada": 18.00,
      "fecha_solicitud": "2025-06-07T14:30:00Z",
      "fecha_aceptacion": "2025-06-07T14:35:00Z"
    }
  }
}
```

### 8. Viajes Activos
```dart
GET /api/rides/active
Authorization: Bearer {jwt_token}

// Respuesta:
{
  "success": true,
  "data": {
    "viajes_activos": [
      {
        "id": "ride-uuid",
        "estado": "aceptado",
        "origen_direccion": "Av. Brasil 123",
        "destino_direccion": "Plaza de Armas",
        "conductor_nombre": "Carlos Rodríguez",
        "fecha_solicitud": "2025-06-07T14:30:00Z"
      }
    ]
  }
}
```

---

## 🚙 ENDPOINTS PARA CONDUCTORES {#endpoints-conductores}

### 1. Actualizar Ubicación
```dart
PUT /api/rides/driver/location
Authorization: Bearer {jwt_token_conductor}

{
  "lat": -12.0464,
  "lng": -77.0428
}

// Respuesta:
{
  "success": true,
  "message": "Ubicación actualizada exitosamente",
  "data": {
    "lat": -12.0464,
    "lng": -77.0428,
    "timestamp": "2025-06-07T14:30:00Z",
    "conductores_cercanos": 5
  }
}
```

### 2. Ver Solicitudes Cercanas
```dart
GET /api/rides/driver/nearby-requests?radius=10
Authorization: Bearer {jwt_token_conductor}

// Respuesta:
{
  "success": true,
  "data": {
    "solicitudes": [
      {
        "id": "ride-uuid",
        "pasajero": {
          "nombre": "Juan Pérez",
          "calificacion": 4.5
        },
        "origen": {
          "lat": -12.0464,
          "lng": -77.0428,
          "direccion": "Av. Brasil 123, Lima"
        },
        "destino": {
          "lat": -12.0889,
          "lng": -77.0174,
          "direccion": "Plaza de Armas, Lima"
        },
        "distancia_km": 5.2,
        "precio_sugerido": 15.50,
        "distancia_a_origen": 2.1,
        "tiempo_estimado_llegada": 4,
        "fecha_solicitud": "2025-06-07T14:30:00Z"
      }
    ],
    "total": 1
  }
}
```

### 3. Crear Oferta
```dart
POST /api/rides/driver/offers
Authorization: Bearer {jwt_token_conductor}

{
  "viaje_id": "ride-uuid",
  "tarifa_propuesta": 18.00,
  "tiempo_estimado_llegada": 5,
  "mensaje": "Estoy muy cerca de tu ubicación"
}

// Respuesta:
{
  "success": true,
  "message": "Oferta enviada exitosamente",
  "data": {
    "oferta": {
      "id": "offer-uuid",
      "viaje_id": "ride-uuid",
      "tarifa_propuesta": 18.00,
      "tiempo_estimado_llegada": 5,
      "estado": "pendiente",
      "fecha_oferta": "2025-06-07T14:32:00Z"
    }
  }
}
```

### 4. Historial de Ofertas
```dart
GET /api/rides/driver/my-offers?limit=20&offset=0
Authorization: Bearer {jwt_token_conductor}

// Respuesta con lista de ofertas pasadas
```

### 5. Aceptar Contraoferta del Pasajero
```dart
POST /api/rides/driver/offers/{offerId}/accept-counter
Authorization: Bearer {jwt_token_conductor}

// Respuesta:
{
  "success": true,
  "message": "Contraoferta aceptada",
  "data": {
    "viaje_asignado": true,
    "tarifa_final": 16.00
  }
}
```

### 6. Rechazar Contraoferta
```dart
POST /api/rides/driver/offers/{offerId}/reject-counter
Authorization: Bearer {jwt_token_conductor}

{
  "motivo": "No puedo reducir más el precio"
}
```

### 7. Hacer Contraoferta (Conductor)
```dart
POST /api/rides/driver/offers/{offerId}/counter-offer
Authorization: Bearer {jwt_token_conductor}

{
  "nueva_tarifa": 17.00,
  "mensaje": "Mi precio final es S/ 17.00"
}
```

---

## 🔌 WEBSOCKET EVENTS {#websocket-events}

### Configuración Inicial:
```dart
import 'package:socket_io_client/socket_io_client.dart' as IO;

IO.Socket socket = IO.io('http://localhost:3000', <String, dynamic>{
  'transports': ['websocket'],
  'autoConnect': false,
});

// Autenticación con JWT
socket.auth = {'token': jwtToken};
socket.connect();
```

### Eventos para Pasajeros:

#### 1. Nueva Oferta Recibida
```dart
socket.on('ride:offer_received', (data) {
  // data contiene la información de la nueva oferta
  print('Nueva oferta: ${data['tarifa_propuesta']}');
  // Actualizar UI con la nueva oferta
});
```

#### 2. Oferta Aceptada por Conductor
```dart
socket.on('ride:offer_accepted', (data) {
  // Conductor aceptó tu contraoferta
  print('Oferta aceptada por: ${data['conductor_nombre']}');
  // Redirigir a pantalla de viaje aceptado
});
```

#### 3. Timeout Sin Ofertas
```dart
socket.on('ride:timeout', (data) {
  // No se recibieron ofertas en el tiempo límite
  print('Sin ofertas recibidas');
  // Mostrar opción de volver a solicitar
});
```

#### 4. Cambio de Estado del Viaje
```dart
socket.on('ride:status_update', (data) {
  String nuevoEstado = data['estado'];
  switch (nuevoEstado) {
    case 'iniciado':
      // Conductor inició el viaje
      break;
    case 'completado':
      // Viaje completado
      break;
    case 'cancelado':
      // Viaje cancelado
      break;
  }
});
```

#### 5. Contraoferta Recibida
```dart
socket.on('ride:counter_offer', (data) {
  // Conductor envió contraoferta
  double nuevaTarifa = data['nueva_tarifa'];
  String mensaje = data['mensaje'];
  // Mostrar contraoferta al usuario
});
```

### Eventos para Conductores:

#### 1. Nueva Solicitud Cercana
```dart
socket.on('ride:new_request', (data) {
  // Nueva solicitud de viaje cerca de ti
  print('Nueva solicitud: ${data['origen_direccion']}');
  // Mostrar notificación o actualizar lista
});
```

#### 2. Tu Oferta Fue Aceptada
```dart
socket.on('ride:offer_accepted', (data) {
  // Tu oferta fue aceptada por el pasajero
  print('Oferta aceptada! Viaje ID: ${data['viaje_id']}');
  // Redirigir a pantalla de viaje activo
});
```

#### 3. Tu Oferta Fue Rechazada
```dart
socket.on('ride:offer_rejected', (data) {
  // Tu oferta fue rechazada
  String motivo = data['motivo'] ?? 'Sin motivo especificado';
  print('Oferta rechazada: $motivo');
});
```

#### 4. Solicitud Cancelada
```dart
socket.on('ride:request_cancelled', (data) {
  // El pasajero canceló la solicitud
  print('Solicitud cancelada: ${data['viaje_id']}');
  // Remover de la lista de solicitudes
});
```

#### 5. Contraoferta del Pasajero
```dart
socket.on('ride:counter_offer', (data) {
  // Pasajero envió contraoferta
  double nuevaTarifa = data['nueva_tarifa'];
  String mensaje = data['mensaje'];
  // Mostrar contraoferta para aceptar/rechazar
});
```

---

## ⚠️ CÓDIGOS DE ERROR {#códigos-error}

### Errores de Autenticación (401)
```json
{
  "success": false,
  "message": "Token inválido o expirado",
  "error": "INVALID_TOKEN"
}
```

### Errores de Validación (400)
```json
{
  "success": false,
  "message": "Datos inválidos",
  "errors": [
    {
      "field": "origen_lat",
      "message": "Latitud requerida"
    }
  ]
}
```

### Errores de Negocio (422)
```json
{
  "success": false,
  "message": "No hay conductores disponibles en tu zona",
  "error": "NO_DRIVERS_AVAILABLE"
}
```

### Errores del Servidor (500)
```json
{
  "success": false,
  "message": "Error interno del servidor",
  "error": "INTERNAL_SERVER_ERROR"
}
```

---

## 🔄 FLUJOS COMPLETOS {#flujos-completos}

### Flujo Completo: Solicitud de Viaje (Pasajero)

1. **Login/Autenticación**
```dart
final loginResponse = await api.post('/auth/login', data: loginData);
String jwtToken = loginResponse.data['data']['access_token'];
```

2. **Configurar WebSocket**
```dart
socket.auth = {'token': jwtToken};
socket.connect();

// Escuchar ofertas
socket.on('ride:offer_received', handleNewOffer);
socket.on('ride:timeout', handleTimeout);
```

3. **Solicitar Viaje**
```dart
final rideResponse = await api.post('/rides/request', data: rideData);
String rideId = rideResponse.data['data']['viaje']['id'];
```

4. **Manejar Ofertas Recibidas**
```dart
void handleNewOffer(dynamic offerData) {
  // Mostrar nueva oferta en UI
  showOfferDialog(offerData);
}
```

5. **Aceptar Oferta**
```dart
final acceptResponse = await api.post('/rides/$rideId/offers/$offerId/accept');
// Redirigir a pantalla de viaje aceptado
```

### Flujo Completo: Ofrecer Viaje (Conductor)

1. **Login Conductor**
```dart
final loginResponse = await api.post('/conductor-auth/login', data: loginData);
String conductorToken = loginResponse.data['data']['access_token'];
```

2. **Actualizar Ubicación Periódicamente**
```dart
Timer.periodic(Duration(seconds: 10), (timer) async {
  await api.put('/rides/driver/location', data: {
    'lat': currentPosition.latitude,
    'lng': currentPosition.longitude
  });
});
```

3. **Escuchar Nuevas Solicitudes**
```dart
socket.on('ride:new_request', (data) {
  showNewRideNotification(data);
});
```

4. **Ver Solicitudes Cercanas**
```dart
final nearbyRides = await api.get('/rides/driver/nearby-requests?radius=10');
```

5. **Crear Oferta**
```dart
await api.post('/rides/driver/offers', data: {
  'viaje_id': rideId,
  'tarifa_propuesta': 18.00,
  'tiempo_estimado_llegada': 5,
  'mensaje': 'Estoy muy cerca'
});
```

---

## 📱 CONFIGURACIÓN FLUTTER {#configuración-flutter}

### Dependencias Recomendadas:
```yaml
dependencies:
  flutter:
    sdk: flutter
  dio: ^5.3.2                  # HTTP client
  socket_io_client: ^2.0.3+1   # WebSocket
  geolocator: ^9.0.2           # GPS location
  permission_handler: ^10.4.3   # Permissions
  firebase_messaging: ^14.6.7   # Push notifications
  shared_preferences: ^2.2.0    # Local storage
  provider: ^6.0.5             # State management
  google_maps_flutter: ^2.5.0   # Maps
```

### Configuración de la API:
```dart
// api_service.dart
import 'package:dio/dio.dart';

class ApiService {
  late Dio _dio;
  static const String baseUrl = 'http://localhost:3000/api';
  
  ApiService() {
    _dio = Dio(BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: Duration(seconds: 30),
      receiveTimeout: Duration(seconds: 30),
    ));
    
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) {
        // Agregar token JWT
        final token = getStoredToken();
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (error, handler) {
        // Manejar errores globalmente
        if (error.response?.statusCode == 401) {
          // Token expirado, redirigir a login
          redirectToLogin();
        }
        handler.next(error);
      },
    ));
  }
  
  Future<Response> get(String path, {Map<String, dynamic>? queryParameters}) async {
    return await _dio.get(path, queryParameters: queryParameters);
  }
  
  Future<Response> post(String path, {dynamic data}) async {
    return await _dio.post(path, data: data);
  }
  
  Future<Response> put(String path, {dynamic data}) async {
    return await _dio.put(path, data: data);
  }
  
  Future<Response> delete(String path) async {
    return await _dio.delete(path);
  }
}
```

### Configuración WebSocket:
```dart
// websocket_service.dart
import 'package:socket_io_client/socket_io_client.dart' as IO;

class WebSocketService {
  IO.Socket? _socket;
  
  void connect(String jwtToken) {
    _socket = IO.io('http://localhost:3000', <String, dynamic>{
      'transports': ['websocket'],
      'autoConnect': false,
      'auth': {'token': jwtToken}
    });
    
    _socket?.connect();
    
    _socket?.onConnect((_) {
      print('WebSocket conectado');
    });
    
    _socket?.onDisconnect((_) {
      print('WebSocket desconectado');
    });
  }
  
  void listenToOffers(Function(dynamic) onOffer) {
    _socket?.on('ride:offer_received', onOffer);
  }
  
  void listenToStatusUpdates(Function(dynamic) onUpdate) {
    _socket?.on('ride:status_update', onUpdate);
  }
  
  void disconnect() {
    _socket?.disconnect();
  }
}
```

---

## 💡 EJEMPLOS DE IMPLEMENTACIÓN {#ejemplos-implementación}

### Ejemplo: Página de Solicitud de Viaje
```dart
class RequestRidePage extends StatefulWidget {
  @override
  _RequestRidePageState createState() => _RequestRidePageState();
}

class _RequestRidePageState extends State<RequestRidePage> {
  final ApiService _api = ApiService();
  final WebSocketService _ws = WebSocketService();
  
  Position? _currentPosition;
  Position? _destinationPosition;
  List<dynamic> _receivedOffers = [];
  bool _isRequesting = false;
  
  @override
  void initState() {
    super.initState();
    _getCurrentLocation();
    _setupWebSocket();
  }
  
  void _setupWebSocket() {
    final token = getStoredToken();
    _ws.connect(token);
    
    _ws.listenToOffers((offerData) {
      setState(() {
        _receivedOffers.add(offerData);
      });
      _showOfferDialog(offerData);
    });
  }
  
  Future<void> _requestRide() async {
    if (_currentPosition == null || _destinationPosition == null) return;
    
    setState(() {
      _isRequesting = true;
    });
    
    try {
      final response = await _api.post('/rides/request', data: {
        'origen_lat': _currentPosition!.latitude,
        'origen_lng': _currentPosition!.longitude,
        'destino_lat': _destinationPosition!.latitude,
        'destino_lng': _destinationPosition!.longitude,
        'precio_sugerido': 15.50,
      });
      
      if (response.data['success']) {
        // Viaje solicitado exitosamente
        String rideId = response.data['data']['viaje']['id'];
        _showWaitingDialog(rideId);
      }
    } catch (e) {
      _showErrorDialog('Error al solicitar viaje: $e');
    } finally {
      setState(() {
        _isRequesting = false;
      });
    }
  }
  
  void _showOfferDialog(dynamic offerData) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Nueva Oferta'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Conductor: ${offerData['conductor']['nombre']}'),
            Text('Precio: S/ ${offerData['tarifa_propuesta']}'),
            Text('Tiempo de llegada: ${offerData['tiempo_estimado_llegada']} min'),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => _rejectOffer(offerData['id']),
            child: Text('Rechazar'),
          ),
          ElevatedButton(
            onPressed: () => _acceptOffer(offerData['id']),
            child: Text('Aceptar'),
          ),
        ],
      ),
    );
  }
  
  Future<void> _acceptOffer(String offerId) async {
    try {
      await _api.post('/rides/$currentRideId/offers/$offerId/accept');
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (context) => ActiveRidePage()),
      );
    } catch (e) {
      _showErrorDialog('Error al aceptar oferta: $e');
    }
  }
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Solicitar Viaje')),
      body: Column(
        children: [
          // Mapa con origen y destino
          Expanded(
            flex: 3,
            child: GoogleMap(
              // Configuración del mapa
            ),
          ),
          
          // Botón para solicitar viaje
          Padding(
            padding: EdgeInsets.all(16),
            child: ElevatedButton(
              onPressed: _isRequesting ? null : _requestRide,
              child: _isRequesting 
                ? CircularProgressIndicator()
                : Text('Solicitar Viaje'),
            ),
          ),
          
          // Lista de ofertas recibidas
          if (_receivedOffers.isNotEmpty)
            Expanded(
              flex: 1,
              child: ListView.builder(
                itemCount: _receivedOffers.length,
                itemBuilder: (context, index) {
                  final offer = _receivedOffers[index];
                  return OfferCard(
                    offer: offer,
                    onAccept: () => _acceptOffer(offer['id']),
                    onReject: () => _rejectOffer(offer['id']),
                  );
                },
              ),
            ),
        ],
      ),
    );
  }
}
```

---

## 🎯 PRÓXIMOS MÓDULOS A IMPLEMENTAR

### 1. Seguimiento de Viaje en Tiempo Real
- Ubicación del conductor en tiempo real
- ETA dinámico
- Notificaciones de llegada

### 2. Chat en Vivo
- Mensajes entre pasajero y conductor
- Mensajes predefinidos
- Indicador de "escribiendo..."

### 3. Historial y Valoraciones
- Historial de viajes
- Sistema de calificación
- Comentarios y reportes

### 4. Pagos Integrados
- Múltiples métodos de pago
- Procesamiento automático
- Recibos digitales

---

*Esta documentación se actualiza constantemente. Revisa la documentación del backend para más detalles técnicos.*


### 2. ✅ Ver ofertas recibidas
```dart
GET /api/rides/{viaje_id}/offers
Authorization: Bearer {jwt_token}

// Respuesta:
{
  "success": true,
  "data": {
    "rideId": "uuid-del-viaje",
    "offers": [
      {
        "id": "uuid-oferta",
        "tarifa_propuesta": 18.00,
        "tiempo_estimado_llegada": 5,
        "mensaje": "Llego rápido",
        "estado": "pendiente",
        "fecha_oferta": "2025-06-07T14:31:00Z",
        "conductor": {
          "id": "uuid-conductor",
          "nombre": "Juan Pérez",
          "telefono": "987654321",
          "vehiculo": {
            "placa": "ABC-123",
            "foto_lateral": "url-foto"
          }
        }
      }
    ],
    "totalOffers": 3
  }
}
```

### 3. ✅ Aceptar oferta
```dart
POST /api/rides/{viaje_id}/offers/{oferta_id}/accept
Authorization: Bearer {jwt_token}

// Respuesta:
{
  "success": true,
  "message": "Oferta aceptada exitosamente",
  "data": {
    "viaje": {
      "id": "uuid-viaje",
      "estado": "aceptado",
      "tarifa_acordada": 18.00,
      "fecha_aceptacion": "2025-06-07T14:32:00Z"
    },
    "conductor": {
      "id": "uuid-conductor",
      "nombre": "Juan Pérez",
      "telefono": "987654321",
      "vehiculo": { "placa": "ABC-123", "foto_lateral": "url" }
    },
    "siguiente_paso": "El conductor se dirige hacia ti"
  }
}
```

### 4. ✅ Crear contraoferta
```dart
POST /api/rides/{viaje_id}/counter-offer
Authorization: Bearer {jwt_token}

{
  "nuevo_precio": 20.00,
  "mensaje": "¿Puedes hacerlo por S/. 20?"
}
```

## 🚙 ENDPOINTS PARA CONDUCTORES (Flutter App Conductor)

### 1. ✅ Actualizar ubicación (cada 5-10 segundos)
```dart
PUT /api/rides/driver/location
Content-Type: application/json
Authorization: Bearer {conductor_jwt_token}

{
  "lat": -12.0465,
  "lng": -77.0429
}

// Respuesta:
{
  "success": true,
  "message": "Ubicación actualizada correctamente",
  "data": {
    "conductor_id": "uuid-conductor",
    "coordenadas": { "lat": -12.0465, "lng": -77.0429 },
    "timestamp": "2025-06-07T14:33:00Z",
    "ttl_segundos": 300,
    "en_redis": true
  }
}
```

### 2. ✅ Crear oferta para solicitud
```dart
POST /api/rides/driver/offers
Content-Type: application/json
Authorization: Bearer {conductor_jwt_token}

{
  "viaje_id": "uuid-del-viaje",
  "tarifa_propuesta": 18.50,
  "mensaje": "Llego en 5 minutos" // opcional
}

// Respuesta:
{
  "success": true,
  "message": "Oferta enviada exitosamente",
  "data": {
    "oferta": {
      "id": "uuid-oferta",
      "tarifa_propuesta": 18.50,
      "tiempo_llegada": 5,
      "mensaje": "Llego en 5 minutos",
      "fecha_oferta": "2025-06-07T14:31:00Z",
      "estado": "pendiente"
    },
    "conductor": {
      "id": "uuid-conductor",
      "nombre": "Juan Pérez"
    }
  }
}
```

## 🔌 WEBSOCKET PARA FLUTTER

### Conexión
```dart
import 'package:socket_io_client/socket_io_client.dart' as IO;

IO.Socket socket = IO.io('ws://tu-servidor.com', 
  IO.OptionBuilder()
    .setTransports(['websocket'])
    .setAuth({
      'token': jwt_token  // Token JWT del usuario o conductor
    })
    .build()
);
```

### 📱 Eventos para PASAJEROS
```dart
// ✅ Escuchar ofertas recibidas
socket.on('ride:offer_received', (data) {
  print('Nueva oferta: S/. ${data['tarifa_propuesta']}');
  // Actualizar UI con nueva oferta
  setState(() {
    ofertas.add(Oferta.fromJson(data));
  });
});

// ✅ Oferta aceptada por conductor
socket.on('ride:offer_accepted', (data) {
  print('Oferta aceptada! Conductor en camino');
  // Navegar a pantalla de seguimiento
});

// ✅ Timeout sin ofertas
socket.on('ride:timeout', (data) {
  print('No se recibieron ofertas. Intenta con precio mayor.');
  // Mostrar mensaje al usuario
});
```

### 🚗 Eventos para CONDUCTORES
```dart
// ✅ Escuchar nuevas solicitudes cercanas
socket.on('ride:new_request', (data) {
  print('Nueva solicitud de viaje cerca!');
  // Mostrar notificación y detalles del viaje
  showRideRequestDialog(data);
});

// ✅ Oferta aceptada
socket.on('ride:offer_accepted', (data) {
  print('¡Tu oferta fue aceptada!');
  // Navegar a pantalla de viaje activo
});

// ✅ Oferta rechazada
socket.on('ride:offer_rejected', (data) {
  print('Oferta rechazada: ${data['mensaje']}');
  // Quitar de UI
});
```

## 📲 PUSH NOTIFICATIONS (FCM)

### Registrar token FCM
```dart
POST /api/fcm/register
Content-Type: application/json
Authorization: Bearer {jwt_token}

{
  "user_type": "usuario", // o "conductor"
  "fcm_token": "token-fcm-del-dispositivo"
}
```

### Ejemplo Flutter FCM:
```dart
import 'package:firebase_messaging/firebase_messaging.dart';

// Obtener token
String? fcmToken = await FirebaseMessaging.instance.getToken();

// Registrar en servidor
await registrarTokenFCM(fcmToken);

// Escuchar mensajes
FirebaseMessaging.onMessage.listen((RemoteMessage message) {
  if (message.data['type'] == 'new_ride_request') {
    // Mostrar diálogo de nueva solicitud
    showRideRequestDialog(message.data);
  }
});
```

## 🔄 FLUJO COMPLETO FLUTTER

### Para PASAJEROS:
1. **Login** → Obtener JWT
2. **Registrar FCM** token
3. **Conectar WebSocket** con JWT
4. **Solicitar viaje** → POST /api/rides/request
5. **Escuchar ofertas** → WebSocket 'ride:offer_received'
6. **Aceptar oferta** → POST /api/rides/{id}/offers/{id}/accept
7. **Seguimiento** → WebSocket eventos de estado

### Para CONDUCTORES:
1. **Login conductor** → Obtener JWT conductor
2. **Activar disponibilidad** → PUT /api/conductor-auth/availability
3. **Conectar WebSocket** con JWT conductor
4. **Enviar ubicación** → PUT /api/rides/driver/location (cada 5-10s)
5. **Recibir solicitudes** → WebSocket 'ride:new_request'
6. **Enviar oferta** → POST /api/rides/driver/offers
7. **Esperar respuesta** → WebSocket 'ride:offer_accepted' o 'ride:offer_rejected'