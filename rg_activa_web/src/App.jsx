import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import {
  Activity,
  GitCompare,
  Info,
  RefreshCw,
  TrendingUp,
  Users,
  Feather,
  ChevronRight,
  Database,
  CheckSquare,
  Square,
  BookOpen
} from 'lucide-react';
import { lotesHistoricos } from './data/lotes_data';
import { predictForest } from './utils/predictor';

// Colores consistentes para la visualización de los diferentes lotes
const LOT_COLORS = {
  '1': '#f87171', // Red
  '2': '#60a5fa', // Blue
  '3': '#fbbf24', // Amber
  '4': '#c084fc', // Purple
  '5': '#f472b6', // Pink
  '6': '#fb7185', // Rose
  '9': '#2dd4bf', // Teal
  'simulated': '#10b981' // Emerald (Lote Actual)
};

export default function App() {
  const [activeTab, setActiveTab] = useState('simulador');
  
  // Modelos cargados en el cliente
  const [models, setModels] = useState(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [modelsError, setModelsError] = useState(false);

  // Carga inicial de modelos
  useEffect(() => {
    fetch('/modelos.json')
      .then((res) => {
        if (!res.ok) throw new Error("No se pudo cargar el archivo de modelos.");
        return res.json();
      })
      .then((data) => {
        setModels(data);
        setModelsLoaded(true);
      })
      .catch((err) => {
        console.error("Error al cargar modelos IA:", err);
        setModelsError(true);
      });
  }, []);

  // --- ESTADO DEL SIMULADOR ---
  const [pollosIniciales, setPollosIniciales] = useState(4200);
  const [semanasInputs, setSemanasInputs] = useState(() => {
    // Intentar cargar desde localStorage si existe
    const savedInputs = localStorage.getItem('rg_semanas_inputs');
    const savedPollos = localStorage.getItem('rg_pollos_iniciales');
    
    if (savedPollos) {
      setTimeout(() => setPollosIniciales(parseInt(savedPollos) || 4200), 0);
    }
    
    if (savedInputs) {
      try {
        return JSON.parse(savedInputs);
      } catch (e) {
        console.error("Error leyendo localStorage:", e);
      }
    }
    
    // Default: 12 semanas en blanco
    return Array.from({ length: 12 }, (_, i) => ({
      semana: i + 1,
      muertos: '',
      descartes: '',
      peso: '',
      iniciador: '',
      terminador: ''
    }));
  });

  // Guardar datos del simulador en localStorage para persistencia
  useEffect(() => {
    localStorage.setItem('rg_semanas_inputs', JSON.stringify(semanasInputs));
    localStorage.setItem('rg_pollos_iniciales', String(pollosIniciales));
  }, [semanasInputs, pollosIniciales]);

  // Cargar una plantilla de lote real histórico
  const handleLoadTemplate = (lotId) => {
    if (lotId === 'none') {
      setSemanasInputs(
        Array.from({ length: 12 }, (_, i) => ({
          semana: i + 1,
          muertos: '',
          descartes: '',
          peso: '',
          iniciador: '',
          terminador: ''
        }))
      );
      setPollosIniciales(4200);
      return;
    }
    const lot = lotesHistoricos[lotId];
    if (lot) {
      setPollosIniciales(lot.cantidad_inicial);
      const newInputs = Array.from({ length: 12 }, (_, i) => {
        const w = i + 1;
        const hW = lot.semanas.find((x) => x.semana === w);
        return {
          semana: w,
          muertos: hW ? String(hW.muertos) : '',
          descartes: hW ? String(hW.descartes) : '',
          peso: hW ? String(hW.peso) : '',
          iniciador: hW ? String(hW.iniciador) : '',
          terminador: hW ? String(hW.terminador) : ''
        };
      });
      setSemanasInputs(newInputs);
    }
  };

  const handleInputChange = (index, field, value) => {
    const newInputs = [...semanasInputs];
    newInputs[index][field] = value;
    setSemanasInputs(newInputs);
  };

  const handleReset = () => {
    if (window.confirm("¿Seguro que deseas limpiar todos los datos de la simulación?")) {
      handleLoadTemplate('none');
    }
  };

  // --- CÓMPUTO RECURSIVO CON MODELOS IA ---
  const roundToTwo = (num) => Math.round(num * 100) / 100;

  const simulatedWeeks = React.useMemo(() => {
    let results = [];
    let currentMuertosAcum = 0;
    let currentDescartesAcum = 0;
    let currentAvesVivas = pollosIniciales;
    let currentPeso = 40.0; // Peso del pollito de un día en gramos
    let iniciadorAcum = 0;
    let terminadorAcum = 0;

    for (let idx = 0; idx < 12; idx++) {
      const w = idx + 1;
      const input = semanasInputs[idx];

      // Una semana es real si tiene peso y todas las anteriores también son reales
      const isPreviousReal = idx === 0 || results[idx - 1].tipo === 'real';
      const isReal = isPreviousReal && input.peso !== '' && !isNaN(parseFloat(input.peso));

      if (isReal) {
        const muertos = parseInt(input.muertos) || 0;
        const descartes = parseInt(input.descartes) || 0;
        const peso = parseFloat(input.peso);
        const iniciador = parseFloat(input.iniciador) || 0;
        const terminador = parseFloat(input.terminador) || 0;

        currentMuertosAcum += muertos;
        currentDescartesAcum += descartes;
        currentAvesVivas = pollosIniciales - currentMuertosAcum - currentDescartesAcum;
        currentPeso = peso;
        iniciadorAcum += iniciador;
        terminadorAcum += terminador;

        results.push({
          semana: w,
          tipo: 'real',
          peso: peso,
          muertos: muertos,
          descartes: descartes,
          muertos_acum: currentMuertosAcum,
          descartes_acum: currentDescartesAcum,
          aves_vivas: currentAvesVivas,
          supervivencia: roundToTwo((currentAvesVivas / pollosIniciales) * 100),
          iniciador: iniciador,
          terminador: terminador,
          iniciador_acum: iniciadorAcum,
          terminador_acum: terminadorAcum
        });
      } else {
        // Semana proyectada (corre modelos)
        // Permite simular mortalidad futura si el usuario ingresa muertos/descartes
        const muertos = parseInt(input.muertos) || 0;
        const descartes = parseInt(input.descartes) || 0;

        currentMuertosAcum += muertos;
        currentDescartesAcum += descartes;
        currentAvesVivas = pollosIniciales - currentMuertosAcum - currentDescartesAcum;

        let predPeso = 0;
        let predIni = 0;
        let predTer = 0;

        if (modelsLoaded && models) {
          // Variables predictoras: ['Semana_prod', 'Muertos_acum', 'Descartes_acum', 'Aves_vivas', 'Peso_anterior', 'Dias']
          const x = [
            w,
            currentMuertosAcum,
            currentDescartesAcum,
            currentAvesVivas,
            currentPeso,
            w * 7
          ];
          predPeso = predictForest(models.peso, x);
          predIni = predictForest(models.iniciador, x);
          predTer = predictForest(models.terminador, x);
        } else {
          // Fallback en caso de que no se hayan cargado los modelos
          predPeso = currentPeso + 300;
          predIni = w < 5 ? 20 : 0;
          predTer = w >= 5 ? 55 : 0;
        }

        // Limpieza de predicciones absurdas
        predPeso = Math.max(0, Math.round(predPeso));
        predIni = Math.max(0, Math.round(predIni * 10) / 10);
        predTer = Math.max(0, Math.round(predTer * 10) / 10);

        currentPeso = predPeso; // Peso anterior para la siguiente semana
        iniciadorAcum += predIni;
        terminadorAcum += predTer;

        results.push({
          semana: w,
          tipo: 'projected',
          peso: predPeso,
          muertos: muertos,
          descartes: descartes,
          muertos_acum: currentMuertosAcum,
          descartes_acum: currentDescartesAcum,
          aves_vivas: currentAvesVivas,
          supervivencia: roundToTwo((currentAvesVivas / pollosIniciales) * 100),
          iniciador: predIni,
          terminador: predTer,
          iniciador_acum: iniciadorAcum,
          terminador_acum: terminadorAcum
        });
      }
    }
    return results;
  }, [semanasInputs, pollosIniciales, models, modelsLoaded]);

  // KPIs del Simulador (Semana 12/Final)
  const finalWeek = simulatedWeeks[11] || {};
  const lastRealWeekIndex = simulatedWeeks.reduce((acc, curr, idx) => curr.tipo === 'real' ? idx : acc, -1);
  const totalIniciador = simulatedWeeks.reduce((acc, c) => acc + c.iniciador, 0);
  const totalTerminador = simulatedWeeks.reduce((acc, c) => acc + c.terminador, 0);

  // --- ESTADO Y LOGICA DE COMPARACION ---
  const [selectedLots, setSelectedLots] = useState(['simulated', '9']);
  const [comparisonMetric, setComparisonMetric] = useState('peso'); // 'peso', 'supervivencia', 'alimento'

  const toggleLotSelection = (lotId) => {
    if (selectedLots.includes(lotId)) {
      setSelectedLots(selectedLots.filter((id) => id !== lotId));
    } else {
      setSelectedLots([...selectedLots, lotId]);
    }
  };

  // Mezclar datos históricos y simulados por semana para el gráfico multilínea
  const comparisonChartData = React.useMemo(() => {
    const data = [];
    for (let w = 1; w <= 13; w++) {
      const row = { semana: w };
      let hasData = false;

      selectedLots.forEach((lotId) => {
        if (lotId === 'simulated') {
          const simW = simulatedWeeks.find((x) => x.semana === w);
          if (simW) {
            hasData = true;
            if (comparisonMetric === 'peso') {
              row['Lote Actual (Simulado)'] = simW.peso;
            } else if (comparisonMetric === 'supervivencia') {
              row['Lote Actual (Simulado)'] = simW.supervivencia;
            } else {
              row['Lote Actual (Simulado)'] = roundToTwo(simW.iniciador_acum + simW.terminador_acum);
            }
          }
        } else {
          const lot = lotesHistoricos[lotId];
          if (lot) {
            const lotW = lot.semanas.find((x) => x.semana === w);
            if (lotW) {
              hasData = true;
              const name = `Lote ${lotId}`;
              if (comparisonMetric === 'peso') {
                row[name] = lotW.peso;
              } else if (comparisonMetric === 'supervivencia') {
                row[name] = lotW.supervivencia;
              } else {
                // Acumulado de bolsas hasta la semana W
                let cumBags = 0;
                for (let i = 1; i <= w; i++) {
                  const histW = lot.semanas.find((x) => x.semana === i);
                  if (histW) cumBags += histW.iniciador + histW.terminador;
                }
                row[name] = roundToTwo(cumBags);
              }
            }
          }
        }
      });

      if (hasData) {
        data.push(row);
      }
    }
    return data;
  }, [selectedLots, comparisonMetric, simulatedWeeks]);

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 overflow-hidden font-sans">
      {/* BARRA LATERAL (Sidebar de Navegación) */}
      <div className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col justify-between shrink-0">
        <div>
          <div className="p-6 border-b border-slate-800">
            <h1 className="text-xl font-bold text-emerald-400 flex items-center gap-2 tracking-wide">
              🐔 RGActiva <span className="text-xs bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded border border-emerald-800/50">IA v2.0</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">Simulación y Proyección de Crecimiento</p>
          </div>

          <nav className="mt-6 px-2 space-y-1">
            <button
              onClick={() => setActiveTab('simulador')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${activeTab === 'simulador' ? 'bg-emerald-950/40 text-emerald-400 border-l-4 border-emerald-500' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'}`}
            >
              <Activity size={18} /> Simulador IA
            </button>
            <button
              onClick={() => setActiveTab('comparador')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${activeTab === 'comparador' ? 'bg-emerald-950/40 text-emerald-400 border-l-4 border-emerald-500' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'}`}
            >
              <GitCompare size={18} /> Comparar Lotes
            </button>
            <button
              onClick={() => setActiveTab('explicacion')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${activeTab === 'explicacion' ? 'bg-emerald-950/40 text-emerald-400 border-l-4 border-emerald-500' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'}`}
            >
              <Info size={18} /> El Modelo Explicado
            </button>
          </nav>
        </div>

        {/* Estatus de Modelos */}
        <div className="p-4 border-t border-slate-800 space-y-3 bg-slate-950/50">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Motor Predictivo:</span>
            {modelsLoaded ? (
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                ● Activo (Cliente)
              </span>
            ) : modelsError ? (
              <span className="text-rose-400 font-semibold flex items-center gap-1 animate-pulse">
                ● Error
              </span>
            ) : (
              <span className="text-amber-400 font-semibold flex items-center gap-1 animate-pulse">
                ● Cargando...
              </span>
            )}
          </div>
          <div className="text-[10px] text-slate-500 text-center font-mono">
            Río Grande, Tierra del Fuego
          </div>
        </div>
      </div>

      {/* CONTENIDO CENTRAL */}
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-900">
        <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-950/30 shrink-0">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2 uppercase tracking-wide">
            {activeTab === 'simulador' && <>📊 Simulador de Crecimiento IA</>}
            {activeTab === 'comparador' && <>📈 Comparativa de Trayectorias de Lotes</>}
            {activeTab === 'explicacion' && <>📖 Entendiendo la Inteligencia Artificial</>}
          </h2>
          <div className="text-sm bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl text-slate-400">
            Lote Simulado: <span className="text-emerald-400 font-bold">{pollosIniciales.toLocaleString('es-AR')} aves</span>
          </div>
        </header>

        {/* ÁREA DESPLAZABLE */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* ================= TABS: SIMULADOR IA ================= */}
          {activeTab === 'simulador' && (
            <div className="space-y-6">
              {/* Tarjetas KPI */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl shadow-lg relative overflow-hidden group hover:border-emerald-500/30 transition-all duration-300">
                  <div className="absolute top-0 right-0 p-3 text-slate-800"><TrendingUp size={48} /></div>
                  <span className="text-xs uppercase font-bold text-slate-400 block tracking-wider">Peso Promedio Final</span>
                  <div className="text-2xl font-black mt-2 text-slate-100">{finalWeek.peso ? finalWeek.peso.toLocaleString('es-AR') : '-'} <span className="text-sm text-slate-500 font-normal">g</span></div>
                  <p className="text-xs text-slate-500 mt-1">Proyectado a la semana 12</p>
                </div>
                
                <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl shadow-lg relative overflow-hidden group hover:border-emerald-500/30 transition-all duration-300">
                  <div className="absolute top-0 right-0 p-3 text-slate-800"><Users size={48} /></div>
                  <span className="text-xs uppercase font-bold text-slate-400 block tracking-wider">Aves Vivas Finales</span>
                  <div className="text-2xl font-black mt-2 text-slate-100">{finalWeek.aves_vivas ? finalWeek.aves_vivas.toLocaleString('es-AR') : '-'} <span className="text-sm text-slate-500 font-normal">un.</span></div>
                  <p className="text-xs text-rose-400/80 mt-1">Bajas totales: {pollosIniciales - (finalWeek.aves_vivas || 0)}</p>
                </div>

                <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl shadow-lg relative overflow-hidden group hover:border-emerald-500/30 transition-all duration-300">
                  <div className="absolute top-0 right-0 p-3 text-slate-800"><Feather size={48} /></div>
                  <span className="text-xs uppercase font-bold text-slate-400 block tracking-wider">Tasa de Supervivencia</span>
                  <div className="text-2xl font-black mt-2 text-emerald-400">{finalWeek.supervivencia ? `${finalWeek.supervivencia}%` : '-'}</div>
                  <p className="text-xs text-slate-500 mt-1">Eficiencia del lote estimada</p>
                </div>

                <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl shadow-lg relative overflow-hidden group hover:border-emerald-500/30 transition-all duration-300">
                  <div className="absolute top-0 right-0 p-3 text-slate-800"><Database size={48} /></div>
                  <span className="text-xs uppercase font-bold text-slate-400 block tracking-wider">Alimento Consumido</span>
                  <div className="text-2xl font-black mt-2 text-slate-100">{roundToTwo(totalIniciador + totalTerminador).toLocaleString('es-AR')} <span className="text-sm text-slate-500 font-normal">bls</span></div>
                  <p className="text-xs text-slate-400 mt-1">
                    Ini: <span className="text-amber-400 font-semibold">{roundToTwo(totalIniciador)}</span> | Ter: <span className="text-purple-400 font-semibold">{roundToTwo(totalTerminador)}</span>
                  </p>
                </div>
              </div>

              {/* PANEL DE ENTRADAS Y CONFIGURACIÓN */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                
                {/* 1. Editor de Semanas (Spreadsheet) */}
                <div className="xl:col-span-2 bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
                    <div>
                      <h3 className="font-bold text-slate-200">Ingreso Semanal de Datos</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Ingresa el peso registrado de una semana para marcarla como 'Real'. La IA proyectará las siguientes automáticamente.</p>
                    </div>
                    <button
                      onClick={handleReset}
                      className="px-3 py-1.5 bg-slate-900 border border-slate-700 hover:bg-slate-800 text-xs font-semibold rounded-lg text-slate-300 transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw size={12} /> Limpiar Todo
                    </button>
                  </div>

                  {/* Panel de Configuración General Rápido */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-800/40 text-sm">
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">Cantidad Inicial de Pollitos</label>
                      <input
                        type="number"
                        min="1"
                        value={pollosIniciales}
                        onChange={(e) => setPollosIniciales(Math.max(1, parseInt(e.target.value) || 0))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 font-mono focus:outline-none focus:border-emerald-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">Cargar Plantilla Histórica</label>
                      <select
                        onChange={(e) => handleLoadTemplate(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-emerald-500 text-sm cursor-pointer"
                        defaultValue="none"
                      >
                        <option value="none">-- Limpio / Simulación Libre --</option>
                        <option value="1">Plantilla Lote 1 (5,200 aves - Histórico)</option>
                        <option value="2">Plantilla Lote 2 (5,195 aves - Histórico)</option>
                        <option value="3">Plantilla Lote 3 (5,200 aves - Histórico)</option>
                        <option value="4">Plantilla Lote 4 (3,200 aves - Histórico)</option>
                        <option value="5">Plantilla Lote 5 (3,003 aves - Histórico)</option>
                        <option value="6">Plantilla Lote 6 (4,171 aves - Histórico)</option>
                        <option value="9">Plantilla Lote 9 (4,200 aves - Histórico)</option>
                      </select>
                    </div>
                  </div>

                  {/* Tabla SpreadSheet */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[600px] text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                          <th className="py-3 px-2">Semana</th>
                          <th className="py-3 px-2">Estado</th>
                          <th className="py-3 px-2">Peso (g)</th>
                          <th className="py-3 px-2">Muertes</th>
                          <th className="py-3 px-2">Descartes</th>
                          <th className="py-3 px-2">Ini. (bolsas)</th>
                          <th className="py-3 px-2">Ter. (bolsas)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {simulatedWeeks.map((week, idx) => {
                          const isReal = week.tipo === 'real';
                          const isFirstProjected = week.tipo === 'projected' && (idx === 0 || simulatedWeeks[idx - 1].tipo === 'real');

                          return (
                            <tr
                              key={week.semana}
                              className={`border-b border-slate-900 hover:bg-slate-900/30 transition-all ${isReal ? 'bg-emerald-950/5' : ''} ${isFirstProjected ? 'border-t-2 border-dashed border-emerald-500/50' : ''}`}
                            >
                              <td className="py-3 px-2 font-mono font-bold text-slate-300 text-sm">
                                #{week.semana}
                              </td>
                              <td className="py-3 px-2">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isReal ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40' : 'bg-blue-950/60 text-blue-400 border border-blue-800/40'}`}>
                                  {isReal ? 'Real' : 'IA Proy.'}
                                </span>
                              </td>
                              <td className="py-2 px-2">
                                <input
                                  type="number"
                                  placeholder={isReal ? "" : String(week.peso)}
                                  value={semanasInputs[idx].peso}
                                  onChange={(e) => handleInputChange(idx, 'peso', e.target.value)}
                                  className={`w-20 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-100 font-mono text-xs focus:outline-none focus:border-emerald-500 ${!isReal ? 'placeholder-slate-500 bg-slate-950/20' : 'font-bold text-emerald-400 border-emerald-800/40'}`}
                                />
                              </td>
                              <td className="py-2 px-2">
                                <input
                                  type="number"
                                  placeholder="0"
                                  value={semanasInputs[idx].muertos}
                                  onChange={(e) => handleInputChange(idx, 'muertos', e.target.value)}
                                  className="w-16 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-100 font-mono text-xs focus:outline-none focus:border-emerald-500"
                                />
                              </td>
                              <td className="py-2 px-2">
                                <input
                                  type="number"
                                  placeholder="0"
                                  value={semanasInputs[idx].descartes}
                                  onChange={(e) => handleInputChange(idx, 'descartes', e.target.value)}
                                  className="w-16 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-100 font-mono text-xs focus:outline-none focus:border-emerald-500"
                                />
                              </td>
                              <td className="py-2 px-2">
                                <input
                                  type="number"
                                  step="0.1"
                                  disabled={!isReal}
                                  placeholder={isReal ? "" : String(week.iniciador)}
                                  value={semanasInputs[idx].iniciador}
                                  onChange={(e) => handleInputChange(idx, 'iniciador', e.target.value)}
                                  className={`w-16 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-100 font-mono text-xs focus:outline-none focus:border-emerald-500 ${!isReal ? 'placeholder-amber-500/80 bg-slate-950/20 cursor-not-allowed border-transparent' : ''}`}
                                />
                              </td>
                              <td className="py-2 px-2">
                                <input
                                  type="number"
                                  step="0.1"
                                  disabled={!isReal}
                                  placeholder={isReal ? "" : String(week.terminador)}
                                  value={semanasInputs[idx].terminador}
                                  onChange={(e) => handleInputChange(idx, 'terminador', e.target.value)}
                                  className={`w-16 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-100 font-mono text-xs focus:outline-none focus:border-emerald-500 ${!isReal ? 'placeholder-purple-500/80 bg-slate-950/20 cursor-not-allowed border-transparent' : ''}`}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 2. Visualización Gráfica Lateral */}
                <div className="space-y-6">
                  {/* Gráfico 1: Peso */}
                  <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-3">
                    <div>
                      <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Evolución de Peso</h4>
                      <p className="text-[10px] text-slate-500">Curva de crecimiento en gramos (Real vs IA)</p>
                    </div>
                    <div className="h-48 text-[10px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={simulatedWeeks}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                          <XAxis dataKey="semana" stroke="#64748b" name="Semana" />
                          <YAxis stroke="#64748b" unit="g" />
                          <Tooltip contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '12px', color: '#f8fafc' }} />
                          <Legend wrapperStyle={{ paddingTop: 5 }} />
                          <Line
                            type="monotone"
                            dataKey="peso"
                            name="Peso Simulado (g)"
                            stroke="#10b981"
                            strokeWidth={3}
                            dot={{ r: 3 }}
                          />
                          {lastRealWeekIndex >= 0 && (
                            <ReferenceLine x={lastRealWeekIndex + 1} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'IA Proyección', fill: '#f59e0b', fontSize: 10, position: 'top' }} />
                          )}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Gráfico 2: Alimento por Semana */}
                  <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-3">
                    <div>
                      <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Consumo Semanal de Alimento</h4>
                      <p className="text-[10px] text-slate-500">Distribución de bolsas de alimento por etapa</p>
                    </div>
                    <div className="h-48 text-[10px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={simulatedWeeks}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                          <XAxis dataKey="semana" stroke="#64748b" />
                          <YAxis stroke="#64748b" unit="bls" />
                          <Tooltip contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '12px', color: '#f8fafc' }} />
                          <Legend wrapperStyle={{ paddingTop: 5 }} />
                          <Bar dataKey="iniciador" name="Iniciador (Bls)" fill="#eab308" stackId="a" />
                          <Bar dataKey="terminador" name="Terminador (Bls)" fill="#a855f7" stackId="a" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= TABS: COMPARADOR DE LOTES ================= */}
          {activeTab === 'comparador' && (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              
              {/* Selector de Lotes (Izquierda) */}
              <div className="bg-slate-950 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-6 lg:col-span-1">
                <div>
                  <h3 className="font-bold text-slate-200">Seleccionar Lotes</h3>
                  <p className="text-xs text-slate-400 mt-1">Marca los lotes que deseas graficar juntos para comparar sus trayectorias.</p>
                </div>
                
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Simulación Activa</div>
                  <button
                    onClick={() => toggleLotSelection('simulated')}
                    className="w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left bg-slate-900 hover:bg-slate-850"
                    style={{ borderColor: selectedLots.includes('simulated') ? LOT_COLORS.simulated : '#1e293b' }}
                  >
                    <span className="text-sm font-semibold flex items-center gap-2 text-slate-200">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: LOT_COLORS.simulated }} />
                      Lote Actual (Simulado)
                    </span>
                    {selectedLots.includes('simulated') ? (
                      <CheckSquare size={16} className="text-emerald-400" />
                    ) : (
                      <Square size={16} className="text-slate-600" />
                    )}
                  </button>

                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider pt-4 mb-2">Lotes Históricos</div>
                  {Object.keys(lotesHistoricos).map((lotId) => {
                    const isSelected = selectedLots.includes(lotId);
                    const color = LOT_COLORS[lotId] || '#64748b';
                    return (
                      <button
                        key={lotId}
                        onClick={() => toggleLotSelection(lotId)}
                        className="w-full flex items-center justify-between p-2.5 rounded-xl border transition-all text-left bg-slate-900/50 hover:bg-slate-900"
                        style={{ borderColor: isSelected ? color : '#1e293b' }}
                      >
                        <span className="text-xs font-semibold flex items-center gap-2 text-slate-350">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                          Lote {lotId} ({lotesHistoricos[lotId].cantidad_inicial.toLocaleString('es-AR')} pollos)
                        </span>
                        {isSelected ? (
                          <CheckSquare size={14} className="text-emerald-400" />
                        ) : (
                          <Square size={14} className="text-slate-700" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Gráfico y Métricas de Comparación (Derecha) */}
              <div className="lg:col-span-3 bg-slate-950 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-6">
                
                {/* Cabecera y Selector de Métrica */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h3 className="font-bold text-slate-200">Curvas Comparativas</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Analiza el comportamiento relativo del lote simulado frente a campañas anteriores.</p>
                  </div>
                  
                  {/* Toggles */}
                  <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
                    <button
                      onClick={() => setComparisonMetric('peso')}
                      className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${comparisonMetric === 'peso' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      Peso Promedio
                    </button>
                    <button
                      onClick={() => setComparisonMetric('supervivencia')}
                      className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${comparisonMetric === 'supervivencia' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      Supervivencia
                    </button>
                    <button
                      onClick={() => setComparisonMetric('alimento')}
                      className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${comparisonMetric === 'alimento' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      Alimento Acumulado
                    </button>
                  </div>
                </div>

                {/* Gráfico Principal */}
                <div className="h-96 text-xs">
                  {selectedLots.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={comparisonChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="semana" stroke="#64748b" name="Semana" />
                        <YAxis
                          stroke="#64748b"
                          unit={comparisonMetric === 'peso' ? 'g' : comparisonMetric === 'supervivencia' ? '%' : ' bls'}
                          domain={comparisonMetric === 'supervivencia' ? [60, 100] : ['auto', 'auto']}
                        />
                        <Tooltip contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '12px', color: '#f8fafc' }} />
                        <Legend wrapperStyle={{ paddingTop: 10 }} />
                        
                        {selectedLots.map((lotId) => {
                          const name = lotId === 'simulated' ? 'Lote Actual (Simulado)' : `Lote ${lotId}`;
                          const color = LOT_COLORS[lotId] || '#64748b';
                          return (
                            <Line
                              key={lotId}
                              type="monotone"
                              dataKey={name}
                              stroke={color}
                              strokeWidth={lotId === 'simulated' ? 3.5 : 1.8}
                              strokeDasharray={lotId === 'simulated' ? '0' : '4 2'}
                              dot={lotId === 'simulated' ? { r: 4, strokeWidth: 1 } : { r: 2 }}
                              activeDot={{ r: lotId === 'simulated' ? 7 : 4 }}
                              connectNulls
                            />
                          );
                        })}
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 italic space-y-2">
                      <GitCompare size={36} />
                      <span>Selecciona al menos un lote a la izquierda para visualizar el gráfico.</span>
                    </div>
                  )}
                </div>

                {/* Leyenda aclaratoria corta */}
                <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-800/60 text-xs text-slate-400 leading-relaxed">
                  <span className="font-bold text-slate-300 block mb-1">Guía Rápida de Análisis:</span>
                  {comparisonMetric === 'peso' && "El gráfico de Peso Promedio muestra el ritmo de engorde semanal en gramos. Un lote que se mantiene arriba de los demás indica un mejor desarrollo productivo y mayor velocidad de engorde."}
                  {comparisonMetric === 'supervivencia' && "La Tasa de Supervivencia refleja qué porcentaje de las aves iniciales permanece con vida. Las caídas bruscas representan mortalidades críticas y te ayudan a identificar semanas históricas de estrés térmico o sanitario."}
                  {comparisonMetric === 'alimento' && "El Alimento Acumulado muestra las bolsas totales de alimento (Iniciador + Terminador) que consume el lote. Sirve para evaluar la conversión alimenticia: cuántas bolsas requiere el lote para ganar determinado peso."}
                </div>

              </div>

            </div>
          )}

          {/* ================= TABS: EL MODELO EXPLICADO ================= */}
          {activeTab === 'explicacion' && (
            <div className="max-w-3xl mx-auto space-y-6">
              
              {/* Bloque principal */}
              <div className="bg-slate-950 border border-slate-800 p-8 rounded-3xl shadow-xl space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-800 pb-5">
                  <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-400">
                    <BookOpen size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-200">¿Cómo estima el futuro nuestra IA?</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Te explicamos de forma sencilla el motor matemático detrás de RGActiva.</p>
                  </div>
                </div>

                <div className="space-y-4 text-sm text-slate-350 leading-relaxed">
                  <p>
                    Para hacer las predicciones semanales de crecimiento de peso y de alimentación, RGActiva utiliza un método de inteligencia artificial llamado <strong className="text-emerald-400">Random Forest</strong> (o Bosques Aleatorios).
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div className="bg-slate-900 border border-slate-800/80 p-4 rounded-xl space-y-2">
                      <h4 className="text-xs uppercase font-bold text-slate-200 tracking-wider">🌲 ¿Qué es un Bosque Aleatorio?</h4>
                      <p className="text-xs">
                        Es un conjunto de cientos de "árboles de decisión" que votan entre sí. Cada árbol analiza los datos haciendo una serie de preguntas simples (ej. "¿Estamos después de la semana 4?", "¿Quedan vivas más de 4000 aves?"). Al final, se promedian los votos de todos los árboles para obtener la estimación final.
                      </p>
                    </div>
                    <div className="bg-slate-900 border border-slate-800/80 p-4 rounded-xl space-y-2">
                      <h4 className="text-xs uppercase font-bold text-slate-200 tracking-wider">📈 ¿De qué se alimenta el modelo?</h4>
                      <p className="text-xs">
                        El modelo aprende de toda la historia productiva del establecimiento (Lotes 1, 2, 3, 4, 5, 6 y 9). Entiende cómo afectó la mortalidad acumulada y el alimento comido al peso promedio final en cada semana del ciclo.
                      </p>
                    </div>
                  </div>

                  <p className="pt-2">
                    Nuestra IA está entrenada con <strong className="text-slate-200">tres modelos diferentes</strong> que trabajan en paralelo cada vez que cambias un dato en la pantalla:
                  </p>

                  <ul className="list-none space-y-3 pl-0 text-xs">
                    <li className="flex gap-2">
                      <ChevronRight size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-slate-200 block">1. Modelo de Peso (g):</strong>
                        Estima cuánto pesarán en promedio tus aves en la próxima semana basándose en la edad actual, el peso previo y cuántas aves quedan vivas.
                      </div>
                    </li>
                    <li className="flex gap-2">
                      <ChevronRight size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-slate-200 block">2. Modelo de Alimento Iniciador (Bolsas):</strong>
                        Calcula cuántas bolsas de alimento tipo 'Iniciador' consumirá el lote en la próxima semana. Este alimento se consume típicamente en la primera fase de desarrollo (semanas 1 a 4).
                      </div>
                    </li>
                    <li className="flex gap-2">
                      <ChevronRight size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-slate-200 block">3. Modelo de Alimento Terminador (Bolsas):</strong>
                        Calcula el consumo de alimento tipo 'Terminador' (de engorde) para la fase de terminación del ciclo (típicamente desde la semana 4 en adelante).
                      </div>
                    </li>
                  </ul>

                  <p className="pt-2 border-t border-slate-800 text-xs text-slate-500 italic">
                    Nota: La precisión de la IA se basa en los registros reales de tus campañas pasadas. A mayor cantidad de lotes reales completados, más preciso y adaptado a las condiciones de tu granja se volverá el modelo.
                  </p>
                </div>
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
}