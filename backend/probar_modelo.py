
import json
from pathlib import Path

from modelo_ridge import entrenar_modelo, predecir


ruta = Path(__file__).resolve().parent / "datos" / "parcelas.json"

with open(ruta, "r", encoding="utf-8") as archivo:
    parcelas = json.load(archivo)


modelo = entrenar_modelo(parcelas)

conocidas = [p for p in parcelas if not p["p"]]
pendientes = [p for p in parcelas if p["p"]]

print("MODELO RIDGE - AGROCEBADA")
print("----------------------------")
print("Parcelas totales:", len(parcelas))
print("Parcelas conocidas:", len(conocidas))
print("Parcelas por predecir:", len(pendientes))
print("Lambda:", modelo["lambda"])

print("\nPRIMERAS PREDICCIONES")

for parcela in pendientes[:5]:
    rendimiento = predecir(modelo, parcela)

    print(
        f"{parcela['id']}: "
        f"{rendimiento:.4f} t/ha"
    )
