hhello word# LOGICA MADRE

| Módulo                      | Backend (Node.js) – ¿Qué hace?                                              | Flutter – ¿Qué hace?                                      | Datos servidos por API/backend                            | Endpoints / Eventos                                     | PostgreSQL        | Redis             | WebSocket |
| --------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------- | ----------------- | ----------------- | --------- |
| **Autenticación**           | Verifica número (SMS/WhatsApp), genera token JWT                            | Envía número, recibe y valida código, guarda token        | JWT, perfil del usuario/conductor                         | `POST /api/auth/login` <br> `GET /api/user/me`          | ✅                 | ❌                 | ❌         |
| **Ubicación**               | Guarda ubicación en Redis con GEOADD                                        | Envía coordenadas cada 5–10 s si es conductor             | No devuelve directamente, sirve a otros módulos           | `location:update` (WS) <br> `POST /api/location/update` | ❌                 | ✅ GEOADD          | ✅         |
| **Búsqueda de conductores** | Consulta Redis con GEORADIUS para encontrar mototaxistas cercanos           | Manda su posición y obtiene lista de conductores cercanos | Lista de conductores cercanos con distancia y coordenadas | `POST /api/drivers/nearby`                              | ❌                 | ✅                 | ❌         |
| **Solicitud de viaje**      | Crea viaje con estado `solicitado` en PostgreSQL y notifica a conductores   | Envía solicitud con origen, destino, precio sugerido      | Datos básicos del viaje (ID, coordenadas, precio)         | `ride:request` (WS)                                     | ✅                 | ✅ (broadcast)     | ✅         |
| **Negociación**             | Guarda las ofertas en Redis, actualiza en PostgreSQL si se acepta           | Envía ofertas, acepta o rechaza                           | Tarifa propuesta, estado actual de la negociación         | `negotiation:offer` <br> `negotiation:accept`           | ✅ (si se acepta)  | ✅ (temporal)      | ✅         |
| **Emparejamiento**          | Asocia conductor al viaje, crea Room WS, cambia estado a "aceptado"         | Recibe notificación y confirma aceptación                 | ID de viaje, datos del pasajero/conductor asignado        | `ride:new`, `ride:accepted` (WS)                        | ✅                 | ❌                 | ✅         |
| **Viaje en curso**          | Actualiza estados (`iniciado`, `finalizado`) en PostgreSQL                  | Cambia vistas, muestra estado actual del viaje            | Estado actual, timestamps, ubicación del otro usuario     | `PUT /api/rides/:id/start` <br> `.../end`               | ✅                 | ✅ (ubicación)     | ✅         |
| **Seguimiento**             | Recibe ubicación y la reenvía solo a la Room del viaje (pasajero/conductor) | Muestra ubicación del otro en tiempo real en mapa         | Coordenadas cada 3–5 s durante viaje                      | `location:update` (solo dentro del viaje)               | ❌ (puede loguear) | ✅ (geo / pub-sub) | ✅         |
| **Chat**                    | Reenvía mensaje por WS, guarda historial en PostgreSQL (opcional)           | Envía y recibe mensajes de chat                           | Texto, timestamp, emisor                                  | `chat:message` (WS)                                     | ✅ (historial)     | ❌                 | ✅         |
| **Pagos**                   | Registra método y tipo de pago (Yape, Plin, efectivo)                       | Elige método y confirma                                   | Monto, tipo de pago, viaje relacionado                    | `POST /api/payments/initiate`                           | ✅                 | ❌                 | ❌         |
| **Calificación**            | Guarda puntaje y comentario                                                 | Envía calificación y comentario                           | Puntuación (1–5), comentario opcional                     | `POST /api/ratings`                                     | ✅                 | ❌                 | ❌         |
| **Notificaciones**          | Envia notificaciones push y WS                                              | Recibe y muestra notificaciones                           | Título, tipo, mensaje                                     | `notificacion:nueva` (WS) <br> FCM Push                 | ✅ (registro)      | ❌                 | ✅         |
–


