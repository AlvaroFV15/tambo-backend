import { body, validationResult } from 'express-validator';

// Validador de email
export const validateEmail = body('email')
  .isEmail()
  .normalizeEmail()
  .withMessage('Email inválido');

// Validador de contraseña (mínimo 8 caracteres, 1 mayúscula, 1 número)
export const validatePassword = body('password')
  .isLength({ min: 8 })
  .withMessage('Contraseña debe tener al menos 8 caracteres')
  .matches(/[A-Z]/)
  .withMessage('Contraseña debe contener al menos una mayúscula')
  .matches(/[0-9]/)
  .withMessage('Contraseña debe contener al menos un número');

// Validador de nombre
export const validateNombre = body('nombre')
  .trim()
  .isLength({ min: 2, max: 150 })
  .withMessage('Nombre debe tener entre 2 y 150 caracteres')
  .escape()
  .withMessage('Nombre contiene caracteres inválidos');

// Middleware para manejar errores de validación
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Error de validación',
      details: errors.array().map(e => ({ field: e.param, message: e.msg })),
    });
  }
  next();
};

// Sanitizar y validar precio
export const validatePrecio = body('precio')
  .isFloat({ min: 0.01 })
  .withMessage('Precio debe ser un número positivo');

// Sanitizar cantidad
export const validateCantidad = body('cantidad')
  .isInt({ min: 1 })
  .withMessage('Cantidad debe ser un número entero positivo');
