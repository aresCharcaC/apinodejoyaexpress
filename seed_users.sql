-- SCRIPT PARA CREAR USUARIOS DE TESTING

-- ========================================
-- 1. CREAR USUARIOS PASAJEROS
-- ========================================

INSERT INTO usuarios (
    id, 
    nombre, 
    email, 
    telefono, 
    password, 
    verificado, 
    activo, 
    fecha_registro
) VALUES (
    'test-user-1',
    'Juan Pasajero Test',
    'test.pasajero@joya.com',
    '973182338',
    '$2b$10$rOK5.5k5YZN8jKo5dKoW8eqGV5K5XZN8jKo5dKoW8eqGV5K5XZN8j',
    true,
    true,
    NOW()
);

-- ========================================
-- 2. CREAR MÉTODOS DE PAGO
-- ========================================

INSERT INTO metodo_pago (
    id,
    usuario_id,
    tipo,
    numero,
    activo,
    fecha_creacion
) VALUES (
    gen_random_uuid(),
    'test-user-1',
    'yape',
    '973182338',
    true,
    NOW()
);

-- ========================================
-- 3. CREAR CONDUCTORES ACTIVOS
-- ========================================

INSERT INTO conductores (
    id,
    dni,
    nombre_completo,
    telefono,
    password,
    estado,
    disponible,
    verificado,
    fecha_registro,
    ubicacion_lat,
    ubicacion_lng,
    calificacion,
    total_viajes
) VALUES (
    'test-driver-1',
    '12345678',
    'Carlos Conductor Test',
    '973182338',
    '$2b$10$rOK5.5k5YZN8jKo5dKoW8eqGV5K5XZN8jKo5dKoW8eqGV5K5XZN8j',
    'activo',
    true,
    true,
    NOW(),
    -16.4090,
    -71.5375,
    4.8,
    0
);

-- ========================================
-- 4. CREAR VEHÍCULOS
-- ========================================

INSERT INTO vehiculos (
    id,
    conductor_id,
    placa,
    marca,
    modelo,
    año,
    color,
    activo,
    fecha_registro
) VALUES (
    gen_random_uuid(),
    'test-driver-1',
    'TEST-001',
    'Toyota',
    'Corolla',
    2020,
    'Blanco',
    true,
    NOW()
);

-- ========================================
-- 5. VERIFICAR RESULTADOS
-- ========================================

SELECT 'USUARIOS:' as info;
SELECT id, nombre, telefono FROM usuarios WHERE id = 'test-user-1';

SELECT 'CONDUCTORES:' as info;
SELECT id, nombre_completo, estado, disponible FROM conductores WHERE id = 'test-driver-1';