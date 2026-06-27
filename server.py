import os
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# 1. Importamos las funciones de tus módulos propios
from src.train import entrenar_y_guardar_modelos
from src.predict import generar_proyeccion_semana_siguiente
from src.data_pipeline import cargar_datos, cargar_costos_lotes, preparar_variables_con_costos

# 2. Inicializamos la aplicación de FastAPI (Esto evita el NameError)
app = FastAPI(title="API de Gestión y Predicción RGActiva")

# 3. Configuración de CORS para conectarse con React (localhost:5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Estructura de datos para el formulario de carga de semanas
class RegistroSemana(BaseModel):
    lote: int
    semana_prod: int
    peso_gr: float
    muertos: int
    descartes: int
    iniciador_bolsas: float
    terminador_bolsas: float

# -------------------------------------------------------------------------
# ENDPOINT 1: DASHBOARD DETALLADO CON COSTOS COMPLETOS (Actualizado)
# -------------------------------------------------------------------------
@app.get("/api/lote/{id_lote}/dashboard")
def obtener_dashboard_lote(id_lote: int):
    """Devuelve las métricas productivas, financieras y el desglose exacto del CSV de costos."""
    df_semanal = cargar_datos("datos/datos.csv")
    df_costos = cargar_costos_lotes("datos/lotes_costos.csv")
    
    # Buscar los costos fijos de este lote en el CSV
    df_cos_individual = df_costos[df_costos['Lote'] == id_lote]
    if df_cos_individual.empty:
        raise HTTPException(status_code=404, detail="Lote no encontrado en la estructura de costos.")
    
    lote_costos_base = df_cos_individual.iloc[0].to_dict()
    df_completo = preparar_variables_con_costos(df_semanal, df_costos)
    df_lote = df_completo[df_completo['Lote'] == id_lote]
    
    # Estructura de respuesta base con los datos tal cual del CSV de costos
    respuesta = {
        "lote": id_lote,
        "anio": int(lote_costos_base['Anio']),
        "mes": lote_costos_base['Mes'],
        "aves_iniciales": int(lote_costos_base['Pollos']),
        "datos_origen_csv": {
            "unitario_pollo": float(lote_costos_base['Unitario_Pollo']),
            "precio_pollos_total": float(lote_costos_base['Precio_Pollos']),
            "traslado_pollos_er_ez": float(lote_costos_base['Traslado_Pollos_ER_EZ']),
            "traslado_alim_bolsa": float(lote_costos_base['Traslado_Alim']),
            "unitario_iniciador": float(lote_costos_base['Unitario_Iniciador']),
            "unitario_terminador": float(lote_costos_base['Unitario_Terminador']),
            "total_alimento_presupuesto": float(lote_costos_base['Total_Alimento']),
            "precio_total_lote_csv": float(lote_costos_base['Precio_Total'])
        }
    }

    if df_lote.empty:
        # Lote nuevo sin semanas (Semana 0)
        respuesta.update({
            "semana_actual": 0,
            "aves_vivas": int(lote_costos_base['Pollos']),
            "peso_actual": 0.0,
            "muertos_acum": 0,
            "costo_inicial_total": float(lote_costos_base['Precio_Pollos'] + lote_costos_base['Traslado_Pollos_ER_EZ']),
            "costo_alimento_acum": 0.0,
            "costo_total_acumulado": float(lote_costos_base['Precio_Pollos'] + lote_costos_base['Traslado_Pollos_ER_EZ']),
            "costo_por_ave_viva": float((lote_costos_base['Precio_Pollos'] + lote_costos_base['Traslado_Pollos_ER_EZ']) / lote_costos_base['Pollos']),
            "historico_semanas": []
        })
    else:
        # Lote en producción (Con semanas transcurridas)
        ultima_semana = df_lote.iloc[-1]
        respuesta.update({
            "semana_actual": int(ultima_semana['Semana_prod']),
            "aves_vivas": int(ultima_semana['Aves_vivas']),
            "peso_actual": float(ultima_semana['Peso_gr']),
            "muertos_acum": int(ultima_semana['Muertos_acum']),
            "costo_inicial_total": float(ultima_semana['Costo_Inicial_Total']),
            "costo_alimento_acum": float(ultima_semana['Costo_Alimento_Acum']),
            "costo_total_acumulado": float(ultima_semana['Costo_Total_Acumulado']),
            "costo_por_ave_viva": float(ultima_semana['Costo_Por_Ave_Viva']),
            "historico_semanas": df_lote[[
                'Semana_prod', 'Peso_gr', 'Aves_vivas', 'Costo_Total_Acumulado', 
                'Costo_Por_Ave_Viva', 'Muertos', 'Descartes', 'Iniciador_bolsas', 'Terminador_bolsas'
                                            ]].to_dict(orient="records")
        })
    
    return respuesta

