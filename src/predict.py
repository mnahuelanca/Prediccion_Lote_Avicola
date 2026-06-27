import os
import joblib
import pandas as pd

def generar_proyeccion_semana_siguiente(datos_lote_actual: dict, ruta_modelos: str = "modelos/"):
    """
    Recibe un diccionario con las métricas de la semana actual cerrada
    y devuelve las proyecciones de peso y alimento para la semana entrante.
    """
    # 1. Cargar los modelos previamente guardados
    modelo_peso = joblib.load(os.path.join(ruta_modelos, 'modelo_peso.joblib'))
    modelo_iniciador = joblib.load(os.path.join(ruta_modelos, 'modelo_iniciador.joblib'))
    modelo_terminador = joblib.load(os.path.join(ruta_modelos, 'modelo_terminador.joblib'))
    
    # 2. Estructurar el diccionario de entrada en el DataFrame exacto que espera Sklearn
    semana_proxima = datos_lote_actual['semana_actual'] + 1
    
    df_input = pd.DataFrame([{
        'Semana_prod': semana_proxima,
        'Muertos_acum': datos_lote_actual['muertos_acum'],
        'Descartes_acum': datos_lote_actual['descartes_acum'],
        'Aves_vivas': datos_lote_actual['aves_vivas'],
        'Peso_anterior': datos_lote_actual['peso_actual'], # El peso de hoy es el "anterior" de la semana que viene
        'Dias': semana_proxima * 7
    }])
    
    # 3. Realizar predicciones individuales
    peso_pred = modelo_peso.predict(df_input)[0]
    iniciador_pred = modelo_iniciador.predict(df_input)[0]
    terminador_pred = modelo_terminador.predict(df_input)[0]
    
    return {
        'semana_proyectada': semana_proxima,
        'peso_esperado_gr': round(peso_pred, 2),
        'iniciador_bolsas': round(iniciador_pred, 2),
        'terminador_bolsas': round(terminador_pred, 2)
    }