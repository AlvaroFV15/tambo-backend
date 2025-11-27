import express from 'express';
import { supabase } from '../lib/supabaseClient.js'; 
import { generalLimiter } from '../middleware/rateLimiter.js';
import nodemailer from 'nodemailer';

const router = express.Router();

// ============================================================
// CONFIGURACIÓN DE CORREO (NODEMAILER)
// ============================================================
// ⚠️ RECUERDA: Si usas Gmail, usa la "Contraseña de Aplicación", no tu pass normal.
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465, // Puerto seguro SSL (El que mejor funciona en la nube)
  secure: true, // true para puerto 465
  auth: {
    user: process.env.EMAIL_USER, // Usamos las variables de Render
    pass: process.env.EMAIL_PASS  // Usamos las variables de Render
  },
  // Opciones vitales para evitar Timeouts en la nube:
  tls: {
    rejectUnauthorized: false // Ayuda si hay problemas de certificados
  }
});

// Función auxiliar para generar código (Ej: P-123456)
function generarCodigo() {
  return `P-${Date.now().toString().slice(-6)}`;
}

// Función auxiliar para enviar el correo
async function enviarNotificacionCambioEstado(email, nombreCliente, nroPedido, nuevoEstado) {
  try {
    const asunto = `Actualización de tu pedido ${nroPedido} - El Tambo Cañetano`;
    let mensaje = '';

    if (nuevoEstado === 'confirmado') {
      mensaje = `Hola ${nombreCliente}, ¡Buenas noticias! Tu pedido <strong>${nroPedido}</strong> ha sido confirmado y se está preparando en cocina. 👨‍🍳🍳`;
    } else if (nuevoEstado === 'entregado') {
      mensaje = `Hola ${nombreCliente}, Tu pedido <strong>${nroPedido}</strong> ha sido entregado/servido. ¡Esperamos que lo disfrutes! 🍽️😋`;
    }

    if (mensaje) {
      await transporter.sendMail({
        from: '"El Tambo Cañetano" <noreply@eltambo.com>',
        to: email,
        subject: asunto,
        html: `<h2>Estado Actualizado</h2><p>${mensaje}</p>`
      });
      console.log(`📧 Correo enviado a ${email}`);
    }
  } catch (error) {
    console.error("Error enviando correo:", error);
  }
}

// ============================================================
// 1. POST: CREAR UN PEDIDO
// ============================================================
router.post('/', generalLimiter, async (req, res) => {
  console.log('📦 [BACKEND] Creando pedido...');

  try {
    const { usuario_id, total, metodo_pago, direccion_envio, items, email_cliente } = req.body;

    // Validar datos básicos
    if (!usuario_id || !items || items.length === 0) {
        return res.status(400).json({ error: 'Faltan datos del pedido' });
    }

    const datosPedido = {
      usuario_id,
      total,
      estado: 'pendiente',
      observaciones: direccion_envio, // Aquí guardamos la Mesa/Hora
      numero_pedido: generarCodigo(),
      fecha_pedido: new Date()
    };

    // 1. Insertar Pedido
    const { data: pedido, error: errorPedido } = await supabase
      .from('pedidos')
      .insert([datosPedido])
      .select()
      .single();

    if (errorPedido) throw errorPedido;

    // 2. Insertar Detalles
    const detalles = items.map(item => ({
      pedido_id: pedido.id,
      producto_id: item.producto_id,
      cantidad: item.cantidad,
      precio_unitario: item.precio_unitario || item.precio,
      subtotal: item.cantidad * (item.precio_unitario || item.precio)
    }));

    const { error: errorDetalles } = await supabase
      .from('detalles_pedidos')
      .insert(detalles);

    if (errorDetalles) throw errorDetalles;

    // 3. Registrar pago inicial (si aplica)
    if (metodo_pago !== 'tarjeta') {
      await supabase.from('pagos').insert([{
          pedido_id: pedido.id,
          monto: total,
          estado: 'pendiente',
          metodo_pago: metodo_pago,
          fecha_pago: new Date()
      }]);
    }

    res.status(201).json({ message: 'Pedido creado exitosamente', id: pedido.id });

  } catch (error) {
    console.error('💥 Error creando pedido:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// 2. GET: LEER PEDIDO POR ID
// ============================================================
router.get('/:id', generalLimiter, async (req, res) => {
  try {
    const { id } = req.params;

    if (isNaN(id)) {
        return res.status(400).json({ error: 'ID inválido' });
    }

    const { data, error } = await supabase
      .from('pedidos')
      .select(`
        *,
        detalles_pedidos (
          cantidad,
          precio_unitario,
          subtotal,
          productos ( nombre, imagen_url )
        )
      `)
      .eq('id', parseInt(id))
      .single();

    if (error) {
        return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    res.json(data);

  } catch (error) {
    console.error('💥 Error obteniendo pedido:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// 3. PUT: ACTUALIZAR ESTADO (ADMIN)
// ============================================================
router.put('/:id', generalLimiter, async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;

  console.log(`🔄 [BACKEND] Actualizando pedido ${id} a estado: ${estado}`);

  try {
    // 1. Actualizar en Supabase
    const { data: pedidoActualizado, error } = await supabase
      .from('pedidos')
      .update({ 
        estado: estado,
        updated_at: new Date() 
      })
      .eq('id', id)
      .select(`
        *,
        usuarios ( nombre, email )
      `)
      .single();

    if (error) throw error;

    // 2. Enviar Notificación por Correo
    if (pedidoActualizado.usuarios && pedidoActualizado.usuarios.email) {
      await enviarNotificacionCambioEstado(
        pedidoActualizado.usuarios.email,
        pedidoActualizado.usuarios.nombre,
        pedidoActualizado.numero_pedido,
        estado
      );
    }

    res.json({ message: 'Estado actualizado', pedido: pedidoActualizado });

  } catch (error) {
    console.error('💥 Error actualizando pedido:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;