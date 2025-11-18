import jwt from 'jsonwebtoken';

export const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    throw {
      status: 401,
      name: 'JsonWebTokenError',
      message: 'Token inválido',
    };
  }
};

export const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyToken(token);
    req.admin = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'No autorizado' });
  }
};

export const generateToken = (adminId, email) => {
  return jwt.sign(
    { id: adminId, email },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
};
