import express from 'express';
import { supabase } from '../index.js';
import { generalLimiter } from '../middleware/rateLimiter.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// GET - Obtener todas las categorías
router.get(
  '/',
  generalLimiter,
  asyncHandler(async (req, res) => {
    const { data, error } = await supabase
      .from('categorias')
      .select('*')
      .order('nombre', { ascending: true });

    if (error) throw error;

    res.json(data);
  })
);

// GET - Obtener una categoría específica
router.get(
  '/:id',
  generalLimiter,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Validación: asegurar que id es número
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const { data, error } = await supabase
      .from('categorias')
      .select('*')
      .eq('id', parseInt(id))
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }

    res.json(data);
  })
);

export default router;
