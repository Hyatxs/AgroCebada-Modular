
import numpy as np


CARACTERISTICAS = [
    ("ndvi_ini", "NDVI inicial", "n", 15, 25),
    ("evi_ini", "EVI inicial", "e", 15, 25),
    ("lai_ini", "LAI inicial", "l", 15, 25),
    ("fapar_ini", "FAPAR inicial", "f", 18, 26),
    ("ndvi_pico", "NDVI en el pico", "n", 31, 41),
    ("ndvi_fin", "NDVI final", "n", 42, 52),
    ("dswi_fin", "DSWI final", "d", 44, 52),
]

LAMBDA = 3


def vector_de(parcela):
    valores = []

    for clave, nombre, fuente, desde, hasta in CARACTERISTICAS:
        serie = parcela[fuente]
        ventana = serie[desde - 1:hasta]

        valor = sum(ventana) / len(ventana) / 1000
        valores.append(valor)

    return np.array(valores, dtype=float)


def entrenar_modelo(parcelas):
    conocidas = [
        parcela for parcela in parcelas
        if not parcela["p"]
    ]

    X = np.array([vector_de(p) for p in conocidas])
    y = np.array([p["y"] for p in conocidas], dtype=float)

    medias = X.mean(axis=0)
    desvios = X.std(axis=0)
    desvios[desvios == 0] = 1

    Z = (X - medias) / desvios
    media_y = y.mean()

    matriz = Z.T @ Z + LAMBDA * np.eye(X.shape[1])
    objetivo = Z.T @ (y - media_y)

    coeficientes = np.linalg.solve(matriz, objetivo)

    return {
        "medias": medias,
        "desvios": desvios,
        "coeficientes": coeficientes,
        "intercepto": float(media_y),
        "rango": [float(y.min()), float(y.max())],
        "lambda": LAMBDA
    }


def predecir(modelo, parcela):
    vector = vector_de(parcela)

    z = (
        (vector - modelo["medias"])
        / modelo["desvios"]
    )

    rendimiento = (
        modelo["intercepto"]
        + np.dot(z, modelo["coeficientes"])
    )

    minimo, maximo = modelo["rango"]

    return float(np.clip(rendimiento, minimo, maximo))


def contribuciones(modelo, parcela):
    vector = vector_de(parcela)

    z = (
        (vector - modelo["medias"])
        / modelo["desvios"]
    )

    aportes = []

    for i, (clave, nombre, fuente, desde, hasta) in enumerate(CARACTERISTICAS):
        aportes.append({
            "clave": clave,
            "nombre": nombre,
            "aporte": float(z[i] * modelo["coeficientes"][i])
        })

    return sorted(
        aportes,
        key=lambda elemento: abs(elemento["aporte"]),
        reverse=True
    )


def calcular_metricas(reales, estimados):
    reales = np.array(reales, dtype=float)
    estimados = np.array(estimados, dtype=float)

    error = reales - estimados

    mae = np.mean(np.abs(error))
    rmse = np.sqrt(np.mean(error ** 2))

    ss_res = np.sum(error ** 2)
    ss_tot = np.sum((reales - reales.mean()) ** 2)

    r2 = 1 - ss_res / ss_tot if ss_tot > 0 else 0

    return {
        "mae": float(mae),
        "rmse": float(rmse),
        "r2": float(r2),
        "n": len(reales)
    }


def validacion_cruzada(parcelas):
    conocidas = [p for p in parcelas if not p["p"]]

    reales = []
    estimados = []

    for indice, parcela in enumerate(conocidas):
        entrenamiento = [
            p for i, p in enumerate(conocidas)
            if i != indice
        ]

        modelo = entrenar_modelo(entrenamiento)
        estimacion = predecir(modelo, parcela)

        reales.append(parcela["y"])
        estimados.append(estimacion)

    return calcular_metricas(reales, estimados)
