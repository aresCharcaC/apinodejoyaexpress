const { verifyToken } = require('../auth/auth.util');
const {Usuario} = require('../models');
const { use } = require('../server');

async function authenticateAccessToken(req, res, next) {
  try {
    let accessToken = null;

     // 1. Buscar token en cookies (para web)
    if (req.cookies && req.cookies.accessToken) {
      accessToken = req.cookies.accessToken;
      console.log('🍪 Token obtenido de cookies');
    } 

    // 2. Buscar token en headers Authorization esto es para moviles
    if (!accessToken) {
      const authHeader = req.headers['authorization'];
      if (authHeader && authHeader.startsWith('Bearer ')) {
        accessToken = authHeader.substring(7); // Remover "Bearer "
        console.log('📱 Token obtenido de Authorization header');
      }
    }
   // 3. Verificar que tenemos un token
    if (!accessToken) {
      return res.status(401).json({
        success: false,
        message: 'Token de acceso requerido',
        hint: 'Envía el token en cookies (web) o Authorization header (Flutter)'
      });
    }
    
    const decoded = verifyToken(accessToken);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Token de acceso inválido'
      });
    }

    console.log('🔑 Token decodificado: ', decoded);
    const userId = decoded.userId || decoded.id; 
    const usuario = await Usuario.findByPk(userId, {
      attributes: ['id', 'nombre_completo', 'telefono', 'estado']
    });

    if(!usuario){
      return res.status(401).json({
        success: false,
        message: 'Usurio actual no econtraddo',
        type: 'user_not_found'
      });
    }
    if(usuario.estado !== 'activo'){
      return res.status(403).json({
        success: false,
        message: 'Usuario no esta activo',
        type: 'user_inactive'
      });
    }

    req.user = {
      id: usuario.id,
      nombre: usuario.nombre_completo,
      telefono: usuario.telefono,
      tipo: 'pasajero'
    }
    console.log(`✅ Usuario authenticado: ${usuario.id} - ${usuario.nombre_completo} `);
    next()
  } catch (error) {
    console.error(' ❌Error en authenticateAccessToken:', error.message);

    if(error.name === 'JsonWebTokenError'){
      return res.status(401).json({
        success: false,
        message: 'Token invàlido',
        type: 'invalid_token'
      });
    }

    if(error.name === 'TokenExpiredError'){
      return res.status(401).json({
        success: false,
        message: 'token expirado',
        type: 'token_expired'
      })

    }
    return res.status(401).json({
      success: false,
      message: 'Token de acceso inválido'
    });
  }
}

const authenticateToken = authenticateAccessToken;

module.exports = {
  authenticateAccessToken,
  authenticateToken
};