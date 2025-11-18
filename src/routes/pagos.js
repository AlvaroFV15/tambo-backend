import express from 'express';
import axios from 'axios';
import { supabase } from '../index.js';
import { generalLimiter, pagosLimiter } from '../middleware/rateLimiter.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// POST - Crear token de pago con Culqi
router.post(
  '/crear-token',
  pagosLimiter,
  asyncHandler(async (req, res) => {
    // Este endpoint generalmente se llama desde el frontend
    // Solo hacemos validaciones básicas
    const { cardNumber, expMonth, expYear, cvv, email } = req.body;

    if (!cardNumber || !expMonth || !expYear || !cvv) {
      return res.status(400).json({
        error: 'Datos de tarjeta incompletos',
      });
    }

    // En producción, esto lo maneja el frontend con Culqi.js
    // Este endpoint es solo para referencia
    res.json({
      message: 'Use Culqi.js en el frontend para crear tokens de forma segura',
      secureTokenURL: 'https://js.culqi.com/v4',
    });
  })
);

// POST - Procesar pago con Culqi
router.post(
  '/procesar',
  pagosLimiter,
  asyncHandler(async (req, res) => {
    const { pedido_id, token_culqi, email } = req.body;

    // Validaciones
    if (!pedido_id || isNaN(pedido_id)) {
      return res.status(400).json({ error: 'Pedido inválido' });
    }

    if (!token_culqi) {
      return res.status(400).json({ error: 'Token de pago requerido' });
    }

    // Obtener pedido
    const { data: pedido, error: errorPedido } = await supabase
      .from('pedidos')
      .select('id, total, numero_pedido')
      .eq('id', parseInt(pedido_id))
      .single();

    if (errorPedido || !pedido) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    // Verificar si ya existe un pago para este pedido
    const { data: pagoPrevio } = await supabase
      .from('pagos')
      .select('id, estado')
      .eq('pedido_id', pedido.id)
      .single();

    if (pagoPrevio && pagoPrevio.estado === 'completado') {
      return res.status(400).json({ error: 'Este pedido ya tiene un pago completado' });
    }

    try {
      // Hacer solicitud a Culqi
      const culqiResponse = await axios.post(
        `${process.env.CULQI_API_URL}/charges`,
        {
          amount: Math.round(pedido.total * 100), // Culqi usa centavos
          currency_code: 'PEN',
          email,
          source_id: token_culqi,
          description: `Pedido ${pedido.numero_pedido}`,
          metadata: {
            pedido_id: pedido.id,
            numero_pedido: pedido.numero_pedido,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.CULQI_SECRET_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const { id: transaction_id, status } = culqiResponse.data;

      // Guardar información del pago
      const { data: pago, error: errorPago } = await supabase
        .from('pagos')
        .insert([
          {
            pedido_id: pedido.id,
            transaction_id,
            monto: pedido.total,
            estado: status === 'successful' ? 'completado' : 'fallido',
            metodo_pago: 'tarjeta',
            respuesta_culqi: culqiResponse.data,
            fecha_pago: status === 'successful' ? new Date() : null,
          },
        ])
        .select()
        .single();

      if (errorPago) throw errorPago;

      // Si el pago fue exitoso, actualizar estado del pedido
      if (status === 'successful') {
        await supabase
          .from('pedidos')
          .update({ estado: 'confirmado' })
          .eq('id', pedido.id);
      }

      res.json({
        message:
          status === 'successful'
            ? 'Pago procesado exitosamente'
            : 'Pago rechazado',
        pago,
        estado: status,
      });
    } catch (error) {
      console.error('[ERROR] Culqi:', error.response?.data || error.message);

      // Registrar fallo de pago
      await supabase.from('pagos').insert([
        {
          pedido_id: pedido.id,
          monto: pedido.total,
          estado: 'fallido',
          metodo_pago: 'tarjeta',
          respuesta_culqi: {
            error: error.message,
            timestamp: new Date(),
          },
        },
      ]);

      res.status(400).json({
        error: 'Error procesando pago con Culqi',
        message:
          error.response?.data?.mensaje ||
          'Intenta nuevamente con otra tarjeta',
      });
    }
  })
);

// GET - Obtener estado de pago
router.get(
  '/:pedido_id',
  generalLimiter,
  asyncHandler(async (req, res) => {
    const { pedido_id } = req.params;

    if (isNaN(pedido_id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const { data, error } = await supabase
      .from('pagos')
      .select('*')
      .eq('pedido_id', parseInt(pedido_id))
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ error: 'Pago no encontrado' });
    }

    res.json(data);
  })
);

export default router;
