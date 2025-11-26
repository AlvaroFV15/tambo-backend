import express from 'express';
import { supabase } from '../lib/supabaseClient.js';
import { generalLimiter } from '../middleware/rateLimiter.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validateCantidad } from '../middleware/validation.js';

const router = express.Router();

// POST - Validar carrito antes de crear pedido
// Verifica disponibilidad y calcula total correcto
router.post(
  '/validar',
  generalLimiter,
  asyncHandler(async (req, res) => {
    const { items } = req.body; // items: [{ id: 1, cantidad: 2 }]

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: 'Carrito vacío',
      });
    }

    // Validar que cada item tenga id y cantidad válidos
    for (const item of items) {
      if (isNaN(item.id) || isNaN(item.cantidad) || item.cantidad < 1) {
        return res.status(400).json({
          error: 'Items inválidos en el carrito',
        });
      }
    }

    const productIds = items.map(item => item.id);

    // Obtener productos del carrito
    const { data: productos, error } = await supabase
      .from('productos')
      .select('id, nombre, precio, disponible')
      .in('id', productIds);

    if (error) throw error;

    // Validar que todos los productos existan
    if (productos.length !== items.length) {
      return res.status(400).json({
        error: 'Algunos productos no existen',
      });
    }

    // Validar disponibilidad y calcular total
    let total = 0;
    const carritoValidado = items.map(item => {
      const producto = productos.find(p => p.id === item.id);

      if (!producto) {
        throw new Error(`Producto ${item.id} no encontrado`);
      }

      if (!producto.disponible) {
        throw new Error(`Producto ${producto.nombre} no disponible`);
      }

      const subtotal = producto.precio * item.cantidad;
      total += subtotal;

      return {
        id: producto.id,
        nombre: producto.nombre,
        precio: producto.precio,
        cantidad: item.cantidad,
        subtotal,
      };
    });

    res.json({
      valido: true,
      items: carritoValidado,
      total: parseFloat(total.toFixed(2)),
    });
  })
);

export default router;
