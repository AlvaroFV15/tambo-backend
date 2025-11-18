import express from 'express';
import { supabase } from '../index.js';
import { generalLimiter, pedidosLimiter } from '../middleware/rateLimiter.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// POST - Crear nuevo pedido
router.post(
  '/',
  pedidosLimiter,
  asyncHandler(async (req, res) => {
    const { usuario_id, items, total, observaciones } = req.body;

    // Validaciones
    if (!usuario_id || isNaN(usuario_id)) {
      return res.status(400).json({ error: 'Usuario inválido' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Carrito vacío' });
    }

    if (!total || isNaN(total) || total <= 0) {
      return res.status(400).json({ error: 'Total inválido' });
    }

    // Verificar que usuario existe
    const { data: usuario, error: errorUsuario } = await supabase
      .from('usuarios')
      .select('id')
      .eq('id', usuario_id)
      .single();

    if (errorUsuario || !usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Generar número único de pedido
    const numeroPedido = `PED-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 5)
      .toUpperCase()}`;

    // Crear pedido en transacción
    try {
      const { data: pedido, error: errorPedido } = await supabase
        .from('pedidos')
        .insert([
          {
            usuario_id,
            numero_pedido: numeroPedido,
            total: parseFloat(total),
            observaciones: observaciones || null,
            estado: 'pendiente',
          },
        ])
        .select()
        .single();

      if (errorPedido) throw errorPedido;

      // Insertar detalles del pedido
      const detalles = items.map(item => ({
        pedido_id: pedido.id,
        producto_id: item.id,
        cantidad: item.cantidad,
        precio_unitario: parseFloat(item.precio),
        subtotal: parseFloat(item.subtotal),
      }));

      const { error: errorDetalles } = await supabase
        .from('detalles_pedidos')
        .insert(detalles);

      if (errorDetalles) throw errorDetalles;

      res.status(201).json({
        message: 'Pedido creado exitosamente',
        pedido: {
          id: pedido.id,
          numero_pedido: pedido.numero_pedido,
          total: pedido.total,
          estado: pedido.estado,
          items,
        },
      });
    } catch (error) {
      console.error('[ERROR] al crear pedido:', error);
      throw error;
    }
  })
);

// GET - Obtener pedidos de un usuario
router.get(
  '/usuario/:usuario_id',
  generalLimiter,
  asyncHandler(async (req, res) => {
    const { usuario_id } = req.params;
    const { estado } = req.query;

    if (isNaN(usuario_id)) {
      return res.status(400).json({ error: 'Usuario ID inválido' });
    }

    let query = supabase
      .from('pedidos')
      .select('*, detalles_pedidos(*, productos(nombre, precio))')
      .eq('usuario_id', parseInt(usuario_id))
      .order('fecha_pedido', { ascending: false });

    if (estado) {
      query = query.eq('estado', estado);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json(data || []);
  })
);

// GET - Obtener un pedido específico
router.get(
  '/:id',
  generalLimiter,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const { data, error } = await supabase
      .from('pedidos')
      .select('*, detalles_pedidos(*, productos(nombre, precio))')
      .eq('id', parseInt(id))
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    res.json(data);
  })
);

// GET - Obtener todos los pedidos (solo admin)
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { estado, page = 1, limit = 10 } = req.query;

    let query = supabase
      .from('pedidos')
      .select('*, usuarios(nombre, email), detalles_pedidos(cantidad)', {
        count: 'exact',
      });

    if (estado) {
      query = query.eq('estado', estado);
    }

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 10));
    const offset = (pageNum - 1) * limitNum;

    query = query
      .range(offset, offset + limitNum - 1)
      .order('fecha_pedido', { ascending: false });

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

// PUT - Actualizar estado del pedido (solo admin)
router.put(
  '/:id/estado',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { estado } = req.body;

    const estadosValidos = [
      'pendiente',
      'confirmado',
      'preparando',
      'listo',
      'cancelado',
    ];

    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }

    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const { data, error } = await supabase
      .from('pedidos')
      .update({ estado })
      .eq('id', parseInt(id))
      .select()
      .single();

    if (error) throw error;

    res.json({
      message: 'Estado del pedido actualizado',
      pedido: data,
    });
  })
);

export default router;
