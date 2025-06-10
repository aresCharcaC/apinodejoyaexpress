const Joi = require('joi');

/**
 * ✅ VALIDACIÓN SOLICITUD DE VIAJE
 */

const ridesRequestSchema = Joi.object({
    // obligar las coor de origen 
    // utilizado coordenadas respecto al punto 0 = > ecaudor 
    // que tan al norte o sur => +90 P.norte, -90 P.sur
    origen_lat: Joi.number()
    .min(-90)
    .max(90)
    .required()
    .messages({
        'number.min' : 'Latidud de orgin deve estar entre -90 y 90',
        'number.max' : 'Latidud de orgin deve estar entre -90 y 90',
        'any.required': 'Latitiud de orige es obligatoria'
    }),
    // utilizando coordenads respecto a laa linea de Greenwicht  
    // +180  extremos este
    // -180 extremos oeste
    origen_lng: Joi.number()
    .min(-180)
    .max(180)
    .required()
    .messages({
        'number.min': 'Longitud de origen deve esar entre -180 y 180',
        'number.max': 'Longitud de origen deve esar entre -180 y 180',
    }),

    // las coodenadas de destino son obligatorias
    destino_lat: Joi.number()
    .min(-90)
    .max(90)
    .required()
    .messages({
        'number.min' : 'Latidud de destino deve estar entre -90 y 90',
        'number.max' : 'Latidud de orgin deve estar entre -90 y 90',
        'any.required': 'Latitiud de orige es obligatoria'
    }),
    
    destino_lng: Joi.number()
    .min(-180)
    .max(180)
    .required()
    .messages({
        'number.min' : 'Longitud de destino deve estar entre -180 y 180',
        'number.max' : 'Longitud de destino deve estar entre -180 y 180',
        'any.required': 'Longitud de destino es obligatoria'
    }),
      // Direcciones (opcionales pero recomendadas)
  origen_direccion: Joi.string()
    .max(500)
    .optional()
    .messages({
      'string.max': 'Dirección origen no puede exceder 500 caracteres'
    }),
    
  destino_direccion: Joi.string()
    .max(500)
    .optional()
    .messages({
      'string.max': 'Dirección destino no puede exceder 500 caracteres'
    }),

    // precio sugerido inicialmente por el pasajero es opcinal
    precio_sugerido: Joi.number()
    .positive()
    .max(500)
    .optional()
    .messages({
        'number.positive': 'Precio deve ser vàlido ',
        'number.max': 'Precio sugerido no puede execder S/. 500'
    }),
// Notas adicionales (opcional)
  notas: Joi.string()
    .max(500)
    .optional()
    .messages({
      'string.max': 'Notas no pueden exceder 500 caracteres'
    }),
    metodo_pago_preferido: Joi.string()
    .valid('efectivo', 'yape', 'transferencia')
    .default('efectivo')
    .messages({
        'any.only': 'El metodo de pago deve ser efectivo, yape o transferencia'
    })
});

/**
 * ✅ VALIDACIÓN CONTRAOFERTA
 */

const counterOfferSchema = Joi.object({
    nuevo_precio: Joi.number()
    .positive()
    .max(500)
    .required()
    .messages({
        'number.positive': 'La contraoferta deve ser positivo',
        'number.max': 'Nuevo precio no puedde execeder S/. 500',
        'any.required': 'Nuevo precio es obligatorio'
    }),
    mensaje: Joi.string()
    .max(200)
    .optional()
    .messages({
        'string.max': 'Mensaje no puede execer los 200 caracteres'
    })
});


/**
 * ✅ FUNCIONES DE VALIDACIÓN
 */

function validateRideRequest(data){
    return ridesRequestSchema.validate(data, {abortEarly: false});
}

function validateCounterOffer(data){
    return counterOfferSchema.validate(data, {abortEarly: false});
}

/**
 * ✅ VALIDACIONES PERSONALIZADAS
 */
function validateCoordinatesDistance(origenLat, origenLng, destinoLat, destinoLng){
    const distance = calculateHaversineDistance(origenLat, origenLng, destinoLat, destinoLng);
    if (distance < 0.01){
        throw new Error('La distancia minima es dever se 10 metros');
    }
    if(distance > 50){
        throw new Error('La distancia maxima del viaje es de 50km');
    }
    return distance;
}

function calculateHaversineDistance(lat1, lng1, lat2, lng2){
    const R = 6371; // Radio de la planeta tierra 😅
    const dLat = (lat2- lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    // formular haversine tomando en cuenta la curvatura dde la tierra 
    // utlizamos grados en Radianos
    const a = Math.sin(dLat/2)* Math.sin(dLat/2) + 
              Math.cos(lat1 * Math.PI /  180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

module.exports = {
    validateRideRequest,
    validateCounterOffer,
    validateCoordinatesDistance,
    calculateHaversineDistance
};