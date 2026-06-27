import os
import joblib
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score
# Importamos la función correcta con costos integrada:
from src.data_pipeline import cargar_datos, cargar_costos_lotes, preparar_variables_con_costos, filtrar_para_entrenamiento

def entrenar_y_guardar_modelos(csv_datos: str, csv_costos: str, ruta_salida_modelos: str = "modelos/"):
    # 1. Carga y procesamiento a través del pipeline de costos
    df_raw = cargar_datos(csv_datos)
    df_cos = cargar_costos_lotes(csv_costos)
    df_procesado = preparar_variables_con_costos(df_raw, df_cos)
    df_modelo = filtrar_para_entrenamiento(df_procesado)
    
    # Asegurar que el directorio de salida existe
    os.makedirs(ruta_salida_modelos, exist_ok=True)
    
    # 2. Definir variables predictoras (Features)
    features = ['Semana_prod', 'Muertos_acum', 'Descartes_acum', 'Aves_vivas', 'Peso_anterior', 'Dias']
    X = df_modelo[features]
    
    # --- Modelo 1: Predicción de Peso ---
    y_peso = df_modelo['Peso_gr']
    rf_peso = RandomForestRegressor(n_estimators=100, random_state=42)
    rf_peso.fit(X, y_peso)
    joblib.dump(rf_peso, os.path.join(ruta_salida_modelos, 'modelo_peso.joblib'))
    
    # --- Modelo 2: Predicción de Alimento Iniciador ---
    y_iniciador = df_modelo['Iniciador_bolsas']
    rf_iniciador = RandomForestRegressor(n_estimators=100, random_state=42)
    rf_iniciador.fit(X, y_iniciador)
    joblib.dump(rf_iniciador, os.path.join(ruta_salida_modelos, 'modelo_iniciador.joblib'))
    
    # --- Modelo 3: Predicción de Alimento Terminador ---
    y_terminador = df_modelo['Terminador_bolsas']
    rf_terminador = RandomForestRegressor(n_estimators=100, random_state=42)
    rf_terminador.fit(X, y_terminador)
    joblib.dump(rf_terminador, os.path.join(ruta_salida_modelos, 'modelo_terminador.joblib'))
    
    # Métricas de validación en consola para el Peso
    pred_peso = rf_peso.predict(X)
    print("✅ Modelos entrenados con éxito.")
    print(f"Métricas del Modelo de Peso -> MAE: {mean_absolute_error(y_peso, pred_peso):.2f}g | R²: {r2_score(y_peso, pred_peso):.3f}")

if __name__ == "__main__":
    # Permite ejecutar este script por separado si se desea reentrenar a mano
    entrenar_y_guardar_modelos("datos/datos.csv", "datos/lotes_costos.csv")