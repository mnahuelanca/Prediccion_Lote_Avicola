import pandas as pd
import numpy as np

def cargar_datos(csv_path: str) -> pd.DataFrame:
    """Carga el archivo CSV de datos avícolas semanales."""
    return pd.read_csv(csv_path)

def cargar_costos_lotes(path: str = "datos/lotes_costos.csv") -> pd.DataFrame:
    """Carga el desglose de costos reales de fletes y precios unitarios."""
    return pd.read_csv(path)

def preparar_variables_con_costos(df_semanal: pd.DataFrame, df_costos: pd.DataFrame) -> pd.DataFrame:
    """
    Une el progreso semanal con la estructura de costos reales de fletes y precios unitarios.
    Calcula acumulados, rezagos (lags) y variables financieras.
    """
    # 1. Ordenar y calcular la parte productiva básica
    df = df_semanal.sort_values(['Lote', 'Semana_prod']).copy()
    df['Muertos_acum'] = df.groupby('Lote')['Muertos'].cumsum()
    df['Descartes_acum'] = df.groupby('Lote')['Descartes'].cumsum()
    
    # 2. Cruzar con la tabla de costos usando la columna común 'Lote'
    df = pd.merge(df, df_costos, on='Lote', how='left')
    
    # 3. Calcular aves vivas usando la cantidad inicial real de cada lote ('Pollos')
    df['Aves_vivas'] = df['Pollos'] - df['Muertos_acum'] - df['Descartes_acum']
    df['Dias'] = df['Semana_prod'] * 7
    
    # 4. Rezagos (Lags) para el modelo predictivo
    df['Peso_anterior'] = df.groupby('Lote')['Peso_gr'].shift(1)
    
    # 5. CÁLCULOS FINANCIEROS REALES (Basados en tu estructura de traslados)
    # Costo inicial de los pollitos puestos en origen + flete aéreo/terrestre ER-EZ
    df['Costo_Inicial_Total'] = df['Precio_Pollos'] + df['Traslado_Pollos_ER_EZ']
    
    # Consumo acumulado de alimento semana a semana
    df['Iniciador_acum'] = df.groupby('Lote')['Iniciador_bolsas'].cumsum()
    df['Terminador_acum'] = df.groupby('Lote')['Terminador_bolsas'].cumsum()
    
    # Costo real del alimento incluyendo su precio unitario + el traslado proporcional BSAS-RGA por bolsa
    df['Costo_Alimento_Acum'] = (
        (df['Iniciador_acum'] * (df['Unitario_Iniciador'] + df['Traslado_Alim'])) +
        (df['Terminador_acum'] * (df['Unitario_Terminador'] + df['Traslado_Alim']))
    )
    
    # Gasto acumulado total invertido en el lote hasta la fecha
    df['Costo_Total_Acumulado'] = df['Costo_Inicial_Total'] + df['Costo_Alimento_Acum']
    
    # Costo de producción por ave viva en granja en la semana actual
    df['Costo_Por_Ave_Viva'] = df['Costo_Total_Acumulado'] / df['Aves_vivas']
    
    return df

def filtrar_para_entrenamiento(df: pd.DataFrame) -> pd.DataFrame:
    """Elimina las filas de la primera semana que no tienen registro anterior (nulos)."""
    return df.dropna(subset=['Peso_anterior']).copy()