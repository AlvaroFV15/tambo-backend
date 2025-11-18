import express from 'express';
import { supabase } from '../index.js';
import { generalLimiter } from '../middleware/rateLimiter.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validateCantidad } from '../middleware/validation.js';

const router = express.Router();

// GET - Obtener todos los productos con filtros opcionales
router.get(
  '/',
  generalLimiter,
  asyncHandler(async (req, res) => {
    const { categoria_id, disponible, page = 1, limit = 12 } = req.query;

    let query = supabase.from('productos').select('*, categorias(nombre)', {
      count: 'exact',
    });

    // Filtrar por categoría si se proporciona
    if (categoria_id && !isNaN(categoria_id)) {
      query = query.eq('categoria_id', parseInt(categoria_id));
    }

    // Filtrar por disponibilidad
    if (disponible !== undefined) {
      query = query.eq('disponible', disponible === 'true');
    }

    // Paginación - PATRÓN: Offset/Limit para resultados grandes
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 12)); // máximo 50 por página
    const offset = (pageNum - 1) * limitNum;

    query = query.range(offset, offset + limitNum - 1).order('nombre', {
      ascending: true,
    });

    const { data, error, count } = await query;

    if (error) throw error;

    res.json({
      data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count,
        pages: Math.ceil(count / limitNum),
      },
    });
  })
);

// GET - Obtener un producto específico
router.get(
  '/:id',
  generalLimiter,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const { data, error } = await supabase
      .from('productos')
      .select('*, categorias(nombre)')
      .eq('id', parseInt(id))
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.json(data);
  })
);

// POST - Verificar disponibilidad de productos (para carrito)
router.post(
  '/verificar-disponibilidad',
  generalLimiter,
  validateCantidad,
  asyncHandler(async (req, res) => {
    const { items } = req.body; // items: [{ id: 1, cantidad: 2 }]

    if (!Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ error: 'items debe ser un array no vacío' });
    }

    const productIds = items.map(item => item.id);

    const { data, error } = await supabase
      .from('productos')
      .select('id, nombre, precio, disponible, cantidad')
      .in('id', productIds);

    if (error) throw error;

    // Verificar que todos los productos existan y estén disponibles
    const disponibilidad = items.map(item => {
      const producto = data.find(p => p.id === item.id);
      return {
        id: item.id,
        disponible: producto && producto.disponible,
        nombre: producto?.nombre,
        precio: producto?.precio,
      };
    });

    res.json({ disponibilidad });
  })
);

export default router;
