import express from 'express';
import dotenv from 'dotenv';
// 1. Cargar variables de entorno INMEDIATAMENTE antes de usarlas
dotenv.config();

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient.js'; // Cliente público
import { generalLimiter } from '../middleware/rateLimiter.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  validateEmail,
  validateNombre,
  handleValidationErrors,
} from '../middleware/validation.js';

const router = express.Router();

// --- Cliente Admin local (Para operaciones seguras como Login) ---
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

// ==========================================
//  LOGIN DE USUARIO (CON LOGS DE DEPURACIÓN)
// ==========================================
router.post('/login', generalLimiter, async (req, res) => {
  try {
    console.log('------------------------------------------------');
    console.log('📥 [LOGIN] Petición recibida');
    
    let { identifier, password } = req.body || {};
    
    // 1. Validaciones básicas de entrada
    if (!identifier || typeof identifier !== 'string') {
      console.log('❌ [LOGIN] Falta identifier o no es string');
      return res.status(400).json({ error: 'Falta el email o teléfono' });
    }
    
    // Limpiar espacios y pasar a minúsculas (si tu email en BD es minúscula)
    identifier = identifier.trim(); 
    console.log(`🔍 [LOGIN] Buscando usuario: "${identifier}"`);

    // 2. Buscar usuario en Supabase (Email)
    // Seleccionamos explícitamente la columna password
    const { data: emailData, error: emailError } = await supabaseAdmin
      .from('usuarios')
      .select('id, email, telefono, password, nombre, ciudad, distrito')
      .eq('email', identifier)
      .maybeSingle(); // maybeSingle no lanza error si está vacío

    if (emailError) {
      console.error('💥 [LOGIN] Error consultando Supabase (Email):', emailError.message);
      // Si el error dice "column does not exist", es un problema de la BD
      if (emailError.message.includes('does not exist')) {
         return res.status(500).json({ error: 'Error de configuración de Base de Datos (Falta columna password)' });
      }
    }

    let user = emailData;

    // 3. Si no encuentra por Email, intentar por Teléfono
    if (!user) {
      console.log('⚠️ [LOGIN] No encontrado por email. Intentando por teléfono...');
      const { data: telData, error: telError } = await supabaseAdmin
        .from('usuarios')
        .select('id, email, telefono, password, nombre, ciudad, distrito')
        .eq('telefono', identifier)
        .maybeSingle();
        
      if (telError) console.error('💥 [LOGIN] Error consultando Supabase (Teléfono):', telError.message);
      user = telData;
    }

    // 4. Si el usuario definitivamente no existe
    if (!user) {
      console.log('⛔ [LOGIN] Resultado final: USUARIO NO ENCONTRADO en la BD.');
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    console.log(`✅ [LOGIN] Usuario encontrado ID: ${user.id}. Verificando contraseña...`);

    // 5. Verificar Contraseña
    if (!user.password) {
      console.warn('⚠️ [LOGIN] El usuario existe pero la columna PASSWORD es NULL/Vacía.');
      // Aquí decides: ¿Dejas pasar o bloqueas? Por seguridad, bloqueamos si espera contraseña.
      // Si es un usuario antiguo sin clave, podrías rechazarlo y pedirle recuperar clave.
      if (password) {
         return res.status(401).json({ error: 'Tu cuenta no tiene contraseña configurada. Contacta soporte.' });
      }
    }

    // Comparar con bcrypt
    const match = await bcrypt.compare(password, user.password);
    
    if (!match) {
      console.log('❌ [LOGIN] Contraseña Incorrecta.');
      return res.status(401).json({ error: 'Credenciales inválidas (Contraseña incorrecta)' });
    }

    console.log('🎉 [LOGIN] Contraseña Correcta. Generando Token...');

    // 6. Generar Token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('🔥 [FATAL] No existe JWT_SECRET en .env');
      return res.status(500).json({ error: 'Error interno del servidor' });
    }

    const token = jwt.sign(
      { sub: user.id, email: user.email, role: 'user' },
      jwtSecret,
      { expiresIn: '7d' }
    );

    // 7. Responder (Datos seguros)
    const safeUser = {
      id: user.id,
      nombre: user.nombre,
      email: user.email,
      telefono: user.telefono,
      ciudad: user.ciudad,
      distrito: user.distrito
    };

    res.json({ 
      message: 'Login exitoso',
      token, 
      user: safeUser 
    });

  } catch (err) {
    console.error('💥 [LOGIN] Error NO CONTROLADO:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ==========================================
//  REGISTRO DE USUARIO
// ==========================================
router.post(
  '/registro',
  generalLimiter,
  validateNombre,
  validateEmail,
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { nombre, email, telefono, ciudad, distrito, password } = req.body;

    // Verificar duplicados
    const { data: existing } = await supabase
      .from('usuarios')
      .select('id')
      .eq('email', email)
      .single();

    if (existing) {
      return res.status(400).json({ error: 'El email ya está registrado' });
    }

    // Hashear password
    let hashedPassword = null;
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    // Insertar
    const { data, error } = await supabase
      .from('usuarios')
      .insert([{
        nombre,
        email,
        telefono: telefono || null,
        password: hashedPassword,
        ciudad: ciudad || null,
        distrito: distrito || null,
      }])
      .select()
      .single();

    if (error) throw error;

    const safeUser = { ...data };
    delete safeUser.password; // No devolver la password

    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      usuario: safeUser,
    });
  })
);

// ==========================================
//  OBTENER PERFIL
// ==========================================
router.get('/:email', generalLimiter, asyncHandler(async (req, res) => {
  const { email } = req.params;
  // NOTA: Aquí NO pedimos la password para no exponerla
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nombre, email, telefono, ciudad, distrito, direccion, referencia_domicilio')
    .eq('email', email)
    .single();

  if (error || !data) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json(data);
}));

// ==========================================
//  ACTUALIZAR PERFIL
// ==========================================
router.put('/:id', generalLimiter, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { nombre, telefono, ciudad, distrito, direccion, referencia_domicilio, password } = req.body;

  const updateData = {};
  if (nombre) updateData.nombre = nombre.trim();
  if (telefono) updateData.telefono = telefono;
  if (ciudad) updateData.ciudad = ciudad.trim();
  if (distrito) updateData.distrito = distrito.trim();
  if (direccion) updateData.direccion = direccion.trim();
  if (referencia_domicilio) updateData.referencia_domicilio = referencia_domicilio.trim();
  
  if (password) {
    updateData.password = await bcrypt.hash(password, 10);
  }

  const { data, error } = await supabase
    .from('usuarios')
    .update(updateData)
    .eq('id', parseInt(id))
    .select('id, nombre, email, telefono, ciudad, distrito, direccion, referencia_domicilio')
    .single();

  if (error) throw error;

  res.json({
    message: 'Perfil actualizado correctamente',
    usuario: data,
  });
}));

export default router;