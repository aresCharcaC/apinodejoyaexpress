-- SCRIPT CORRECTO PARA TU ESTRUCTURA DE BD

-- 1. CREAR USUARIO PASAJERO
INSERT INTO usuarios (
    id,
    telefono,
    nombre_completo,
    email,
    password,
    estado,
    fecha_registro,
    fecha_actualizacion
) VALUES (
    gen_random_uuid(),
    '973182338',
    'Juan Pasajero Test',
    'test@test.com',
    '$2b$10$rOK5.5k5YZN8jKo5dKoW8eqGV5K5XZN8jKo5dKoW8eqGV5K5XZN8j',
    'activo',
    NOW(),
    NOW()
);

-- 2. CREAR CONDUCTOR ACTIVO
INSERT INTO conductores (
    id,
    dni,
    nombre_completo,
    telefono,
    password,
    estado,
    disponible,
    ubicacion_lat,
    ubicacion_lng,
    fecha_registro,
    fecha_actualizacion
) VALUES (
    gen_random_uuid(),
    '12345678',
    'Carlos Conductor Test',
    '987654321',
    '$2b$10$rOK5.5k5YZN8jKo5dKoW8eqGV5K5XZN8jKo5dKoW8eqGV5K5XZN8j',
    'activo',
    true,
    -16.4090,
    -71.5375,
    NOW(),
    NOW()
);

-- 3. CREAR VEHÍCULO PARA EL CONDUCTOR
INSERT INTO vehiculos (
    id,
    conductor_id,
    placa,
    foto_lateral,
    activo,
    fecha_registro
) VALUES (
    gen_random_uuid(),
    (SELECT id FROM conductores WHERE dni = '12345678'),
    'TEST-001',
    'https://via.placeholder.com/400x300?text=Vehiculo+Test',
    true,
    NOW()
);

-- 4. CREAR MÉTODO DE PAGO PARA EL PASAJERO
INSERT INTO metodos_pago (
    id,
    usuario_id,
    tipo,
    numero,
    activo,
    fecha_creacion
) VALUES (
    gen_random_uuid(),
    (SELECT id FROM usuarios WHERE email = 'test@test.com'),
    'yape',
    '973182338',
    true,
    NOW()
);

-- 5. VERIFICAR QUE TODO SE CREÓ CORRECTAMENTE
SELECT 'USUARIOS CREADOS:' as resultado;
SELECT id, telefono, nombre_completo, email, estado FROM usuarios WHERE email = 'test@test.com';

SELECT 'CONDUCTORES CREADOS:' as resultado;
SELECT id, dni, nombre_completo, estado, disponible FROM conductores WHERE dni = '12345678';

SELECT 'VEHÍCULOS CREADOS:' as resultado;
SELECT id, placa, activo FROM vehiculos WHERE placa = 'TEST-001';

SELECT 'MÉTODOS DE PAGO CREADOS:' as resultado;
SELECT id, tipo, numero FROM metodos_pago WHERE numero = '973182338';