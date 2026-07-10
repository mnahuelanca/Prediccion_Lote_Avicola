import os
import json
import joblib
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score

# 1. Definición de cantidades iniciales de pollos para corregir el bug de NaNs
# Estos valores provienen del archivo 'ComparacionLotes.xlsx' (hoja 'Compar.', fila Cantidad inicial)
LOTE_INIT_POLLOS = {
    1: 5200,
    2: 5195,
    3: 5200,
    4: 3200,
    5: 3003,
    6: 4171,
    8: 4200,  # según lotes_costos.csv
    9: 4200   # según lotes_costos.csv
}

def preparar_datos_limpios(datos_csv_path, costos_csv_path):
    df_semanal = pd.read_csv(datos_csv_path)
    df_costos = pd.read_csv(costos_csv_path)
    
    df = df_semanal.sort_values(['Lote', 'Semana_prod']).copy()
    
    # Calcular acumulados de bajas
    df['Muertos_acum'] = df.groupby('Lote')['Muertos'].cumsum()
    df['Descartes_acum'] = df.groupby('Lote')['Descartes'].cumsum()
    
    # Cruzar con costos
    df = pd.merge(df, df_costos, on='Lote', how='left')
    
    # CORRECCIÓN DE BUG: Rellenar la cantidad de Pollos iniciales usando el mapeo corregido
    df['Pollos'] = df['Pollos'].fillna(df['Lote'].map(LOTE_INIT_POLLOS))
    
    # Calcular aves vivas y días
    df['Aves_vivas'] = df['Pollos'] - df['Muertos_acum'] - df['Descartes_acum']
    df['Dias'] = df['Semana_prod'] * 7
    
    # Peso de la semana anterior
    df['Peso_anterior'] = df.groupby('Lote')['Peso_gr'].shift(1)
    
    return df

def entrenar_y_actualizar(df_procesado, ruta_modelos="modelos/"):
    # Filtrar para entrenamiento (eliminar filas donde no hay Peso_anterior, es decir, semana 1)
    df_modelo = df_procesado.dropna(subset=['Peso_anterior']).copy()
    
    features = ['Semana_prod', 'Muertos_acum', 'Descartes_acum', 'Aves_vivas', 'Peso_anterior', 'Dias']
    X = df_modelo[features]
    
    # Asegurar directorio
    os.makedirs(ruta_modelos, exist_ok=True)
    
    modelos = {}
    targets = {
        'peso': 'Peso_gr',
        'iniciador': 'Iniciador_bolsas',
        'terminador': 'Terminador_bolsas'
    }
    
    print("\n--- Entrenamiento de Modelos con Datos Corregidos ---")
    for name, target in targets.items():
        y = df_modelo[target]
        model = RandomForestRegressor(n_estimators=100, random_state=42)
        model.fit(X, y)
        
        # Guardar en local (.joblib)
        joblib.dump(model, os.path.join(ruta_modelos, f"modelo_{name}.joblib"))
        
        # Evaluar
        preds = model.predict(X)
        mae = mean_absolute_error(y, preds)
        r2 = r2_score(y, preds)
        print(f"Modelo [{name.upper()}] -> MAE: {mae:.4f} | R2: {r2:.4f}")
        
        modelos[name] = model
        
    return modelos

def export_tree_compact(tree, node_id=0):
    # children_left[i] == -1 significa que el nodo i es una hoja
    if tree.children_left[node_id] == -1:
        # Devolver una lista con el valor predicho de la hoja
        return [float(tree.value[node_id][0][0])]
    else:
        return [
            int(tree.feature[node_id]),
            float(tree.threshold[node_id]),
            int(tree.missing_go_to_left[node_id]),
            export_tree_compact(tree, tree.children_left[node_id]),
            export_tree_compact(tree, tree.children_right[node_id])
        ]

def export_forest_compact(forest):
    return [export_tree_compact(est.tree_) for est in forest.estimators_]

def main():
    datos_csv = "datos/datos.csv"
    costos_csv = "datos/lotes_costos.csv"
    
    # 1. Procesar datos
    df_procesado = preparar_datos_limpios(datos_csv, costos_csv)
    
    # 2. Entrenar y actualizar archivos .joblib locales
    modelos = entrenar_y_actualizar(df_procesado)
    
    # 3. Exportar modelos a JSON compacto
    modelos_json = {}
    for name, model in modelos.items():
        modelos_json[name] = export_forest_compact(model)
        
    # Guardar en la carpeta pública del frontend
    frontend_public_dir = "rg_activa_web/public"
    os.makedirs(frontend_public_dir, exist_ok=True)
    
    json_path = os.path.join(frontend_public_dir, "modelos.json")
    with open(json_path, 'w') as f:
        json.dump(modelos_json, f, separators=(',', ':'))
        
    print(f"\n[OK] Modelos exportados con exito a JSON en: {json_path}")
    print(f"Tamano del archivo JSON: {os.path.getsize(json_path) / 1024:.2f} KB")
    
    # 4. Exportar datos históricos de los lotes para el comparador en React
    # Queremos agrupar por Lote y extraer las series de tiempo semanales
    lotes_dict = {}
    for lote_id in sorted(df_procesado['Lote'].unique()):
        df_lote = df_procesado[df_procesado['Lote'] == lote_id].sort_values('Semana_prod')
        
        # Calcular la tasa de supervivencia
        init_pollos = LOTE_INIT_POLLOS.get(int(lote_id), 4200)
        
        semanas = []
        for _, row in df_lote.iterrows():
            semana_num = int(row['Semana_prod'])
            muertos = int(row['Muertos'])
            descartes = int(row['Descartes'])
            muertos_acum = int(row['Muertos_acum'])
            descartes_acum = int(row['Descartes_acum'])
            aves_vivas = int(row['Aves_vivas'])
            
            # Tasa de supervivencia
            supervivencia_pct = round((aves_vivas / init_pollos) * 100, 2)
            
            semanas.append({
                "semana": semana_num,
                "peso": float(row['Peso_gr']),
                "muertos": muertos,
                "descartes": descartes,
                "muertos_acum": muertos_acum,
                "descartes_acum": descartes_acum,
                "aves_vivas": aves_vivas,
                "supervivencia": supervivencia_pct,
                "iniciador": float(row['Iniciador_bolsas']),
                "terminador": float(row['Terminador_bolsas'])
            })
            
        lotes_dict[str(lote_id)] = {
            "lote_id": int(lote_id),
            "cantidad_inicial": init_pollos,
            "semanas": semanas
        }
        
    # Guardar en src/data/lotes_data.js
    frontend_data_dir = "rg_activa_web/src/data"
    os.makedirs(frontend_data_dir, exist_ok=True)
    js_path = os.path.join(frontend_data_dir, "lotes_data.js")
    
    with open(js_path, 'w', encoding='utf-8') as f:
        f.write("// Datos históricos de lotes avícolas generados automáticamente\n")
        f.write("export const lotesHistoricos = ")
        json.dump(lotes_dict, f, ensure_ascii=False, indent=2)
        f.write(";\n")
        
    print(f"[OK] Datos historicos de lotes exportados con exito a JS en: {js_path}")

if __name__ == "__main__":
    main()
