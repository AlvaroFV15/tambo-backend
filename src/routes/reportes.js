import express from 'express';
import { supabase } from '../lib/supabaseClient.js';
import { verifyAdminToken } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/ventas', verifyAdminToken, async (req, res) => {
  try {
    const { inicio, fin } = req.query;

    // 1. Configurar fechas (Si no envían, tomamos el último mes)
    const fechaFin = fin ? new Date(fin) : new Date();
    // Ajustar al final del día
    fechaFin.setHours(23, 59, 59, 999);

    const fechaInicio = inicio ? new Date(inicio) : new Date();
    if (!inicio) fechaInicio.setMonth(fechaInicio.getMonth() - 1); // 1 mes atrás por defecto
    // Ajustar al inicio del día
    fechaInicio.setHours(0, 0, 0, 0);

    // 2. Consultar pedidos completados en ese rango
    // Filtramos solo los que son dinero real ('confirmado' o 'entregado')
    const { data: pedidos, error } = await supabase
      .from('pedidos')
      .select(`
        id, 
        total, 
        created_at, 
        estado,
        detalles_pedidos (
          cantidad,
          productos ( nombre )
        )
      `)
      .in('estado', ['confirmado', 'entregado']) 
      .gte('created_at', fechaInicio.toISOString())
      .lte('created_at', fechaFin.toISOString());

    if (error) throw error;

    // 3. Procesar datos para las gráficas (Agrupación)
    
    // A) Totales Generales
    let totalIngresos = 0;
    let totalPedidos = pedidos.length;

    // B) Ventas por Día (Para Gráfico de Barras)
    const ventasPorDia = {}; // { "2023-11-25": 150.00, ... }

    // C) Platos más vendidos (Para Gráfico de Pastel)
    const conteoPlatos = {}; // { "Ceviche": 10, "Arroz con Pollo": 5 }

    pedidos.forEach(p => {
      totalIngresos += p.total;

      // Agrupar por fecha (YYYY-MM-DD)
      const fecha = new Date(p.created_at).toISOString().split('T')[0];
      if (!ventasPorDia[fecha]) ventasPorDia[fecha] = 0;
      ventasPorDia[fecha] += p.total;

      // Contar platos
      p.detalles_pedidos.forEach(d => {
        const nombrePlato = d.productos?.nombre || 'Desconocido';
        if (!conteoPlatos[nombrePlato]) conteoPlatos[nombrePlato] = 0;
        conteoPlatos[nombrePlato] += d.cantidad;
      });
    });

    // 4. Formatear respuesta para el Frontend
    res.json({
      resumen: {
        ingresos: totalIngresos,
        pedidos: totalPedidos,
        ticketPromedio: totalPedidos > 0 ? (totalIngresos / totalPedidos) : 0
      },
      graficaDias: {
        labels: Object.keys(ventasPorDia).sort(), // Las fechas ordenadas
        data: Object.keys(ventasPorDia).sort().map(f => ventasPorDia[f]) // Los montos
      },
      graficaPlatos: {
        labels: Object.keys(conteoPlatos),
        data: Object.values(conteoPlatos)
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

export default router;