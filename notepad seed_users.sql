-- SCRIPT PARA CREAR USUARIOS DE TESTING
-- Ejecutar en PostgreSQL

-- ========================================
-- LIMPIAR DATOS EXISTENTES (OPCIONAL)
-- ========================================
-- DELETE FROM metodo_pago WHERE usuario_id IN ('test-user-1', 'test-user-2');
-- DELETE FROM vehiculos WHERE conductor_id IN ('test-driver-1', 'test-driver-2');
-- DELETE FROM usuarios WHERE id IN ('test-user-1', 'test-user-2');
-- DELETE FROM conductores WHERE id IN ('test-driver-1', 'test-driver-2');

-- ========================================
-- 1. CREAR USUARIOS PASAJEROS
-- ========================================

-- Pasajero 1 (tu número)
INSERT INTO usuarios (
    id, 
    nombre, 
    email, 
    telefono, 
    password, 
    verificado, 
    activo, 
    fecha_registro,
    fcm_token
) VALUES (
    'test-user-1',
    'Juan Pasajero Test',
    'test.pasajero@joya.com',
    '973182338',
    '$2b$10$rOK5.5k5YZN8jKo5dKoW8eqGV5K5XZN8jKo5dKoW8eqGV5K5XZN8j', -- password: 123456
    true,
    true,
    NOW(),
    NULL
);

-- Pasajero 2 (otro de prueba)
INSERT INTO usuarios (
    id, 
    nombre, 
    email, 
    telefono, 
    password, 
    verificado, 
    activo, 
    fecha_registro,
    fcm_token
) VALUES (
    'test-user-2',
    'Maria Usuaria Test',
    'test.usuaria@joya.com',
    '987654321',
    '$2b$10$rOK5.5k5YZN8jKo5dKoW8eqGV5K5XZN8jKo5dKoW8eqGV5K5XZN8j', -- password: 123456
    true,
    true,
    NOW(),
    NULL
);

-- ========================================
-- 2. CREAR MÉTODOS DE PAGO
-- ========================================

-- Método de pago para Pasajero 1
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

-- Método de pago para Pasajero 2
INSERT INTO metodo_pago (
    id,
    usuario_id,
    tipo,
    numero,
    activo,
    fecha_creacion
) VALUES (
    gen_random_uuid(),
    'test-user-2',
    'efectivo',
    NULL,
    true,
    NOW()
);

-- ========================================
-- 3. CREAR CONDUCTORES ACTIVOS
-- ========================================

-- Conductor 1 (tu testing)
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
    total_viajes,
    fcm_token
) VALUES (
    'test-driver-1',
    '12345678',
    'Carlos Conductor Test',
    '973182338', -- Mismo número (permitido)
    '$2b$10$rOK5.5k5YZN8jKo5dKoW8eqGV5K5XZN8jKo5dKoW8eqGV5K5XZN8j', -- password: 123456
    'activo', -- ¡IMPORTANTE!
    true,     -- ¡IMPORTANTE!
    true,
    NOW(),
    -16.4090, -- Arequipa
    -71.5375, -- Arequipa
    4.8,
    0,
    NULL
);

-- Conductor 2 (otro de prueba)
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
    total_viajes,
    fcm_token
) VALUES (
    'test-driver-2',
    '87654321',
    'Ana Conductora Test',
    '987654322',
    '$2b$10$rOK5.5k5YZN8jKo5dKoW8eqGV5K5XZN8jKo5dKoW8eqGV5K5XZN8j', -- password: 123456
    'activo',
    true,
    true,
    NOW(),
    -16.4100, -- Cerca en Arequipa
    -71.5380,
    4.9,
    0,
    NULL
);

-- ========================================
-- 4. CREAR VEHÍCULOS
-- ========================================

-- Vehículo para Conductor 1
INSERT INTO vehiculos (
    id,
    conductor_id,
    placa,
    marca,
    modelo,
    año,
    color,
    foto_lateral,
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
    'https://via.placeholder.com/400x300?text=Toyota+Corolla',
    true,
    NOW()
);

-- Vehículo para Conductor 2
INSERT INTO vehiculos (
    id,
    conductor_id,
    placa,
    marca,
    modelo,
    año,
    color,
    foto_lateral,
    activo,
    fecha_registro
) VALUES (
    gen_random_uuid(),
    'test-driver-2',
    'TEST-002',
    'Nissan',
    'Sentra',
    2021,
    'Azul',
    'https://via.placeholder.com/400x300?text=Nissan+Sentra',
    true,
    NOW()
);

-- ========================================
-- 5. CREAR DOCUMENTOS DE CONDUCTORES
-- ========================================

-- Documentos para Conductor 1
INSERT INTO documento_conductor (
    id,
    conductor_id,
    tipo_documento,
    numero_documento,
    foto_documento,
    fecha_expiracion,
    verificado,
    fecha_creacion
) VALUES (
    gen_random_uuid(),
    'test-driver-1',
    'brevete',
    'B12345678',
    'https://via.placeholder.com/400x300?text=Brevete+Test',
    '2026-12-31',
    true,
    NOW()
);

-- Documentos para Conductor 2
INSERT INTO documento_conductor (
    id,
    conductor_id,
    tipo_documento,
    numero_documento,
    foto_documento,
    fecha_expiracion,
    verificado,
    fecha_creacion
) VALUES (
    gen_random_uuid(),
    'test-driver-2',
    'brevete',
    'B87654321',
    'https://via.placeholder.com/400x300?text=Brevete+Test2',
    '2027-06-30',
    true,
    NOW()
);

-- ========================================
-- 6. VERIFICAR QUE TODO SE CREÓ BIEN
-- ========================================

SELECT 'USUARIOS CREADOS:' as info;
SELECT id, nombre, telefono, verificado, activo FROM usuarios WHERE id LIKE 'test-%';

SELECT 'CONDUCTORES CREADOS:' as info;
SELECT id, nombre_completo, telefono, estado, disponible, verificado FROM conductores WHERE id LIKE 'test-%';

SELECT 'VEHÍCULOS CREADOS:' as info;
SELECT v.placa, v.marca, v.modelo, c.nombre_completo 
FROM vehiculos v 
JOIN conductores c ON v.conductor_id = c.id 
WHERE c.id LIKE 'test-%';

SELECT 'MÉTODOS DE PAGO CREADOS:' as info;
SELECT mp.tipo, mp.numero, u.nombre 
FROM metodo_pago mp 
JOIN usuarios u ON mp.usuario_id = u.id 
WHERE u.id LIKE 'test-%';