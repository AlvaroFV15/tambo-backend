import rateLimit from 'express-rate-limit';

// Limiter general para todas las rutas
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests por ventana
  message: 'Demasiadas peticiones, intenta más tarde',
  standardHeaders: true,
  legacyHeaders: false,
});

// Limiter estricto para login
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // máximo 5 intentos
  message: 'Demasiados intentos de login, intenta en 15 minutos',
  skipSuccessfulRequests: true, // no contar intentos exitosos
});

// Limiter para crear pedidos
export const pedidosLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 10, // máximo 10 pedidos por minuto
  message: 'Demasiados pedidos creados, intenta más tarde',
});

// Limiter para pagos
export const pagosLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 3, // máximo 3 intentos de pago por minuto
  message: 'Demasiados intentos de pago, intenta más tarde',
});
