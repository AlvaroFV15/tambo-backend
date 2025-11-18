export const errorHandler = (err, req, res, next) => {
  console.error('[ERROR]', err);

  // Error de validación
  if (err.validation) {
    return res.status(400).json({
      error: 'Error de validación',
      details: err.validation,
    });
  }

  // Error de autenticación
  if (err.status === 401 || err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'No autorizado',
      message: 'Token inválido o expirado',
    });
  }

  // Error de permisos
  if (err.status === 403) {
    return res.status(403).json({
      error: 'Acceso denegado',
      message: 'No tienes permisos para esta acción',
    });
  }

  // Error de BD
  if (err.code && err.code.startsWith('PGRST')) {
    return res.status(500).json({
      error: 'Error en la base de datos',
      message: 'Ha ocurrido un error inesperado',
    });
  }

  // Error genérico
  res.status(err.status || 500).json({
    error: err.message || 'Error interno del servidor',
  });
};

export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
