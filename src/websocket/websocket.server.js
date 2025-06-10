const {Server} = require('socket.io');
const jwt = require('jsonwebtoken');
const {Usuario, Conductor} = require('../models');

class WebSocketServer{
    constructor(){
        this.io = null;
        this.connectedUsers = new Map(); // key = userId y value = socketId
        this.connectedDrivers = new Map(); // key = conductorId y value : socketId
    }
 /**
   * ✅ INICIALIZAR WEBSOCKET SERVER
   */
  
 initialize(httpServer){
    try{
        console.log(' 🕸️ Inicializando websocker server...');;
        this.io = new Server(httpServer, {
            cors: {
                origin: process.env.FRONTEND_URL || "*",
                methods: ["GET", "POST"],
                credentials: true
            },
            transports: ['websocket', 'polling']
        });

        this.io.use(async (socket, next)=>{
            try{
                const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Baerer ', '');
                if (!token){
                    return next(new Error('Token no proporcionado'));
                }

                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                socket.userId = decoded.id;
                socket.userType = decoded.type || 'usuario'; // usuario o conductor
                console.log(` 🔐 Cleinte autenticado: ${socket.userType} ${socket.userId}`);
                next();


            }catch(error){
                 console.error('❌Error autenticacion websocket: ', error.message);
                 next(new Error('Token invàlido'));
                 
            }
        });

        // maneja las conexiones
        this.io.on('connection', (socket)=>{
            this.handleConnection(socket);
        });

        console.log(' ✅ websocket server inicializando correctamente');
    }catch(error){
        console.error('❌ Error incializando WebSocket: ', error.message);
        throw error;
    }
 }

//  nueva conexion a websocket

handleConnection(socket){
    try{

        // crar los rooms para pasajero y conductor con id del usuario y id del websocket
        console.log(`✅ Nueva conexion: ${socket.userType} ${socket.userId}`);
        if(socket.userType === 'usuario'){
            this.connectedUsers.set(socket.userId, socket.id);
            socket.join(`user_${socket.userId}`);
        }else if(socket.userType === 'coductor'){
            this.connectedDrivers.set(socket.userId, socket.id);
            socket.join(`driver_${socket.userId}`);
        }

        // TODOS los eventos necesarios para pasajero
        if(socket.userType === 'usuario'){
            socket.on('ride:request', (data)=> this.handleRideRequest(socket, data));
            socket.on('ride:accept_offer', (data)=> this.handleAcceptOffer(socket, data));
            socket.on('ride:reject_offer', (data)=> this.handleRejectOffer(socket, data));
            socket.on('ride:counter_offer', (data)=> this.handleCounterOffer(socket, data));
            socket.on('ride:cancel', (data)=> this.handleCancelRide(socket, data));
        }
        // TODOS los evento para conductores
        if(socket.userType === 'conductor'){
            socket.on('ride:offer', (data) =>this.handleDriverOffer(socket, data)),
            socket.on('ride:accept_counter', (data)=> this.handleAcceptCounter(socket, data));
            socket.on('localtion:update', (data)=> this.handleLocationUpdate(socket, data));
        }

        // Eventos generales

        socket.on('disconnect', ()=> this.handleDisconnection(socket) );
        socket.on('ping', ()=> socket.emit('pong'));
        
    }catch(error){
        console.error(' ❌ Error manejando conexion: ', error.message);
        socket.disconnect();
        
    }
}

// maneja la desconexiòn 

handleDisconnection(socket){
    console.log(`💀 Desconexion: ${socket.userType} ${socket.userId}`);
    if(socket.userType === 'usuario'){
        this.connectedUsers.delete(socket.userId);
    }else if(socket.userType === 'conductor'){
        this.connectedDrivers.delete(socket.userId);
    }
}

// eventos del viaje (IB)

handleRideRequest(socket, data){
    console.log(`Solicitu de viaje via websocket: `, data);
    socket.emit('ride:request_received', {success: true, data});
}

handleDriverOffer(socket, data){
    console.log(`Oferta de conductor via WebSocket: `, data);
    // notificar al pasajero
    this.notifyUser(data.userId, 'ride:offer_reveived', data);
}
handleAcceptOffer(socket, data){
    console.log(`Oferta aceptada via websocket: `, data);
    // notifcar al conductor
    this.notifyDriver(data.conductorId, 'ride:offer_accepted', data);
}

handleLocationUpdate(socket, data){
    console.log(` Actualizacion de ubicacoin conductor ${socket.userId}`);
}

  /**
   *  MÉTODOS DE NOTIFICACIÓN 
   */

  // notificar al pasajero
  notifyUser(userId, event, data){
    try {
        const room = `use_${userId}`;
        this.io.to(room).emit(event, data);
        console.log(`Notificaciòn enviada al usuario ${userId}: ${event}`)
        
    } catch (error) {
        console.log(`❌ Error notificando usuario ${userId}: `, error.message) ;
    }

  }
  
  // notificar al conductor

  notifyDriver(conductorId, event, data){
    try {
        const room = `driver_${conductorId}`;
        this.io.to(room).emit(event, data);
        console.log(`📱 Notificación enviada a conductor ${conductorId}: ${event}`); 
    } catch (error) {
        console.error(`❌ Error notificando al conductor  ${conductorId}: `, error.message);
        
        
    }
  }

  notifyMultileDrivers(conductorIds, event, data){
    try {
        conductorIds.forEach(conductorId =>{
            this.notifyDriver(conductorId, event, data);
        });
              console.log(`📡 Notificación broadcast a ${conductorIds.length} conductores: ${event}`);
    } catch (error) {
        console.error(' ❌ Error en notificaiòn multiple', error.message);
        
        
    }
  }
  
  // estadistica adicionales

  getStats(){
    return{
        connectedUsers: this.connectedUsers.size,
        connectedDrivers: this.connectedDrivers.size,
        totalConectios: this.connectedUsers.size + this.connectedDrivers.size,
        timestamp: new Date()
    };
  }

  getIO(){
    return this.io;
  }
}

module.exports = new WebSocketServer()