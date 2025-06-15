const locationService = require('./location.service');
const ridesService = require('./rides.service');
const websocketServer = require('../websocket/websocket.server');
const { Conductor } = require('../models');

class DriverLocationService {
    constructor() {
        this.UPDATE_INTERVAL = 5000; // 5 segundos
        this.activeDrivers = new Map(); // Mapa de conductores activos
    }

    /**
     * ✅ INICIALIZAR CONDUCTOR PARA ACTUALIZACIONES AUTOMÁTICAS
     * Se llama cuando el conductor se conecta y activa disponibilidad
     */
    async startLocationUpdates(conductorId, initialLat, initialLng) {
        try {
            console.log(`🚀 Iniciando actualizaciones de ubicación para conductor ${conductorId}`);
            
            // Verificar que el conductor existe y está activo
            const conductor = await Conductor.findByPk(conductorId);
            if (!conductor || conductor.estado !== 'activo') {
                throw new Error('Conductor no encontrado o no activo');
            }

            // Inicializar ubicación en Redis
            await locationService.initializeDriverLocation(conductorId, initialLat, initialLng);
            
            // Marcar conductor como activo en el mapa local
            this.activeDrivers.set(conductorId, {
                lastUpdate: new Date(),
                lat: initialLat,
                lng: initialLng,
                isActive: true
            });

            console.log(`✅ Conductor ${conductorId} inicializado para actualizaciones automáticas`);
            
            return {
                success: true,
                message: 'Actualizaciones de ubicación iniciadas',
                update_interval_seconds: this.UPDATE_INTERVAL / 1000,
                conductor_id: conductorId
            };

        } catch (error) {
            console.error(`❌ Error iniciando actualizaciones para conductor ${conductorId}:`, error.message);
            throw error;
        }
    }

    /**
     * ✅ ACTUALIZAR UBICACIÓN DEL CONDUCTOR
     * Se llama cada 5 segundos desde la app del conductor
     */
    async updateDriverLocation(conductorId, lat, lng) {
        try {
            console.log(`📍 Actualizando ubicación conductor ${conductorId}: ${lat}, ${lng}`);
            
            // Actualizar en Redis y PostgreSQL
            const result = await locationService.updateDriverLocation(conductorId, lat, lng);
            
            // Actualizar en el mapa local
            if (this.activeDrivers.has(conductorId)) {
                this.activeDrivers.set(conductorId, {
                    lastUpdate: new Date(),
                    lat: lat,
                    lng: lng,
                    isActive: true
                });
            }

            // Buscar solicitudes cercanas y notificar al conductor si hay nuevas
            await this.checkForNearbyRequests(conductorId, lat, lng);

            return {
                success: true,
                location_updated: true,
                timestamp: new Date(),
                next_update_in_seconds: this.UPDATE_INTERVAL / 1000
            };

        } catch (error) {
            console.error(`❌ Error actualizando ubicación conductor ${conductorId}:`, error.message);
            
            // Si Redis falla, al menos actualizar en PostgreSQL
            try {
                await Conductor.update(
                    { ubicacion_lat: lat, ubicacion_lng: lng },
                    { where: { id: conductorId } }
                );
                console.log(`✅ Ubicación actualizada solo en PostgreSQL para conductor ${conductorId}`);
                
                return {
                    success: true,
                    location_updated: true,
                    redis_failed: true,
                    timestamp: new Date()
                };
            } catch (dbError) {
                console.error(`❌ Error crítico actualizando ubicación:`, dbError.message);
                throw error;
            }
        }
    }

    /**
     * ✅ BUSCAR SOLICITUDES CERCANAS Y NOTIFICAR AL CONDUCTOR
     */
    async checkForNearbyRequests(conductorId, lat, lng) {
        try {
            // Buscar solicitudes cercanas
            const nearbyRequests = await ridesService.getNearbyRequests(conductorId, lat, lng);
            
            if (nearbyRequests.length > 0) {
                console.log(`🔔 Encontradas ${nearbyRequests.length} solicitudes cercanas para conductor ${conductorId}`);
                
                // Notificar al conductor via WebSocket
                websocketServer.notifyDriver(conductorId, 'location:nearby_requests_updated', {
                    conductor_id: conductorId,
                    location: { lat, lng },
                    nearby_requests: nearbyRequests,
                    count: nearbyRequests.length,
                    timestamp: new Date()
                });
            }

        } catch (error) {
            console.warn(`⚠️ Error buscando solicitudes cercanas para conductor ${conductorId}:`, error.message);
            // No lanzar error, es una funcionalidad secundaria
        }
    }

