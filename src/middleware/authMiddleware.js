import jwt from 'jsonwebtoken';

export const verifyAdminToken = (req, res, next) => {
  // 1. Obtener el token del encabezado Authorization
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // "Bearer TOKEN" -> "TOKEN"

  if (!token) {
    return res.status(401).json({ error: 'Acceso denegado: Falta token de autenticación.' });
  }

  try {
    // 2. Verificar que el token sea válido y secreto correcto
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    
    // 3. Verificar rol (Opcional, pero recomendado)
    if (verified.role !== 'admin') {
        return res.status(403).json({ error: 'Acceso prohibido: No eres administrador.' });
    }

    req.admin = verified;
    next(); // Dejar pasar a la siguiente función
  } catch (err) {
    res.status(400).json({ error: 'Token inválido o expirado.' });
  }
};