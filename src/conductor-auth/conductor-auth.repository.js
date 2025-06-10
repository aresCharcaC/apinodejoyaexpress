const { Conductor, DocumentoConductor, Vehiculo, Sesion, AuditoriaConductor } = require('../models');
const { NotFoundError, ConflictError } = require('../utils/errors');
const { Op } = require('sequelize');

class ConductorAuthRepository {
  
  /**
   * Buscar conductor por DNI
   */
  async findConductorByDni(dni) {
    return await Conductor.findOne({
      where: { dni },
      include: [
        {
          model: DocumentoConductor,
          as: 'documentos'
        },
        {
          model: Vehiculo,
          as: 'vehiculos',
          where: { activo: true },
          required: false
        }
      ]
    });
  }

  /**
   * Buscar conductor por ID
   */
  async findConductorById(id) {
    const conductor = await Conductor.findByPk(id, {
      include: [
        {
          model: DocumentoConductor,
          as: 'documentos'
        },
        {
          model: Vehiculo,
          as: 'vehiculos',
          where: { activo: true },
          required: false
        }
      ]
    });
    
    if (!conductor) {
      throw new NotFoundError('Conductor no encontrado');
    }
    
    return conductor;
  }

  /**
   * Buscar conductor por teléfono
   */
  async findConductorByPhone(telefono) {
    return await Conductor.findOne({
      where: { telefono }
    });
  }

