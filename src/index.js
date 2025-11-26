import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { errorHandler } from './middleware/errorHandler.js';

// Importar rutas
import adminRoutes from './routes/admin.js';
import usuariosRoutes from './routes/usuarios.js';
import categoriasRoutes from './routes/categorias.js';
import productosRoutes from './routes/productos.js';
import pedidosRoutes from './routes/pedidos.js';
import carritosRoutes from './routes/carritos.js';
import pagosRoutes from './routes/pagos.js';
import reportesRoutes from './routes/reportes.js';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

// ============================================================
// 1. MIDDLEWARES (EL ORDEN AQUÍ ES SAGRADO)
// ============================================================

// Seguridad básica
app.use(helmet());

// CORS (Permisos para que el Frontend hable con el Backend)
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true, 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));

// --- ¡ESTO ES LO QUE ARREGLA EL ERROR DE UNDEFINED! ---
// Debe ir ANTES de las rutas. Convierte lo que llega en JSON a objetos JS.
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Log "Chismoso" (Para ver qué llega en la terminal negra)
app.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    console.log(`📥 [API] ${req.method} ${req.url}`);
    console.log('   Datos:', req.body); 
  }
  next();
});

// ============================================================
// 2. RUTAS
// ============================================================

app.use('/api/admin', adminRoutes);       // Panel Admin
app.use('/api/usuarios', usuariosRoutes); // Login/Registro Clientes
app.use('/api/categorias', categoriasRoutes);
app.use('/api/productos', productosRoutes);
app.use('/api/pedidos', pedidosRoutes);   // Gestión de Pedidos
app.use('/api/carritos', carritosRoutes);
app.use('/api/pagos', pagosRoutes);
app.use('/api/pedidos', pedidosRoutes);
app.use('/api/carritos', carritosRoutes);
app.use('/api/pagos', pagosRoutes);
app.use('/api/reportes', reportesRoutes);

// ============================================================
// 3. ERRORES Y SERVIDOR
// ============================================================

app.get('/api/health', (req, res) => res.json({ status: 'OK' }));

app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`✅ Servidor LISTO en puerto ${PORT}`);
});

export default app;