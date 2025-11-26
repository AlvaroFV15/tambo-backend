import express from 'express';
import { supabase } from '../lib/supabaseClient.js';
import { generalLimiter } from '../middleware/rateLimiter.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

router.get('/', generalLimiter, asyncHandler(async (req, res) => {
    const { data, error } = await supabase
      .from('categorias')
      .select('*')
      .order('nombre', { ascending: true });

    if (error) throw error;
    
    // Enviamos el array directo
    res.json(data);
}));

export default router;