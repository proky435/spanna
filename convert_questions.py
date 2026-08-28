import pandas as pd
import json

def convert_excel_to_json(input_excel_path, output_json_path):
    sheets_info = [
        {'name': 'I. vizsgatárgy_gyakorló', 'default_subject': 'I. Vizsgatárgy: Pénzügyi és biztosítási piac szereplői'},
        {'name': 'II. Vizsgatárgy_gyakorló', 'default_subject': 'II. Vizsgatárgy: Biztosításszakmai alapfogalmak'},
        {'name': 'III. Vizsgatágy_gyakorló', 'default_subject': 'III. Vizsgatárgy: Biztosítási szerződések'}
    ]
    
    all_questions = []
    
    for sheet in sheets_info:
        df = pd.read_excel(input_excel_path, sheet_name=sheet['name'])
        
        # Összevont cellák lefelé másolása (forward fill)
        if 'Vizsgatárgy' in df.columns:
            df['Vizsgatárgy'] = df['Vizsgatárgy'].ffill().fillna(sheet['default_subject'])
        else:
            df['Vizsgatárgy'] = sheet['default_subject']
            
        if 'Témakör' in df.columns:
            df['Témakör'] = df['Témakör'].ffill().fillna('Általános')
        else:
            df['Témakör'] = 'Általános'
            
        # Válaszlehetőségek oszlopainak kigyűjtése
        option_cols = [c for c in df.columns if c.startswith('Válasz ') and '(' in c]
        
        # A helyes válasz sorszáma az utolsó oszlopban található (1-alapú index)
        correct_col = df.columns[-1]
        
        for idx, row in df.iterrows():
            question_text = str(row['Kérdések']).strip()
            if not question_text or question_text == 'nan':
                continue
                
            options = []
            for opt_col in option_cols:
                val = row[opt_col]
                if pd.notna(val) and str(val).strip() != '' and str(val).strip() != 'nan':
                    options.append(str(val).strip())
                    
            try:
                correct_val = int(row[correct_col])
                correct_idx = correct_val - 1  # 0-alapú index a JS frontendhez (0 = A, 1 = B, ...)
            except (ValueError, TypeError):
                correct_idx = None
                
            prefix = sheet['name'].split('.')[0].strip()
            q_sorszam = int(row['Sorsz.']) if pd.notna(row['Sorsz.']) else idx + 1
            q_id = f"{prefix}_{q_sorszam}"
            
            all_questions.append({
                'id': q_id,
                'subject': str(row['Vizsgatárgy']).strip(),
                'topic': str(row['Témakör']).strip(),
                'question': question_text,
                'options': options,
                'correctIndex': correct_idx
            })
            
    with open(output_json_path, 'w', encoding='utf-8') as out_f:
        json.dump(all_questions, out_f, ensure_ascii=False, indent=2)
        
    print(f"Sikeres konvertálás! Összesen {len(all_questions)} kérdés kimentve ide: {output_json_path}")

if __name__ == '__main__':
    excel_file = 'teszt.xlsx'
    output_file = 'questions.json'
    convert_excel_to_json(excel_file, output_file)