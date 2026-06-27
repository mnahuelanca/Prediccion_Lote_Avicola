from src.train import entrenar_y_guardar_modelos
from src.predict import generar_proyeccion_semana_siguiente
from src.data_pipeline import cargar_datos, cargar_costos_lotes, preparar_variables_con_costos

def ejecutar_sistema_completo():
    print("==================================================")
    print("🐔   SISTEMA DE GESTIÓN RGACTIVA - INTEGRADO     🐔")
    print("==================================================")
    
    # -------------------------------------------------------------------------
    # PASO 1: Entrenamiento Automatizado con Datos y Costos Reales
    # -------------------------------------------------------------------------
    print("\n[1/3] Entrenando modelos predictivos (Random Forest)...")
    entrenar_y_guardar_modelos("datos/datos.csv", "datos/lotes_costos.csv")
    
    # -------------------------------------------------------------------------
    # PASO 2: Visualización de Métricas de Costos del Lote Activo
    # -------------------------------------------------------------------------
    print("\n[2/3] Generando Dashboard Financiero de Control...")
    
    df_semanal = cargar_datos("datos/datos.csv")
    df_costos = cargar_costos_lotes("datos/lotes_costos.csv")
    df_completo = preparar_variables_con_costos(df_semanal, df_costos)
    
    # Definimos cuál es el lote que estamos analizando actualmente (ejemplo: Lote 8)
    lote_activo = 8
    df_lote = df_completo[df_completo['Lote'] == lote_activo]
    
    if not df_lote.empty:
        # Tomamos la última semana registrada para ver la foto del estado actual
        ultima_semana = df_lote.iloc[-1]
        
        print(f"\n📊 RESUMEN COMPLETO DEL LOTE {lote_activo} (Semana {int(ultima_semana['Semana_prod'])} Cerrada):")
        print(f"  • Aves Vivas en Granja: {int(ultima_semana['Aves_vivas'])} un. (Muertos acum: {int(ultima_semana['Muertos_acum'])})")
        print(f"  • Peso Promedio Actual: {ultima_semana['Peso_gr']} g")
        print(f"  ------------------------------------------------")
        print(f"  • Inversión Inicial (Pollos + Flete ER-EZ): ${ultima_semana['Costo_Inicial_Total']:,.2f}")
        print(f"  • Gasto Acumulado Alimento (+ Flete BSAS-RGA): ${ultima_semana['Costo_Alimento_Acum']:,.2f}")
        print(f"  • INVERSIÓN TOTAL ACUMULADA: ${ultima_semana['Costo_Total_Acumulado']:,.2f}")
        print(f"  • COSTO ACTUAL POR AVE VIVA: ${ultima_semana['Costo_Por_Ave_Viva']:,.2f}")
    else:
        print(f"\n⚠️ Alerta: No se encontraron registros para el Lote {lote_activo} en datos.csv")
        # En caso de no tener semanas en datos.csv, usamos valores por defecto para la prueba predictiva
        ultima_semana = {
            'Semana_prod': 4, 'Muertos_acum': 121, 'Descartes_acum': 37, 'Aves_vivas': 4070, 'Peso_gr': 1066
        }

    # -------------------------------------------------------------------------
    # PASO 3: Proyección Predictiva para la Próxima Semana
    # -------------------------------------------------------------------------
    print("\n[3/3] Calculando proyecciones para la semana entrante...")
    
    # Estructuramos el estado actual usando las variables calculadas dinámicamente arriba
    estado_lote_actual = {
        'semana_actual': int(ultima_semana['Semana_prod']),
        'muertos_acum': int(ultima_semana['Muertos_acum']),
        'descartes_acum': int(ultima_semana['Descartes_acum']),
        'aves_vivas': int(ultima_semana['Aves_vivas']),
        'peso_actual': ultima_semana['Peso_gr']
    }
    
    proyeccion = generar_proyeccion_semana_siguiente(estado_lote_actual)
    
    print("\n🔮 PROYECCIÓN EXTRACTADA PARA LA SEMANA ENTRANTE:")
    print(f"➡️ Datos estimados para la Semana {proyeccion['semana_proyectada']}:")
    print(f"  - Peso esperado: {proyeccion['peso_esperado_gr']} g")
    print(f"  - Alimento Iniciador estimado: {proyeccion['iniciador_bolsas']} bolsas")
    print(f"  - Alimento Terminador estimado: {proyeccion['terminador_bolsas']} bolsas")
    print("==================================================")

if __name__ == "__main__":
    ejecutar_sistema_completo()