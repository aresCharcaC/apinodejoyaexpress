# App-Movil-Joya-Express
Aplicación móvil que conecta a pasajeros con mototaxistas de la Joya


# 🧱 Stack Tecnológico - Proyecto de Aplicación de Transporte en Tiempo Real

## 🖥️ Backend

| Componente                      | Tecnología                                                   |
|--------------------------------|---------------------------------------------------------------|
| Lenguaje base                  | Node.js                                                      |
| Framework                      | Express.js                                                   |
| Comunicación en tiempo real    | Socket.IO (WebSocket)                                        |
| Base de datos principal        | PostgreSQL                                                   |
| Datos en tiempo real / Caché   | Redis (GeoSpatial, Pub/Sub, sesiones de negociación)         |
| Contenedores                   | Docker                                                       |
| Autenticación                  | JWT (con verificación de teléfono vía WhatsApp o SMS)        |
| Validación de conductores      | API de FiscaMoto                                             |
| Servicio de mapas              | OpenStreetMap                                                |
| Decodificación de coordenadas  | Trip Route Calculator (Worldbummlr)                          |
| Almacenamiento de archivos     | Amazon S3                                                    |
| Notificaciones Push            | Firebase Cloud Messaging (FCM)                               |
| Despliegue                     | AWS EC2                                                      |
| Orquestador de sockets         | Socket.IO Rooms                                              |
--------------------------------------------------------------------
Referencias: 
> Para autenticaciòn de JWT en Node.js: https://youtu.be/UqnnhAZxRac?si=L56VYT6QGyxC6QcU
> Para saber bien Express: https://youtu.be/YmZE1HXjpd4?si=mLOlMMXyAek-Az4Y
Para saber bien Node.js incluso explicaciòn de Event Loop: https://youtu.be/yB4n_K7dZV8?si=w2Fi5ud6kS-nG7HY

-----
## 📱 Frontend (App Móvil)

| Componente                      | Tecnología                                                   |
|--------------------------------|---------------------------------------------------------------|
| Framework                       | Flutter                                                      |
| Manejo de mapas                 | OpenStreetMap + Trip Route Calculator                        |
| Comunicación real-time          | Socket.IO (cliente para Dart)                                |
| Geolocalización                 | Paquete `geolocator` o similar                               |
| Autenticación                   | Integración con SMS / WhatsApp API + JWT                     |
| Notificaciones Push             | Firebase Cloud Messaging                                     |
| Subida de archivos (fotos)      | Amazon S3 (vía backend firmando URLs o endpoint directo)     |

## 📦 DevOps e Infraestructura

| Componente                      | Tecnología                                                   |
|--------------------------------|---------------------------------------------------------------|
| Contenedores                   | Docker                                                       |
| Despliegue                     | AWS EC2                                                      |
| Almacenamiento                 | Amazon S3                                                    |
| Logs estructurados  (opcionaal)| Winston o Pino para Node.js                                  |
-----------------------------------------
Aqui un video magistral de docker: https://youtu.be/UpkbE8FIJwQ?si=jDtRjNBKYh1B6f5g



## 🧪 Testing & Desarrollo    ⏳

| Componente                      | Herramienta                                                  |
|--------------------------------|---------------------------------------------------------------|
| Mock API y pruebas de integración | Postman / Insomnia / yo prefiero / api route de VScode     |
| Formateo / Linter               | Prettier + ESLint (importante saber lo bàsico)               |
| Documentación API              | Swagger (OpenAPI), Postman  / yo sugieron mas Swagger         |
| Control de versiones           | Git + GitHub/ (ojo: trabajaremos en ramas separadas )            |

------------------
> [!TIP]
> Cualquier cosa estàn las issues comenten si tienen otras herramientas mejores o que nos podrìas facilatar algun proceso. 
> Es probable que tengamos bugs que nos tomen demaciado tiempo, compartelo en las issues para ver entre todos como podemos apoyar para solucionar lo màs antes posible. 
