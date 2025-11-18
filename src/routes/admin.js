import express from 'express';
import bcrypt from 'bcryptjs';
import { supabase } from '../index.js';
import { generalLimiter, loginLimiter } from '../middleware/rateLimiter.js';
import { requireAuth, generateToken } from '../middleware/auth.js';
import {
  validateEmail,
  validatePassword,
  handleValidationErrors,
} from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// POST - Login de administrador
router.post(
  '/login',
  loginLimiter,
  validateEmail,
  validatePassword,
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const { data: admin, error } = await supabase
      .from('administradores')
      .select('id, nombre, email, password_hash, activo')
      .eq('email', email)
      .single();

    if (error || !admin) {
      return res.status(401).json({
        error: 'Email o contraseña incorrectos',
      });
    }

    if (!admin.activo) {
      return res.status(403).json({
        error: 'Cuenta de administrador desactivada',
      });
    }

    // Comparar contraseña hasheada
    const passwordValid = await bcrypt.compare(password, admin.password_hash);

    if (!passwordValid) {
      return res.status(401).json({
        error: 'Email o contraseña incorrectos',
      });
    }

    // Generar token JWT
    const token = generateToken(admin.id, admin.email);

    res.json({
      message: 'Login exitoso',
      token,
      admin: {
        id: admin.id,
        nombre: admin.nombre,
        email: admin.email,
      },
    });
  })
);

// GET - Obtener info del admin actual (protegido)
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { id } = req.admin;

    const { data, error } = await supabase
      .from('administradores')
      .select('id, nombre, email, rol, activo')
      .eq('id', id)
      .single();

    if (error) throw error;

    res.json(data);
  })
);

// POST - Cambiar contraseña de admin (protegido)
router.post(
  '/cambiar-contraseña',
  requireAuth,
  validatePassword,
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { id } = req.admin;
    const { passwordActual, passwordNueva } = req.body;

    // Obtener admin actual
    const { data: admin, error: errorGet } = await supabase
      .from('administradores')
      .select('password_hash')
      .eq('id', id)
      .single();

    if (errorGet) throw errorGet;

    // Validar contraseña actual
    const passwordValid = await bcrypt.compare(
      passwordActual,
      admin.password_hash
    );

    if (!passwordValid) {
      return res.status(401).json({
        error: 'Contraseña actual incorrecta',
      });
    }

    // Hashear nueva contraseña
    const passwordHash = await bcrypt.hash(passwordNueva, 10);

    const { error: errorUpdate } = await supabase
      .from('administradores')
      .update({ password_hash: passwordHash })
      .eq('id', id);

    if (errorUpdate) throw errorUpdate;

    res.json({
      message: 'Contraseña actualizada correctamente',
    });
  })
);

export default router;
