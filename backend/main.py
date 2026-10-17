
import json
from pathlib import Path
from functools import lru_cache

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from modelo_ridge import (
    entrenar_modelo,
    predecir,
    contribuciones,
    validacion_cruzada
)


# Configuración de la aplicación
app = FastAPI(
    title="AgroCebada API",
    description="Backend para la predicción del rendimiento de cebada",
    version="1.0.0"
)

# Comunicación con el frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5500",
        "http://127.0.0.1:5500"
    ],
    allow_methods=["GET", "POST"],
    allow_headers=["*"]
)


# Ruta del archivo de parcelas
RUTA_DATOS = Path(__file__).resolve().parent / "datos" / "parcelas.json"


# Cargar información de las parcelas
@lru_cache(maxsize=1)
def cargar_parcelas():
    with open(RUTA_DATOS, "r", encoding="utf-8") as archivo:
        return json.load(archivo)


# Entrenar el modelo Ridge una sola vez
@lru_cache(maxsize=1)
def obtener_modelo():
    parcelas = cargar_parcelas()
    return entrenar_modelo(parcelas)


# Ruta principal
@app.get("/")
def inicio():
    return {
        "mensaje": "Bienvenido a la API de AgroCebada",
        "estado": "funcionando"
    }


# Estado del sistema
@app.get("/api/estado")
def consultar_estado():
    return {
        "sistema": "AgroCebada",
        "backend": "activo",
        "modelo_predictivo": "Ridge",
        "modelo_disponible": True
    }


# Consultar todas las parcelas
@app.get("/api/parcelas")
def obtener_parcelas():
    parcelas = cargar_parcelas()

    return {
        "total": len(parcelas),
        "parcelas": parcelas
    }


# Consultar una parcela específica
@app.get("/api/parcelas/{id_parcela}")
def obtener_parcela(id_parcela: str):
    parcelas = cargar_parcelas()

    parcela = next(
        (p for p in parcelas if p["id"] == id_parcela),
        None
    )

    if parcela is None:
        raise HTTPException(
            status_code=404,
            detail="Parcela no encontrada"
        )

    return parcela


# Consultar la predicción de una parcela
@app.get("/api/predicciones/{id_parcela}")
def obtener_prediccion(id_parcela: str):
    parcelas = cargar_parcelas()

    parcela = next(
        (p for p in parcelas if p["id"] == id_parcela),
        None
    )

    if parcela is None:
        raise HTTPException(
            status_code=404,
            detail="Parcela no encontrada"
        )

    # Parcelas utilizadas para el entrenamiento
    if not parcela["p"]:
        return {
            "id": id_parcela,
            "tipo": "entrenamiento",
            "rendimiento_observado": parcela["y"],
            "unidad": "t/ha"
        }

    # Recuperar el modelo entrenado
    modelo = obtener_modelo()

    # Calcular rendimiento y contribuciones
    rendimiento = predecir(modelo, parcela)
    aportes = contribuciones(modelo, parcela)

    return {
        "id": id_parcela,
        "tipo": "prediccion",
        "rendimiento_estimado": round(rendimiento, 4),
        "unidad": "t/ha",
        "modelo": "Ridge",
        "lambda": modelo["lambda"],
        "contribuciones": aportes
    }


@lru_cache(maxsize=1)
def obtener_metricas():
    parcelas = cargar_parcelas()
    return validacion_cruzada(parcelas)


@app.get("/api/modelo/metricas")
def consultar_metricas():
    metricas = obtener_metricas()

    return {
        "modelo": "Ridge",
        "lambda": 3,
        "validacion": "Leave-One-Out",
        "metricas": metricas
    }


class SolicitudPredicciones(BaseModel):
    ids: list[str] = Field(min_length=1, max_length=197)


@app.post("/api/predicciones/lote")
def obtener_predicciones_lote(solicitud: SolicitudPredicciones):
    parcelas = cargar_parcelas()
    modelo = obtener_modelo()

    indice_parcelas = {
        parcela["id"]: parcela
        for parcela in parcelas
    }

    resultados = []

    for id_parcela in dict.fromkeys(solicitud.ids):
        parcela = indice_parcelas.get(id_parcela)

        if parcela is None:
            raise HTTPException(
                status_code=404,
                detail=f"Parcela no encontrada: {id_parcela}"
            )

        if not parcela["p"]:
            raise HTTPException(
                status_code=400,
                detail=f"La parcela {id_parcela} tiene rendimiento conocido"
            )

        rendimiento = predecir(modelo, parcela)
        aportes = contribuciones(modelo, parcela)

        resultados.append({
            "id": id_parcela,
            "tipo": "prediccion",
            "rendimiento_estimado": round(rendimiento, 4),
            "unidad": "t/ha",
            "modelo": "Ridge",
            "lambda": modelo["lambda"],
            "contribuciones": aportes
        })

    return {
        "total": len(resultados),
        "predicciones": resultados
    }