cuando el conductor se registra o  inicia sesion y es caundo evi su ubicacon, pero cuano el cliente solicita solicutd de viaje que dato se va consumir de lal tabla de conductore s de la columna dde ubcaion.


Concluciones:

Se va hacer un modulo para ingrese de datos por parte del conductor.

Para poder autenticar al usaurio si sus papales estan en orden, vamos ah editar manualmente en la BD



El pasajero va tener 3 estados, uno estao de susu papeles en ordem otro estado de si esta activo o desactivo y otro estado para saver si esta en ruta trabajndo o esta dispinible


Sugerencias:

No vamos a tener el modulo de: 
### bicación	Guarda ubicación en Redis con GEOADD	Envía coordenadas cada 5–10 s si es conductor	No devuelve directamente, sirve a otros módulos	location:update (WS)

## Búsqueda de conductores	Consulta Redis con GEORADIUS para encontrar mototaxistas cercanos	Manda su posición y obtiene lista de conductores cercanos	Lista de conductores cercanos con distancia y coordenadas	POST /api/drivers/nearby	

sino los pasamos defrente al modulo de:
### Solicitud de viaje	Crea viaje con estado solicitado en PostgreSQL y notifica a conductores	Envía solicitud con origen, destino, precio sugerido	Datos básicos del viaje (ID, coordenadas, precio)	ride:request (WS)		(broadcast)	

Ahora nuestra logica serìa:

| Paso                                 | Acción del sistema (backend)                                                  |
| ------------------------------------ | ----------------------------------------------------------------------------- |
| 1. Pasajero inicia sesión            | Se guarda su sesión y token JWT                                               |
| 2. Conductor actualiza su ubicación  | Se guarda su `lat/lng` en Redis vía `GEOADD` y se actualiza periódicamente    |
| 3. Pasajero envía solicitud de viaje | Con origen, destino y precio. Se guarda el viaje en PostgreSQL                |
| 4. Backend busca conductores         | Usa `GEORADIUS` en Redis para ubicar los más cercanos a `origen` del pasajero |
| 5. Se notifica a los conductores     | A través de WebSocket (`ride:new`) usando los IDs obtenidos por Redis         |
| 6. Conductores responden             | Inicia la negociación. Toda la lógica continúa a partir del `rideId`          |



## Tareas a seguir ahora:

- Crear el modulo de ingreso de datos del conductor.
- Crear el modulo de autenticacion del conductor.
- Crear el modulo de actualizacion de ubicaciòn del conductor.
- Proceder con el modulo de solicitud de viajes

## Tareas a seguir ahora:
✅ Plan de implementación (backend)
 Crear endpoint PUT /api/rides/:id/start

 Configurar Room trip:{rideId} en Socket.IO

 Manejar location:update en esa Room

 Agregar chat:message en esa Room (opcional)

 Crear endpoint PUT /api/rides/:id/end

 Emitir eventos de estado por ride:statusChanged o ride:finalizado


Se ecaiv el chat cuanodo el onduto acept el viaje 

el conducto puede rechazr el viaje despuede comenzar la ruta al punto de llegada como tambien el pasajero.


Se dibuja la ruta pacuano el conductor inicia el viaje al putno de destino.

la ruta del viaje para el putno de destino se grafica cuando hace la solicitud. (pasajero)


El conductor deve establecer que ya llegò al putno dde destion (aahi notificar alg paajeor)  se activar el viaje y se quitan alguno botones

para la aceptacion del viaje que solo el conducto pueda cofirmar el fiaje para comenzar con la ruta () 


el viaje a punto de encutro -> se va dibujar la ubicacon cada cireto tiempo para saver donde esta.

para poder empezar con el vije -> el frontedn dibuja la ruta con las coordenadas eu le demos, este no va ser animda es decir el backend no va recivir uviccaiones acltulizada par poder servir al conductor oal usuario. sion esa linea se va qedar quieta (como linea de sugerenci), pero solo va ver un ubicaion para ver en donde estna para llegar la punto de llegda tal como se hizo con las actualizacoinces al punto de espera. 

Como backend

Deve aver un boton para poder temrinar el viaje y actualiza lab bD y pasar a la calificaciones.