# -------------------------------------------------------------------------
# ENDPOINT 2: PROYECCIONES INTELIGENTES CON CONTROL DE ERRORES HISTÓRICOS
# -------------------------------------------------------------------------
@app.get("/api/lote/{id_lote}/proyeccion")
def obtener_proyeccion(id_lote: int):
    """Calcula la proyección futura y evalúa el calce y error de las semanas previas."""
    import joblib
    
    df_semanal = cargar_datos("datos/datos.csv")
    df_costos = cargar_costos_lotes("datos/lotes_costos.csv")
    df_completo = preparar_variables_con_costos(df_semanal, df_costos)
    
    df_lote = df_completo[df_completo['Lote'] == id_lote]
    
    # Cargar los modelos guardados para evaluar el comportamiento histórico
    try:
        modelo_peso = joblib.load('modelos/modelo_peso.joblib')
    except:
        raise HTTPException(status_code=500, detail="Los modelos .joblib no están entrenados. Ejecuta main.py primero.")
        
    grafico_data = []
    
    # 1. PASADO: Calcular el calce del modelo y sus errores en las semanas que ya pasaron
    if not df_lote.empty:
        # Filtramos filas válidas para el modelo (que tengan peso de la semana anterior)
        df_eval = df_lote.dropna(subset=['Peso_anterior']).copy()
        if not df_eval.empty:
            features = ['Semana_prod', 'Muertos_acum', 'Descartes_acum', 'Aves_vivas', 'Peso_anterior', 'Dias']
            X_eval = df_eval[features]
            
            # Forzamos al modelo a predecir el pasado para ver cuánto le erró
            preds_peso_pasado = modelo_peso.predict(X_eval)
            df_eval['Peso_Predicho'] = preds_peso_pasado
            df_eval['Error_Absoluto_Gr'] = (df_eval['Peso_gr'] - df_eval['Peso_Predicho']).abs()
            
            for _, row in df_eval.iterrows():
                grafico_data.append({
                    "semana": int(row['Semana_prod']),
                    "peso_real": float(row['Peso_gr']),
                    "peso_predicho": round(float(row['Peso_Predicho']), 2),
                    "error_gramos": round(float(row['Error_Absoluto_Gr']), 2)
                })

    # 2. FUTURO: Calcular la proyección de la semana entrante
    if df_lote.empty:
        df_cos_individual = df_costos[df_costos['Lote'] == id_lote]
        if df_cos_individual.empty:
            raise HTTPException(status_code=404, detail="Lote no encontrado.")
        lote_base = df_cos_individual.iloc[0]
        estado_actual = {
            'semana_actual': 0, 'muertos_acum': 0, 'descartes_acum': 0,
            'aves_vivas': int(lote_base['Pollos']), 'peso_actual': 40.0
        }
    else:
        ultima_semana = df_lote.iloc[-1]
        estado_actual = {
            'semana_actual': int(ultima_semana['Semana_prod']),
            'muertos_acum': int(ultima_semana['Muertos_acum']),
            'descartes_acum': int(ultima_semana['Descartes_acum']),
            'aves_vivas': int(ultima_semana['Aves_vivas']),
            'peso_actual': float(ultima_semana['Peso_gr'])
        }
    
    proyeccion = generar_proyeccion_semana_siguiente(estado_actual)
    
    # Acoplamos el punto futuro al array de gráficos (peso_real queda en None porque no pasó)
    grafico_data.append({
        "semana": int(proyeccion['semana_proyectada']),
        "peso_real": None,
        "peso_predicho": float(proyeccion['peso_esperado_gr']),
        "error_gramos": None
    })
    
    return {
        "semana_proyectada": proyeccion['semana_proyectada'],
        "peso_esperado_gr": proyeccion['peso_esperado_gr'],
        "iniciador_bolsas": proyeccion['iniciador_bolsas'],
        "terminador_bolsas": proyeccion['terminador_bolsas'],
        "grafico_proyecciones": grafico_data
    }
# -------------------------------------------------------------------------
# ENDPOINT 3: REGISTRO DE NUEVA SEMANA (Formulario Web)
# -------------------------------------------------------------------------
@app.post("/api/lote/cargar-semana")
def guardar_nueva_semana(registro: RegistroSemana):
    """Añade una fila a datos.csv y dispara el reentrenamiento automático."""
    path_csv = "datos/datos.csv"
    df_semanal = pd.read_csv(path_csv)
    
    duplicado = df_semanal[(df_semanal['Lote'] == registro.lote) & (df_semanal['Semana_prod'] == registro.semana_prod)]
    if not duplicado.empty:
        raise HTTPException(status_code=400, detail=f"La semana {registro.semana_prod} para el Lote {registro.lote} ya está registrada.")
    
    nueva_fila = pd.DataFrame([{
        "Lote": registro.lote,
        "Semana_prod": registro.semana_prod,
        "Peso_gr": registro.peso_gr,
        "Muertos": registro.muertos,
        "Descartes": registro.descartes,
        "Iniciador_bolsas": registro.iniciador_bolsas,
        "Terminador_bolsas": registro.terminador_bolsas
    }])
    
    df_actualizado = pd.concat([df_semanal, nueva_fila], ignore_index=True)
    df_actualizado.to_csv(path_csv, index=False)
    
    # Reentrenar automáticamente con los nuevos datos
    entrenar_y_guardar_modelos("datos/datos.csv", "datos/lotes_costos.csv")
    
    return {"status": "success", "message": f"Semana {registro.semana_prod} guardada y modelos actualizados."}