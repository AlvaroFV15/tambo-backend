export const ESTADOS_PEDIDO = {
  PENDIENTE: 'pendiente',
  CONFIRMADO: 'confirmado',
  PREPARANDO: 'preparando',
  LISTO: 'listo',
  CANCELADO: 'cancelado',
};

export const ROLES_ADMIN = {
  ADMIN: 'admin',
  GERENTE: 'gerente',
  COCINERO: 'cocinero',
};

export const METODOS_PAGO = {
  TARJETA: 'tarjeta',
  TRANSFERENCIA: 'transferencia',
};

export const ERRORES = {
  UNAUTHORIZED: 'No autorizado',
  FORBIDDEN: 'Acceso denegado',
  NOT_FOUND: 'No encontrado',
  VALIDATION_ERROR: 'Error de validación',
  SERVER_ERROR: 'Error interno del servidor',
};

export const LIMITES = {
  NOMBRE_MIN: 2,
  NOMBRE_MAX: 150,
  PASSWORD_MIN: 8,
  ITEMS_CARRITO_MAX: 100,
  DESCRIPCION_MAX: 500,
};