    /**
     * ✅ DETENER ACTUALIZACIONES DE UBICACIÓN
     * Se llama cuando el conductor se desconecta o desactiva disponibilidad
     */
    async stopLocationUpdates(conductorId) {
        try {
            console.log(`🛑 Deteniendo actualizaciones para conductor ${conductorId}`);
            
            // Desactivar en Redis
            await locationService.deactivateDriver(conductorId);
            
            // Remover del mapa local
            this.activeDrivers.delete(conductorId);
            
            // Actualizar estado en PostgreSQL
            await Conductor.update(
                { disponible: false },
                { where: { id: conductorId } }
            );

            console.log(`✅ Conductor ${conductorId} desactivado correctamente`);
            
            return {
                success: true,
                message: 'Actualizaciones de ubicación detenidas',
                conductor_id: conductorId
            };

        } catch (error) {
            console.error(`❌ Error deteniendo actualizaciones para conductor ${conductorId}:`, error.message);
            throw error;
        }
    }

    /**
     * ✅ OBTENER CONDUCTORES ACTIVOS
     */
    getActiveDrivers() {
        const activeList = [];
        for (const [conductorId, data] of this.activeDrivers.entries()) {
            const timeSinceUpdate = new Date() - data.lastUpdate;
            const isStale = timeSinceUpdate > (this.UPDATE_INTERVAL * 3); // 15 segundos sin actualizar
            
            if (!isStale) {
                activeList.push({
                    conductor_id: conductorId,
                    last_update: data.lastUpdate,
                    location: { lat: data.lat, lng: data.lng },
                    seconds_since_update: Math.floor(timeSinceUpdate / 1000)
                });
            } else {
                // Remover conductores que no han actualizado en mucho tiempo
                console.log(`🧹 Removiendo conductor inactivo ${conductorId} (${Math.floor(timeSinceUpdate / 1000)}s sin actualizar)`);
                this.activeDrivers.delete(conductorId);
            }
        }
        
        return activeList;
    }

    /**
     * ✅ LIMPIAR CONDUCTORES INACTIVOS (ejecutar periódicamente)
     */
    async cleanupInactiveDrivers() {
        try {
            console.log('🧹 Limpiando conductores inactivos...');
            
            let cleanedCount = 0;
            const now = new Date();
            
            for (const [conductorId, data] of this.activeDrivers.entries()) {
                const timeSinceUpdate = now - data.lastUpdate;
                const isStale = timeSinceUpdate > (this.UPDATE_INTERVAL * 6); // 30 segundos sin actualizar
                
                if (isStale) {
                    console.log(`🗑️ Limpiando conductor inactivo ${conductorId}`);
                    
                    try {
                        await this.stopLocationUpdates(conductorId);
                        cleanedCount++;
                    } catch (error) {
                        console.warn(`⚠️ Error limpiando conductor ${conductorId}:`, error.message);
                    }
                }
            }
            
            if (cleanedCount > 0) {
                console.log(`✅ Limpiados ${cleanedCount} conductores inactivos`);
            }
            
            return { cleaned_count: cleanedCount };

        } catch (error) {
            console.error('❌ Error en cleanup de conductores inactivos:', error.message);
        }
    }

    /**
     * ✅ ESTADÍSTICAS DEL SERVICIO
     */
    getStats() {
        const activeDrivers = this.getActiveDrivers();
        
        return {
            active_drivers_count: activeDrivers.length,
            update_interval_seconds: this.UPDATE_INTERVAL / 1000,
            active_drivers: activeDrivers,
            service_uptime: process.uptime(),
            timestamp: new Date()
        };
    }
}

// Crear instancia única del servicio
const driverLocationService = new DriverLocationService();

// Configurar limpieza automática cada 2 minutos
setInterval(() => {
    driverLocationService.cleanupInactiveDrivers();
}, 120000); // 2 minutos

module.exports = driverLocationService;
