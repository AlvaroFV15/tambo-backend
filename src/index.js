import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Importar rutas
import categoriasRoutes from './routes/categorias.js';
import productosRoutes from './routes/productos.js';
import usuariosRoutes from './routes/usuarios.js';
import adminRoutes from './routes/admin.js';
import pedidosRoutes from './routes/pedidos.js';
import carritosRoutes from './routes/carritos.js';
import pagosRoutes from './routes/pagos.js';

// Importar middleware
import { errorHandler } from './middleware/errorHandler.js';

// Cargar variables de entorno
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================
// MIDDLEWARE DE SEGURIDAD
// ============================================

// HELMET - Protege contra vulnerabilidades comunes en headers HTTP
app.use(helmet());

// CORS - Controla acceso desde frontend
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));

// Parsear JSON - Limitar tamaño para prevenir ataques
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// ============================================
// INICIALIZAR CLIENTES
// ============================================

// Cliente de Supabase
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// ============================================
// RUTAS DE API
// ============================================

app.use('/api/categorias', categoriasRoutes);
app.use('/api/productos', productosRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/pedidos', pedidosRoutes);
app.use('/api/carritos', carritosRoutes);
app.use('/api/pagos', pagosRoutes);

// Ruta de salud para verificar que el servidor está corriendo
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Servidor funcionando correctamente' });
});

// ============================================
// MANEJO DE ERRORES
// ============================================

// Ruta 404
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Middleware global de errores
app.use(errorHandler);

// ============================================
// INICIAR SERVIDOR
// ============================================

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
  console.log(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
