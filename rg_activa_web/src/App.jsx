import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { LayoutDashboard, TrendingUp, PlusCircle, DollarSign, Activity, Users, Layers, AlertCircle } from 'lucide-react';

const API_BASE_URL = "http://127.0.0.1:8000/api";


function App() {
  const [lote, setLote] = useState(8);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dashboardData, setDashboardData] = useState(null);
  const [proyeccionData, setProyeccionData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Estado para el formulario de carga de semanas
  const [formData, setFormData] = useState({
    semana_prod: '', peso_gr: '', muertos: '', descartes: '', iniciador_bolsas: '', terminador_bolsas: ''
  });
  const [formMessage, setFormMessage] = useState({ type: '', text: '' });

  // Función para consultar los datos al servidor FastAPI
  const fetchDatos = async () => {
    setLoading(true);
    try {
      const resDash = await fetch(`${API_BASE_URL}/lote/${lote}/dashboard`);
      const dataDash = await resDash.json();
      setDashboardData(dataDash);

      const resProy = await fetch(`${API_BASE_URL}/lote/${lote}/proyeccion`);
      const dataProy = await resProy.json();
      setProyeccionData(dataProy);
    } catch (error) {
      console.error("Error conectando con el backend:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDatos();
  }, [lote]);

  // Manejador del envío del formulario web
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormMessage({ type: '', text: '' });

    const payload = {
      lote: parseInt(lote),
      semana_prod: parseInt(formData.semana_prod),
      peso_gr: parseFloat(formData.peso_gr),
      muertos: parseInt(formData.muertos),
      descartes: parseInt(formData.descartes),
      iniciador_bolsas: parseFloat(formData.iniciador_bolsas || 0),
      terminador_bolsas: parseFloat(formData.terminador_bolsas || 0)
    };

    try {
      const res = await fetch(`${API_BASE_URL}/lote/cargar-semana`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json();

      if (res.ok) {
        setFormMessage({ type: 'success', text: `¡Semana ${payload.semana_prod} guardada con éxito y modelos actualizados!` });
        setFormData({ semana_prod: '', peso_gr: '', muertos: '', descartes: '', iniciador_bolsas: '', terminador_bolsas: '' });
        fetchDatos(); // Refrescar los gráficos automáticamente
      } else {
        setFormMessage({ type: 'error', text: result.detail || "Error al guardar los datos." });
      }
    } catch (error) {
      setFormMessage({ type: 'error', text: "No se pudo comunicar con el servidor." });
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900 text-emerald-400 font-mono">
        Cargando telemetría y modelos analíticos de RGActiva...
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 overflow-hidden">
      {/* BARRA LATERAL (Sidebar de Navegación) */}
      <div className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col justify-between">
        <div>
          <div className="p-6 border-b border-slate-800">
            <h1 className="text-xl font-bold text-emerald-400 flex items-center gap-2 tracking-wide">
              🐔 RGActiva <span className="text-xs bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded border border-emerald-800">v1.1</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">Control de Producción Inteligente</p>
          </div>

          <div className="p-4">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Seleccionar Lote</label>
            <select 
              value={lote} 
              onChange={(e) => setLote(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value={8}>Lote 8 (Enero 2026)</option>
              <option value={9}>Lote 9 (Mayo 2026)</option>
            </select>
          </div>

          <nav className="mt-4 px-2 space-y-1">
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'dashboard' ? 'bg-slate-800 text-emerald-400 border-l-4 border-emerald-500' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'}`}
            >
              <LayoutDashboard size={18} /> Dashboard & Costos
            </button>
            <button 
              onClick={() => setActiveTab('proyeccion')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'proyeccion' ? 'bg-slate-800 text-emerald-400 border-l-4 border-emerald-500' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'}`}
            >
              <TrendingUp size={18} /> Proyecciones IA
            </button>
            <button 
              onClick={() => setActiveTab('cargar')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'cargar' ? 'bg-slate-800 text-emerald-400 border-l-4 border-emerald-500' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'}`}
            >
              <PlusCircle size={18} /> Registrar Semana Real
            </button>
          </nav>
        </div>
        <div className="p-4 text-xs text-slate-500 border-t border-slate-800 text-center font-mono">
          Río Grande, Tierra del Fuego
        </div>
      </div>

      {/* ÁREA DE CONTENIDO CENTRAL */}
      <div className="flex-1 flex flex-col overflow-y-auto bg-slate-900">
        <header className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
          <h2 className="text-xl font-semibold capitalize">{activeTab.replace('-', ' ')}</h2>
          <div className="text-sm bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
            Lote Activo: <span className="text-emerald-400 font-bold"># {dashboardData?.lote}</span>
          </div>
        </header>

        <main className="p-6 space-y-6">
          {/* Alerta si el lote no tiene semanas registradas */}
          {dashboardData?.semana_actual === 0 && (
            <div className="bg-amber-950/40 border border-amber-800/60 p-4 rounded-xl flex gap-3 text-amber-300 text-sm">
              <AlertCircle className="shrink-0" />
              <div>
                <span className="font-bold">Lote recién iniciado:</span> No cuenta con registros semanales en datos.csv todavía. Se muestran los costos fijos de traslado y las estimaciones iniciales base.
              </div>
            </div>
          )}

          {/* VISTA 1: DASHBOARD & COSTOS */}
          {activeTab === 'dashboard' && (
            <>
              {/* TARJETAS DE MÉTRICAS CLAVE (KPIs) */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 shadow-lg">
                  <div className="flex justify-between text-slate-400 mb-2"><span className="text-xs uppercase font-semibold">Costo por Ave Viva</span><DollarSign size={18} className="text-emerald-400" /></div>
                  <div className="text-2xl font-bold">${dashboardData?.costo_por_ave_viva.toLocaleString('es-AR', {minimumFractionDigits:2, maximumFractionDigits:2})}</div>
                  <p className="text-xs text-slate-500 mt-1">Inversión actual / Aves vivas</p>
                </div>
                <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 shadow-lg">
                  <div className="flex justify-between text-slate-400 mb-2"><span className="text-xs uppercase font-semibold">Aves Vivas</span><Users size={18} className="text-blue-400" /></div>
                  <div className="text-2xl font-bold">{dashboardData?.aves_vivas.toLocaleString('es-AR')} <span className="text-xs text-slate-500">un.</span></div>
                  <p className="text-xs text-slate-400 mt-1">Muertes acum: <span className="text-rose-400 font-medium">{dashboardData?.muertos_acum}</span></p>
                </div>
                <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 shadow-lg">
                  <div className="flex justify-between text-slate-400 mb-2"><span className="text-xs uppercase font-semibold">Peso Promedio</span><Activity size={18} className="text-amber-400" /></div>
                  <div className="text-2xl font-bold">{dashboardData?.peso_actual} <span className="text-xs text-slate-500">g</span></div>
                  <p className="text-xs text-slate-500 mt-1">Semana de producción: {dashboardData?.semana_actual}</p>
                </div>
                <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 shadow-lg">
                  <div className="flex justify-between text-slate-400 mb-2"><span className="text-xs uppercase font-semibold">Inversión Acumulada</span><Layers size={18} className="text-purple-400" /></div>
                  <div className="text-2xl font-bold">${dashboardData?.costo_total_acumulado.toLocaleString('es-AR', {maximumFractionDigits:0})}</div>
                  <p className="text-xs text-slate-400 mt-1">Costo Inicial (Pollos + Flete): ${dashboardData?.costo_inicial_total.toLocaleString('es-AR', {maximumFractionDigits:0})}</p>
                </div>
              </div>

              {/* --- COPIAR DESDE AQUÍ ARRIBA DEL GRÁFICO --- */}
<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
  {/* PANEL DE DATOS DE ORIGEN Y TRASLADOS (TAL CUAL EL CSV) */}
  <div className="bg-slate-950 p-6 rounded-xl border border-slate-800">
    <h3 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider mb-4 flex items-center gap-2">
      📋 Costos de Origen e Importación (Datos CSV)
    </h3>
    <div className="space-y-3 text-sm font-mono">
      <div className="flex justify-between border-b border-slate-900 pb-2">
        <span className="text-slate-400">Aves Iniciales Solicitadas:</span>
        <span className="font-bold text-slate-200">{dashboardData?.aves_iniciales.toLocaleString('es-AR')} un.</span>
      </div>
      <div className="flex justify-between border-b border-slate-900 pb-2">
        <span className="text-slate-400">Precio Unitario por Pollito:</span>
        <span className="text-slate-200">${dashboardData?.datos_origen_csv?.unitario_pollo.toLocaleString('es-AR', {minimumFractionDigits:2})}</span>
      </div>
      <div className="flex justify-between border-b border-slate-900 pb-2">
        <span className="text-slate-400">Costo Total de Compra Pollos:</span>
        <span className="text-slate-200">${dashboardData?.datos_origen_csv?.precio_pollos_total.toLocaleString('es-AR', {maximumFractionDigits:0})}</span>
      </div>
      <div className="flex justify-between pt-1 text-slate-400">
        <span>Flete Pollos (ER-EZ):</span>
        <span>${dashboardData?.datos_origen_csv?.traslado_pollos_er_ez.toLocaleString('es-AR', {maximumFractionDigits:0})}</span>
      </div>
    </div>
  </div>

  {/* PANEL DE PRECIOS DE INSUMOS Y ALIMENTO */}
  <div className="bg-slate-950 p-6 rounded-xl border border-slate-800">
    <h3 className="text-sm font-semibold text-purple-400 uppercase tracking-wider mb-4 flex items-center gap-2">
      🌾 Tarifas de Insumos y Flete Terrestre
    </h3>
    <div className="space-y-3 text-sm font-mono">
      <div className="flex justify-between border-b border-slate-900 pb-2">
        <span className="text-slate-400">Flete Alimento por Bolsa (BSAS-RGA):</span>
        <span className="text-purple-400 font-bold">${dashboardData?.datos_origen_csv?.traslado_alim_bolsa.toLocaleString('es-AR', {minimumFractionDigits:2})}</span>
      </div>
      <div className="flex justify-between border-b border-slate-900 pb-2">
        <span className="text-slate-400">Precio Bolsa Iniciador (Origen):</span>
        <span className="text-slate-200">${dashboardData?.datos_origen_csv?.unitario_iniciador.toLocaleString('es-AR', {minimumFractionDigits:2})}</span>
      </div>
      <div className="flex justify-between border-b border-slate-900 pb-2">
        <span className="text-slate-400">Precio Bolsa Terminador (Origen):</span>
        <span className="text-slate-200">${dashboardData?.datos_origen_csv?.unitario_terminador.toLocaleString('es-AR', {minimumFractionDigits:2})}</span>
      </div>
      <div className="flex justify-between pt-1 border-t border-slate-800 text-slate-400 text-xs">
        <span>Presupuesto Alimento Total de la Planilla:</span>
        <span>${dashboardData?.datos_origen_csv?.total_alimento_presupuesto.toLocaleString('es-AR', {maximumFractionDigits:0})}</span>
      </div>
    </div>
  </div>
</div>
{/* --- HASTA AQUÍ, LUEGO VIENE EL GRÁFICO HISTÓRICO --- */}

              {/* 📊 SECCIÓN DE GRÁFICOS ANALÍTICOS */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Gráfico 1: Evolución del Peso (Línea) */}
                <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 lg:col-span-2">
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
                    📈 Evolución del Peso Promedio por Semana
                  </h3>
                  <div className="h-72">
                    {dashboardData?.historico_semanas.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={dashboardData.historico_semanas}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                          <XAxis dataKey="Semana_prod" stroke="#94a3b8" />
                          <YAxis stroke="#94a3b8" unit="g" />
                          <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }} />
                          <Legend />
                          <Line type="monotone" dataKey="Peso_gr" name="Peso Real (g)" stroke="#34d399" strokeWidth={3} activeDot={{ r: 8 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-slate-500 text-sm italic">No hay datos históricos para este lote.</div>
                    )}
                  </div>
                </div>

                {/* Gráfico 2: Mortalidad y Descartes por Semana (Barras Apiladas) */}
                <div className="bg-slate-950 p-6 rounded-xl border border-slate-800">
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 text-rose-400">
                    ☠️ Bajas y Descartes por Semana
                  </h3>
                  <div className="h-72">
                    {dashboardData?.historico_semanas.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dashboardData.historico_semanas}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                          <XAxis dataKey="Semana_prod" stroke="#94a3b8" />
                          <YAxis stroke="#94a3b8" />
                          <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }} />
                          <Legend />
                          <Bar dataKey="Muertos" name="Muertos" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="Descartes" name="Descartes" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-slate-500 text-sm italic">No hay datos de bajas para este lote.</div>
                    )}
                  </div>
                </div>

                {/* Gráfico 3: Consumo de Alimento Iniciador vs Terminador (Barras Agrupadas) */}
                <div className="bg-slate-950 p-6 rounded-xl border border-slate-800">
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 text-amber-400">
                    🌾 Distribución de Consumo de Alimento (Bolsas)
                  </h3>
                  <div className="h-72">
                    {dashboardData?.historico_semanas.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dashboardData.historico_semanas}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                          <XAxis dataKey="Semana_prod" stroke="#94a3b8" />
                          <YAxis stroke="#94a3b8" />
                          <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }} />
                          <Legend />
                          <Bar dataKey="Iniciador_bolsas" name="Iniciador (Bls)" fill="#eab308" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="Terminador_bolsas" name="Terminador (Bls)" fill="#a855f7" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-slate-500 text-sm italic">No hay datos de alimento para este lote.</div>
                    )}
                  </div>
                </div>

              </div>
            </>
          )}

          {/* VISTA 2: PROYECCIONES IA (ACTUALIZADO CON GRÁFICOS) */}
          {activeTab === 'proyeccion' && proyeccionData && (
            <div className="space-y-6">
              {/* FICHA RESUMEN DE PROYECCIÓN */}
              <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-emerald-400">Predicción Inteligente - Próxima Semana</h3>
                  <p className="text-sm text-slate-400 mt-1">Cálculos proyectados por los modelos de Random Forest para el ciclo entrante.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                  <div className="bg-slate-900 p-5 rounded-lg border border-slate-800 text-center">
                    <span className="text-xs font-semibold text-slate-400 uppercase">Semana Proyectada</span>
                    <div className="text-4xl font-bold text-emerald-400 mt-2"># {proyeccionData.semana_proyectada}</div>
                  </div>
                  <div className="bg-slate-900 p-5 rounded-lg border border-slate-800 text-center">
                    <span className="text-xs font-semibold text-slate-400 uppercase">Peso Esperado</span>
                    <div className="text-4xl font-bold text-slate-100 mt-2">{proyeccionData.peso_esperado_gr} <span className="text-base text-slate-500">g</span></div>
                  </div>
                  <div className="bg-slate-900 p-5 rounded-lg border border-slate-800 text-center">
                    <span className="text-xs font-semibold text-slate-400 uppercase">Alimento Estimado</span>
                    <div className="text-sm text-slate-300 space-y-1 mt-2 font-mono">
                      <div>Iniciador: <span className="text-amber-400 font-bold">{proyeccionData.iniciador_bolsas}</span> bls.</div>
                      <div>Terminador: <span className="text-purple-400 font-bold">{proyeccionData.terminador_bolsas}</span> bls.</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* CUADRÍCULA DE ANALÍTICA DE IA */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Gráfico A: Calce y Proyección Futura */}
                <div className="bg-slate-950 p-6 rounded-xl border border-slate-800">
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
                    🔮 Trayectoria de Crecimiento: Real vs. Predicción IA
                  </h3>
                  <div className="h-72">
                    {proyeccionData.grafico_proyecciones?.length > 1 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={proyeccionData.grafico_proyecciones}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                          <XAxis dataKey="semana" stroke="#94a3b8" />
                          <YAxis stroke="#94a3b8" unit="g" />
                          <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }} />
                          <Legend />
                          <Line type="monotone" dataKey="peso_real" name="Peso Real Real (g)" stroke="#10b981" strokeWidth={3} activeDot={{ r: 6 }} connectNulls />
                          <Line type="monotone" dataKey="peso_predicho" name="Predicción IA (g)" stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 5" />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-slate-500 text-sm italic">Datos insuficientes para mapear la trayectoria.</div>
                    )}
                  </div>
                </div>

                {/* Gráfico B: Historial de Errores de Semanas Anteriores */}
                <div className="bg-slate-950 p-6 rounded-xl border border-slate-800">
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 text-rose-400">
                    📉 Historial de Desvío Absoluto del Modelo (Margen de Error)
                  </h3>
                  <div className="h-72">
                    {proyeccionData.grafico_proyecciones?.filter(d => d.error_gramos !== null).length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={proyeccionData.grafico_proyecciones.filter(d => d.error_gramos !== null)}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                          <XAxis dataKey="semana" stroke="#94a3b8" />
                          <YAxis stroke="#94a3b8" unit="g" />
                          <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }} />
                          <Legend />
                          <Bar dataKey="error_gramos" name="Desvío de Peso (g)" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-slate-500 text-sm italic">
                        No hay desvíos que reportar aún. El modelo se autoevaluará cuando el lote sume semanas.
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* VISTA 3: FORMULARIO DE CARGA */}
          {activeTab === 'cargar' && (
            <div className="max-w-2xl bg-slate-950 p-6 rounded-xl border border-slate-800">
              <div className="mb-6">
                <h3 className="text-lg font-medium">Cierre de Semana - Registro de Datos</h3>
                <p className="text-sm text-slate-400 mt-1">Los datos ingresados se guardarán de forma directa en el archivo plano del sistema y actualizarán las métricas financieras.</p>
              </div>

              {formMessage.text && (
                <div className={`p-4 rounded-lg mb-6 text-sm border ${formMessage.type === 'success' ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300' : 'bg-rose-950/40 border-rose-800 text-rose-300'}`}>
                  {formMessage.text}
                </div>
              )}

              <form onSubmit={handleFormSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase block mb-1">Número de Semana *</label>
                  <input type="number" required value={formData.semana_prod} onChange={(e) => setFormData({...formData, semana_prod: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-100 focus:outline-none focus:border-emerald-500" placeholder="Ej: 5" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase block mb-1">Peso Promedio Registrado (g) *</label>
                  <input type="number" step="0.01" required value={formData.peso_gr} onChange={(e) => setFormData({...formData, peso_gr: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-100 focus:outline-none focus:border-emerald-500" placeholder="Ej: 1350" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase block mb-1">Muertes de la Semana *</label>
                  <input type="number" required value={formData.muertos} onChange={(e) => setFormData({...formData, muertos: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-100 focus:outline-none focus:border-emerald-500" placeholder="Ej: 14" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase block mb-1">Descartes de la Semana *</label>
                  <input type="number" required value={formData.descartes} onChange={(e) => setFormData({...formData, descartes: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-100 focus:outline-none focus:border-emerald-500" placeholder="Ej: 3" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase block mb-1">Bolsas Alimento Iniciador Consumidas</label>
                  <input type="number" step="0.1" value={formData.iniciador_bolsas} onChange={(e) => setFormData({...formData, iniciador_bolsas: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-100 focus:outline-none focus:border-emerald-500" placeholder="0" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase block mb-1">Bolsas Alimento Terminador Consumidas</label>
                  <input type="number" step="0.1" value={formData.terminador_bolsas} onChange={(e) => setFormData({...formData, terminador_bolsas: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-100 focus:outline-none focus:border-emerald-500" placeholder="0" />
                </div>
                
                <div className="md:col-span-2 pt-4">
                  <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 font-semibold text-slate-950 py-3 rounded-lg transition-colors shadow-lg">
                    Guardar Registro y Actualizar Modelos
                  </button>
                </div>
              </form>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;