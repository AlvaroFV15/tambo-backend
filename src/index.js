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
// ⚠️ SOLUCIÓN CRÍTICA PARA RENDER (TRUST PROXY)
// ============================================================
// Esto arregla el error: ERR_ERL_UNEXPECTED_X_FORWARDED_FOR
// Le dice a Express que confíe en el balanceador de carga de Render.
app.set('trust proxy', 1);

// ============================================================
// 1. MIDDLEWARES
// ============================================================

// Seguridad básica
app.use(helmet());

// CORS (Configurado para aceptar Localhost Y Vercel)
const corsOptions = {
  origin: [
    'http://localhost:3000', 
    process.env.FRONTEND_URL // La URL de Vercel configurada en Render
  ],
  credentials: true, 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));

// Procesamiento de datos
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Log "Chismoso"
app.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    console.log(`📥 [API] ${req.method} ${req.url}`);
    // console.log('   Datos:', req.body); // Descomenta si necesitas depurar
  }
  next();
});

// ============================================================
// 2. RUTAS
// ============================================================

app.use('/api/admin', adminRoutes);       
app.use('/api/usuarios', usuariosRoutes); 
app.use('/api/categorias', categoriasRoutes);
app.use('/api/productos', productosRoutes);
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