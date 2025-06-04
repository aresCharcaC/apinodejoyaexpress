const { verifyToken } = require('../auth/auth.util');

async function authenticateAccessToken(req, res, next) {
  try {
    const accessToken = req.cookies.accessToken;
    
    if (!accessToken) {
      return res.status(401).json({
        success: false,
        message: 'Token de acceso requerido'
      });
    }
    
    const decoded = verifyToken(accessToken);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Token de acceso inválido'
      });
    }
    
    req.user = decoded;
    next();
    
  } catch (error) {
    console.error('Error en authenticateAccessToken:', error);
    return res.status(401).json({
      success: false,
      message: 'Token de acceso inválido'
    });
  }
}

module.exports = {
  authenticateAccessToken
};