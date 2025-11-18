import express from 'express';
import { supabase } from '../index.js';
import { generalLimiter } from '../middleware/rateLimiter.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  validateEmail,
  validateNombre,
  handleValidationErrors,
} from '../middleware/validation.js';

const router = express.Router();

// POST - Registrar nuevo usuario (cliente)
router.post(
  '/registro',
  generalLimiter,
  validateNombre,
  validateEmail,
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { nombre, email, telefono, ciudad, distrito } = req.body;

    // Verificar si el email ya existe
    const { data: existing } = await supabase
      .from('usuarios')
      .select('id')
      .eq('email', email)
      .single();

    if (existing) {
      return res.status(400).json({
        error: 'El email ya está registrado',
      });
    }

    // Insertar nuevo usuario
    const { data, error } = await supabase
      .from('usuarios')
      .insert([
        {
          nombre,
          email,
          telefono: telefono || null,
          ciudad: ciudad || null,
          distrito: distrito || null,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      usuario: data,
    });
  })
);

// GET - Obtener perfil de usuario por email
router.get(
  '/:email',
  generalLimiter,
  asyncHandler(async (req, res) => {
    const { email } = req.params;

    // Validar que el email sea válido (simple validación)
    if (!email.includes('@')) {
      return res.status(400).json({ error: 'Email inválido' });
    }

    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('email', email)
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json(data);
  })
);

// PUT - Actualizar perfil de usuario
router.put(
  '/:id',
  generalLimiter,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { nombre, telefono, ciudad, distrito, direccion, referencia_domicilio } =
      req.body;

    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const updateData = {};
    if (nombre) updateData.nombre = nombre.trim();
    if (telefono) updateData.telefono = telefono;
    if (ciudad) updateData.ciudad = ciudad.trim();
    if (distrito) updateData.distrito = distrito.trim();
    if (direccion) updateData.direccion = direccion.trim();
    if (referencia_domicilio) updateData.referencia_domicilio = referencia_domicilio.trim();

    const { data, error } = await supabase
      .from('usuarios')
      .update(updateData)
      .eq('id', parseInt(id))
      .select()
      .single();

    if (error) throw error;

    res.json({
      message: 'Perfil actualizado correctamente',
      usuario: data,
    });
  })
);

export default router;