  /**
   * Crear nuevo conductor con vehículo y documentos
   */
  async createConductor(conductorData, vehiculoData, documentoData) {
    const transaction = await Conductor.sequelize.transaction();
    
    try {
      // Verificar duplicados
      const existingDni = await this.findConductorByDni(conductorData.dni);
      if (existingDni) {
        throw new ConflictError('Ya existe un conductor con este DNI');
      }

      const existingPhone = await this.findConductorByPhone(conductorData.telefono);
      if (existingPhone) {
        throw new ConflictError('Ya existe un conductor con este teléfono');
      }

      const existingPlaca = await Vehiculo.findOne({
        where: { placa: vehiculoData.placa }
      });
      if (existingPlaca) {
        throw new ConflictError('Ya existe un vehículo con esta placa');
      }

      // Crear conductor
      const conductor = await Conductor.create(conductorData, { transaction });

      // Crear vehículo
      const vehiculo = await Vehiculo.create({
        ...vehiculoData,
        conductor_id: conductor.id
      }, { transaction });

      // Crear documento
      const documento = await DocumentoConductor.create({
        ...documentoData,
        conductor_id: conductor.id
      }, { transaction });

      // Crear entrada de auditoría
      await AuditoriaConductor.create({
        conductor_id: conductor.id,
        campo_modificado: 'registro_inicial',
        valor_anterior: null,
        valor_nuevo: 'Conductor registrado en el sistema',
        modificado_por: conductor.id,
        tipo_usuario: 'conductor'
      }, { transaction });

      await transaction.commit();

      // Retornar conductor con relaciones
      return await this.findConductorById(conductor.id);
      
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Actualizar datos del conductor
   */
  async updateConductor(conductorId, updateData, modificadoPor = null) {
    const conductor = await this.findConductorById(conductorId);
    const valoresAnteriores = conductor.toJSON();
    
    // Actualizar datos
    await conductor.update(updateData);
    
    // Crear entradas de auditoría para cada campo modificado
    for (const [campo, valorNuevo] of Object.entries(updateData)) {
      if (valoresAnteriores[campo] !== valorNuevo) {
        await AuditoriaConductor.crearEntrada(
          conductorId,
          campo,
          String(valoresAnteriores[campo] || ''),
          String(valorNuevo || ''),
          modificadoPor || conductorId,
          modificadoPor ? 'admin' : 'conductor'
        );
      }
    }
    
    return await this.findConductorById(conductorId);
  }

  /**
   * Crear sesión en la base de datos
   */
  async createSession(conductorId, refreshToken) {
    const fechaExpiracion = new Date();
    fechaExpiracion.setDate(fechaExpiracion.getDate() + 7); // 7 días
    
    return await Sesion.create({
      conductor_id: conductorId,
      token: refreshToken,
      fecha_expiracion: fechaExpiracion,
      activa: true
    });
  }

  /**
   * Buscar sesión activa por token
   */
  async findActiveSession(token) {
    return await Sesion.findOne({
      where: { 
        token,
        activa: true,
        fecha_expiracion: {
          [Op.gt]: new Date()
        }
      },
      include: [
        {
          model: Conductor,
          as: 'conductor',
          attributes: ['id', 'dni', 'nombre_completo', 'telefono', 'estado']
        }
      ]
    });
  }

  /**
   * Desactivar sesión
   */
  async deactivateSession(token) {
    const session = await Sesion.findOne({ where: { token } });
    if (session) {
      await session.desactivar();
    }
  }

  /**
   * Desactivar todas las sesiones de un conductor
   */
  async deactivateAllConductorSessions(conductorId) {
    await Sesion.update(
      { activa: false },
      { where: { conductor_id: conductorId } }
    );
  }

  /**
   * Agregar vehículo
   */
  async addVehicle(conductorId, vehiculoData) {
    // Verificar que la placa no exista
    const existingVehicle = await Vehiculo.findOne({
      where: { placa: vehiculoData.placa }
    });
    
    if (existingVehicle) {
      throw new ConflictError('Ya existe un vehículo con esta placa');
    }

    return await Vehiculo.create({
      ...vehiculoData,
      conductor_id: conductorId
    });
  }

  /**
   * Obtener vehículos del conductor
   */
  async getConductorVehicles(conductorId) {
    return await Vehiculo.findAll({
      where: { 
        conductor_id: conductorId,
        activo: true 
      }
    });
  }

  /**
   * Actualizar documentos
   */
  async updateDocuments(conductorId, documentoData) {
    // Buscar documento existente
    let documento = await DocumentoConductor.findOne({
      where: { conductor_id: conductorId }
    });

    if (documento) {
      // Actualizar documento existente
      await documento.update({
        ...documentoData,
        verificado: false, // Resetear verificación
        fecha_verificacion: null,
        fecha_subida: new Date()
      });
    } else {
      // Crear nuevo documento
      documento = await DocumentoConductor.create({
        ...documentoData,
        conductor_id: conductorId
      });
    }

    return documento;
  }

  /**
   * Actualizar ubicación del conductor
   */
  async updateLocation(conductorId, lat, lng) {
    const conductor = await this.findConductorById(conductorId);
    await conductor.actualizarUbicacion(lat, lng);
    return conductor;
  }

  /**
   * Cambiar disponibilidad del conductor
   */
  async updateAvailability(conductorId, disponible) {
    const conductor = await this.findConductorById(conductorId);
    await conductor.cambiarDisponibilidad(disponible);
    
    // Auditoría
    await AuditoriaConductor.crearEntrada(
      conductorId,
      'disponible',
      String(conductor.disponible),
      String(disponible),
      conductorId,
      'conductor'
    );
    
    return conductor;
  }

  /**
   * Obtener conductores disponibles cerca de una ubicación
   */
  async findAvailableConductorsNear(lat, lng, radiusKm = 5) {
    const radiusInDegrees = radiusKm / 111; // Aproximadamente 111 km por grado
    
    return await Conductor.findAll({
      where: {
        estado: 'activo',
        disponible: true,
        ubicacion_lat: {
          [Op.between]: [lat - radiusInDegrees, lat + radiusInDegrees]
        },
        ubicacion_lng: {
          [Op.between]: [lng - radiusInDegrees, lng + radiusInDegrees]
        }
      },
      include: [
        {
          model: Vehiculo,
          as: 'vehiculos',
          where: { activo: true },
          required: true
        }
      ]
    });
  }

  /**
   * Limpiar sesiones expiradas
   */
  async cleanExpiredSessions() {
    const count = await Sesion.destroy({
      where: {
        [Op.or]: [
          { fecha_expiracion: { [Op.lt]: new Date() } },
          { activa: false }
        ]
      }
    });
    return count;
  }

  /**
   * Obtener estadísticas del conductor
   */
  async getConductorStats(conductorId) {
    const conductor = await this.findConductorById(conductorId);
    
    return {
      total_viajes: conductor.total_viajes,
      estado: conductor.estado,
      disponible: conductor.disponible,
      fecha_registro: conductor.fecha_registro,
      documentos_verificados: conductor.documentos.filter(doc => doc.verificado).length,
      vehiculos_activos: conductor.vehiculos.length
    };
  }
}

module.exports = new ConductorAuthRepository();