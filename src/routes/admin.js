import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { supabase } from '../lib/supabaseClient.js';
import { generalLimiter } from '../middleware/rateLimiter.js';
import nodemailer from 'nodemailer'; // <--- 1. NUEVO IMPORT

const router = express.Router();

// ============================================================
// CONFIGURACIÓN DE CORREO (NODEMAILER)
// ============================================================
// ⚠️ ATENCIÓN: Rellena esto con tu correo y contraseña de aplicación
console.log("📧 INTENTO DE ENVÍO:");
console.log("   User:", process.env.EMAIL_USER ? "Cargado Correctamente" : "VACÍO/ERROR");
console.log("   Pass:", process.env.EMAIL_PASS ? "Cargado Correctamente" : "VACÍO/ERROR");
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587, // Puerto seguro SSL (El que mejor funciona en la nube)
  secure: false, // true para puerto 465
  auth: {
    user: process.env.EMAIL_USER, // Usamos las variables de Render
    pass: process.env.EMAIL_PASS  // Usamos las variables de Render
  },
  // Opciones vitales para evitar Timeouts en la nube:
  tls: {
    rejectUnauthorized: false // Ayuda si hay problemas de certificados
  },
  // --- EL TRUCO MÁGICO ---
  family: 4 // <--- ESTO FUERZA EL USO DE IPv4 (Soluciona el Timeout en Render)
});
// Función auxiliar para enviar el correo (No bloquea el sistema si falla)
async function enviarNotificacionCambioEstado(email, nombreCliente, nroPedido, nuevoEstado) {
  try {
    const asunto = `Actualización de tu pedido ${nroPedido} - El Tambo Cañetano`;
    let mensaje = '';

    if (nuevoEstado === 'confirmado') {
      mensaje = `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <h2 style="color: #28a745;">¡Pedido Confirmado! 👨‍🍳</h2>
          <p>Hola <strong>${nombreCliente}</strong>,</p>
          <p>Tu pedido <strong>${nroPedido}</strong> ha sido aceptado por cocina y se está preparando.</p>
        </div>
      `;
    } else if (nuevoEstado === 'entregado') {
      mensaje = `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <h2 style="color: #007bff;">¡Pedido Entregado! 🍽️</h2>
          <p>Hola <strong>${nombreCliente}</strong>,</p>
          <p>Tu pedido <strong>${nroPedido}</strong> ha sido servido/entregado.</p>
          <p>¡Gracias por tu preferencia!</p>
        </div>
      `;
    }

    if (mensaje && email) {
      await transporter.sendMail({
        from: '"El Tambo Cañetano" <noreply@eltambo.com>',
        to: email,
        subject: asunto,
        html: mensaje
      });
      console.log(`📧 [ADMIN] Correo enviado a ${email}`);
    }
  } catch (error) {
    console.error("⚠️ Error enviando correo:", error.message);
  }
}

// ============================================================
// MIDDLEWARE DE SEGURIDAD (NO TOCAR, ESTÁ PERFECTO)
// ============================================================
const verifyAdminToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Acceso denegado' });

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = verified;
    next();
  } catch (err) {
    res.status(400).json({ error: 'Token inválido' });
  }
};

// 1. LOGIN (TU CÓDIGO ORIGINAL QUE FUNCIONA)
router.post('/login', generalLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    const { data: admin, error } = await supabase
      .from('administradores')
      .select('*')
      .eq('email', email)
      .eq('activo', true)
      .single();

    if (error || !admin) return res.status(401).json({ error: 'Credenciales inválidas' });

    const match = await bcrypt.compare(password, admin.password_hash);
    if (!match) return res.status(401).json({ error: 'Contraseña incorrecta' });

    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({ message: 'Bienvenido', token, admin: { id: admin.id, nombre: admin.nombre } });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error interno' });
  }
});

// 2. OBTENER PEDIDOS (TU CÓDIGO ORIGINAL)
router.get('/pedidos', verifyAdminToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('pedidos')
      .select(`
        *,
        usuarios ( nombre, telefono, email ),
        detalles_pedidos (
          cantidad,
          subtotal,
          productos ( nombre )
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// 3. ACTUALIZAR ESTADO (AQUÍ ES DONDE AGREGUÉ EL CORREO)
// ============================================================
router.put('/pedidos/:id', verifyAdminToken, async (req, res) => {
  const { id } = req.params;
  const estado = req.body ? req.body.estado : null;

  console.log(`🔄 [ADMIN] Cambiando pedido ${id} a estado: ${estado}`);

  try {
    if (!estado) {
        return res.status(400).json({ error: 'Falta el nuevo estado' });
    }

    // 1. Actualizamos y pedimos DATOS DEL USUARIO en la misma consulta
    const { data: pedidoActualizado, error } = await supabase
      .from('pedidos')
      .update({ estado: estado })
      .eq('id', parseInt(id))
      // IMPORTANTE: Agregué 'usuarios(nombre, email, numero_pedido)' al select
      // para poder tener el correo a quien enviar.
      .select('*, usuarios ( nombre, email )') 
      .single();

    if (error) {
        console.error('❌ Error Supabase:', error.message);
        throw error;
    }

    console.log('✅ Cambio exitoso en BD');

    // 2. LOGICA DE ENVÍO DE CORREO
    if (pedidoActualizado.usuarios && pedidoActualizado.usuarios.email) {
      // Usamos el numero de pedido del objeto actualizado
      const nro = pedidoActualizado.numero_pedido || `#${pedidoActualizado.id}`;
      
      // Enviamos el correo (sin await para que la web no se trabe esperando)
      enviarNotificacionCambioEstado(
        pedidoActualizado.usuarios.email,
        pedidoActualizado.usuarios.nombre,
        nro,
        estado
      );
    } else {
      console.log("⚠️ No se envió correo: Faltan datos del usuario.");
    }

    res.json({ message: 'Estado actualizado', pedido: pedidoActualizado });

  } catch (error) {
    console.error('💥 Error actualizando:', error);
    res.status(500).json({ error: 'No se pudo actualizar el estado' });
  }
});

export default router;