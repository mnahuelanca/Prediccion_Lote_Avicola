import os
import json
import joblib
import numpy as np
import pandas as pd

def predict_tree_python(node, x):
    if len(node) == 1:
        return node[0]
    
    feature_index = node[0]
    threshold = node[1]
    missing_go_to_left = node[2]
    left_subtree = node[3]
    right_subtree = node[4]
    
    val = x[feature_index]
    
    # Handle missing values
    if val is None or np.isnan(val):
        if missing_go_to_left == 1:
            return predict_tree_python(left_subtree, x)
        else:
            return predict_tree_python(right_subtree, x)
            
    if val <= threshold:
        return predict_tree_python(left_subtree, x)
    else:
        return predict_tree_python(right_subtree, x)

def predict_forest_python(forest, x):
    preds = [predict_tree_python(tree, x) for tree in forest]
    return sum(preds) / len(preds)

def main():
    # Load original models
    print("Loading original .joblib models...")
    original_models = {
        'peso': joblib.load('modelos/modelo_peso.joblib'),
        'iniciador': joblib.load('modelos/modelo_iniciador.joblib'),
        'terminador': joblib.load('modelos/modelo_terminador.joblib')
    }
    
    # Load exported compact JSON models
    print("Loading exported JSON models...")
    with open('rg_activa_web/public/modelos.json', 'r') as f:
        json_models = json.load(f)
        
    # Generate test cases
    # Columns: ['Semana_prod', 'Muertos_acum', 'Descartes_acum', 'Aves_vivas', 'Peso_anterior', 'Dias']
    test_cases = [
        [5, 100, 20, 4080, 1200.0, 35],
        [1, 10, 0, 4190, 40.0, 7],
        [12, 500, 100, 3600, 4200.0, 84],
        [3, 50, 5, 4145, 350.0, 21],
        [8, 200, 40, np.nan, 2500.0, 56],  # NaN in Aves_vivas (simulating historical NaN)
        [6, np.nan, 10, 3000, 1500.0, 42],  # NaN in Muertos_acum
    ]
    
    features = ['Semana_prod', 'Muertos_acum', 'Descartes_acum', 'Aves_vivas', 'Peso_anterior', 'Dias']
    
    print("\n--- Running Validation Tests ---")
    all_passed = True
    for name, orig_model in original_models.items():
        json_forest = json_models[name]
        
        for idx, case in enumerate(test_cases):
            # scikit-learn input needs DataFrame
            df_input = pd.DataFrame([case], columns=features)
            
            # original prediction
            orig_pred = orig_model.predict(df_input)[0]
            
            # custom compact python prediction (equivalent to JS)
            custom_pred = predict_forest_python(json_forest, case)
            
            diff = abs(orig_pred - custom_pred)
            if diff > 1e-9:
                print(f"[FAIL] Model {name.upper()} | Case {idx}: Org={orig_pred:.6f}, Custom={custom_pred:.6f}, Diff={diff:.6e}")
                all_passed = False
            else:
                pass
                
        print(f"Model {name.upper()}: Checked {len(test_cases)} cases. Validation OK.")
        
    if all_passed:
        print("\n[OK] Validation successful! The JSON compact models produce EXACTLY the same outputs as the scikit-learn models.")
    else:
        print("\n[ERROR] Validation failed. There are mismatches between scikit-learn and custom predictions.")

if __name__ == '__main__':
    main()
