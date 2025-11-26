import express from 'express';
import { supabase } from '../lib/supabaseClient.js';
import { generalLimiter } from '../middleware/rateLimiter.js';
import { asyncHandler } from '../middleware/errorHandler.js';
// Importamos el nuevo middleware de seguridad
import { verifyAdminToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// ==========================================
// 1. RUTAS PÚBLICAS (CLIENTES Y MENÚ)
// ==========================================

// GET - Obtener todos los productos (Tu código original intacto)
router.get('/', generalLimiter, asyncHandler(async (req, res) => {
    const { data, error } = await supabase
      .from('productos')
      .select('*, categorias(nombre)')
      .order('nombre', { ascending: true });

    if (error) throw error;
    res.json(data);
}));

// GET - Obtener un producto específico (Tu código original intacto)
router.get('/:id', generalLimiter, asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

    const { data, error } = await supabase
      .from('productos')
      .select('*, categorias(nombre)')
      .eq('id', parseInt(id))
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Producto no encontrado' });

    res.json(data);
}));

// ==========================================
// 2. RUTAS PRIVADAS (SOLO ADMINISTRADOR)
// ==========================================

// POST - Crear un nuevo plato
router.post('/', verifyAdminToken, asyncHandler(async (req, res) => {
    const { nombre, descripcion, precio, categoria_id, imagen_url } = req.body;

    // Validación básica
    if (!nombre || !precio || !categoria_id) {
        return res.status(400).json({ error: 'Faltan datos obligatorios (nombre, precio, categoría)' });
    }

    const { data, error } = await supabase
        .from('productos')
        .insert([{ 
            nombre, 
            descripcion, 
            precio, 
            categoria_id, 
            imagen_url, 
            disponible: true // Por defecto disponible
        }])
        .select()
        .single();

    if (error) throw error;
    res.status(201).json({ message: 'Producto creado exitosamente', producto: data });
}));

// PUT - Editar un plato existente
router.put('/:id', verifyAdminToken, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updates = req.body; // Recibe { nombre: '...', precio: 10, ... }

    const { data, error } = await supabase
        .from('productos')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    res.json({ message: 'Producto actualizado', producto: data });
}));

// DELETE - Eliminar un plato
router.delete('/:id', verifyAdminToken, asyncHandler(async (req, res) => {
    const { id } = req.params;

    const { error } = await supabase
        .from('productos')
        .delete()
        .eq('id', id);

    if (error) throw error;
    res.json({ message: 'Producto eliminado correctamente' });
}));

export default router;