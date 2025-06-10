const { verifyToken } = require('../auth/auth.util');
const { Conductor } = require('../models'); 

async function authenticateConductorToken(req, res, next) {
  try {
    let accessToken = null; 


    if(req.cookies && req.cookies.accessToken){
      accessToken = req.cookies.accessToken;
      console.log('Elt toke se obtenido desde la web cookies');
    }
    if(!accessToken){
      const authHeader = req.headers['authorization'];
      if(authHeader && authHeader.startsWith('Bearer ')){
        accessToken = authHeader.substring(7);
        console.log('El token se obtenio desde authorization header')

      }
    }
    if (!accessToken) {
      return res.status(401).json({
        success: false,
        message: 'Token del conductor de acceso requerido',
        hit: 'Envía el token dle conductor en cookies (web) o Authorization header (Flutter)',
      });
    }
    
    const decoded = verifyToken(accessToken);
    if (!decoded || decoded.tipo !== 'conductor') {
       console.log('🐛 DEBUG Token decodificado:', decoded);
      return res.status(401).json({
        success: false,
        message: 'Token de conductor inválido',
        debug: {
          token_type: decoded?.tipo,
          expected: 'conductor',
          token_data: decoded
        }
      });
    }

   console.log('🔑 Token conductor decodificado:', decoded);
    const conductorId = decoded.conductorId || decoded.id;

    console.log('🐛 DEBUG - Buscando conductor:', conductorId);

    const conductor = await Conductor.findByPk(conductorId, {
      attributes: ['id', 'nombre_completo', 'telefono', 'estado']
    });
    console.log('🐛 DEBUG - Conductor encontrado:', conductor);

    if(!conductor){
      return res.status(401).json({
        success: false,
        message: 'no es econtro al conducto actual',
        type: 'user_not_found',
        debug: {
          token_conductorId: decoded.conductorId,
          token_id: decoded.id,
          used_id: conductorId
        }
      })
    }
    if(conductor.estado !== 'activo'){
      return res.status(403).json({
        success: false,
        message:'Usuario conducto no esta activo' ,
        type: 'user_inactive'
      });
    }

    req.user = {
      conductorId: conductor.id,
      id: conductor.id,
      nombre: conductor.nombre_completo,
      telefono: conductor.telefono,
      tipo: 'conductor'
    }

    console.log(`✅ Conductor autenticado: ${conductor.id} - ${conductor.nombre_completo}`);
    next();
    
  } catch (error) {
    console.error('Error en authenticateConductorToken:', error);
    return res.status(401).json({
      success: false,
      message: 'Token de acceso inválido'
    });
  }
}

module.exports = {
  authenticateConductorToken
};