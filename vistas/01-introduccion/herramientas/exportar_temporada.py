"""
Genera vistas/01-introduccion/temporada-datos.js: los datos de «Cómo crece la cebada y por qué 2025 fue distinto».

Entradas (salidas de los cuadernos del equipo y archivos oficiales del reto):
  - sat_features.parquet      fenología 2025 por parcela (Planet y Sentinel-2) e historia 2022–2024 (Sentinel-2)
  - climate_features.parquet  clima por parcela (CHIRPS y CHIRTS-ERA5) y anomalías 2025 − promedio 2022–2024
  - inventario_CHIRPS_precipitacion_mensual_2022_2025.csv   lluvia mensual, promedio de la región (reto)
  - inventario_temperatura_2022_2025.csv                    Tmax y Tmin mensuales, promedio de la región (reto)

Uso:
  python exportar_temporada.py sat_features.parquet climate_features.parquet inventario_CHIRPS.csv inventario_temperatura.csv \
         ../../07-modelo/datos-modelo.js SALIDA.js

Las curvas semanales de verdor de 2025 no se copian aquí: la página las toma de vistas/compartido/data.js.
"""
import csv, json, sys

import pandas as pd


def mensual(ruta, columna, filtro=None):
    salida = {}
    with open(ruta, encoding='utf-8-sig') as f:
        for fila in csv.DictReader(f):
            if filtro and fila.get('variable') != filtro:
                continue
            anio = fila['anio']
            salida.setdefault(anio, [None] * 12)[int(fila['mes']) - 1] = round(float(fila[columna]), 1)
    return salida


def main(ruta_sat, ruta_clima, ruta_lluvia, ruta_temp, ruta_modelo, salida):
    sat = pd.read_parquet(ruta_sat)
    cli = pd.read_parquet(ruta_clima)
    m = sat.merge(cli, on='ID_POLIGONO')
    js = open(ruta_modelo, encoding='utf-8').read()
    modelo = json.loads(js[js.index('window.MODELO_HGP = ') + len('window.MODELO_HGP = '):].rstrip().rstrip(';'))
    info = pd.DataFrame([{'ID_POLIGONO': p['id'], 'edo': p['edo'], 'elev': p['elev']} for p in modelo['parcelas']])
    m = m.merge(info, on='ID_POLIGONO')

    # Dos arranques: el verdor (Planet, 20 % de la amplitud) empieza antes o después del día 200 (19 de julio).
    # Entre los días 190 y 210 casi no hay parcelas, así que el corte no es arbitrario.
    m['tardia'] = m['pl_ndvi_sos'] >= 200

    parcelas = {
        r.ID_POLIGONO: [int(r.pl_ndvi_sos), int(r.pl_ndvi_pos), int(r.pl_ndvi_eos), int(r.pl_ndvi_n_seasons)]
        for r in m.itertuples()
    }
    med = lambda s: round(float(s.median()), 1)
    parte = lambda cond: round(float(cond.mean()), 3)

    datos = {
        'fuente': 'Fenología: Planet y Sentinel-2 (cuadernos del equipo, NB03). Clima: CHIRPS y CHIRTS-ERA5 del reto.',
        'dia': 'día del año 2025 (1 = 1 de enero)',
        'parcelas': parcelas,
        'fenologia': {
            'inicio_mediana': med(m.pl_ndvi_sos),
            'pico_mediana': med(m.pl_ndvi_pos),
            'fin_mediana': med(m.pl_ndvi_eos),
            'duracion_mediana': med(m.pl_ndvi_los),
            'tempranas': int((~m.tardia).sum()),
            'tardias': int(m.tardia.sum()),
            'tardias_con_verdor_previo': int((m.tardia & (m.pl_ndvi_n_seasons == 2)).sum()),
        },
        'historia': {
            'centro_2022_2024_mediana': med(m.hist_s2_center_mean),
            'centro_2025_mediana': med(m.s2_ndvi_center),
            'desfase_centro_mediana': med(m.anom_s2_center_2025),
            'pico_mas_alto': parte(m.anom_s2_peak_2025 > 0),
            'verdor_mayor': parte(m.anom_s2_integral_2025 > 0),
            'parcelas_con_3_temporadas': int((m.hist_s2_n_crop_seasons == 3).sum()),
        },
        'clima_parcelas': {
            'lluvia_previa_anomalia_mediana': med(m.anom_clim_prec_pre),
            'lluvia_previa_mas': parte(m.anom_clim_prec_pre > 0),
            'lluvia_temporada_anomalia_mediana': med(m.anom_clim_prec_season),
            'lluvia_temporada_mas': parte(m.anom_clim_prec_season > 0),
            'tmax_previa_anomalia_mediana': round(float(m.anom_clim_tmax_pre.median()), 2),
            'tmax_previa_menor': parte(m.anom_clim_tmax_pre < 0),
            'tmax_temporada_anomalia_mediana': round(float(m.anom_clim_tmax_season.median()), 2),
            'lluvia_temporada_mediana': med(m.clim_prec_season),
            'lluvia_temporada_p25': round(float(m.clim_prec_season.quantile(0.25)), 1),
            'lluvia_temporada_p75': round(float(m.clim_prec_season.quantile(0.75)), 1),
            'tmedia_temporada_mediana': med(m.clim_tmean_season),
            'tmin_temporada_mediana': med(m.clim_tmin_season),
            'tmax_temporada_mediana': med(m.clim_tmax_season),
        },
        # Lo medido en las parcelas de cada estado (para la sección «¿Dónde crece mejor la cebada?»)
        'por_estado': {
            edo: {
                'parcelas': int(len(g)),
                'elev_min': round(float(g.elev.min()), 0),
                'elev_max': round(float(g.elev.max()), 0),
                'lluvia_temporada': med(g.clim_prec_season),
                'tmedia_temporada': med(g.clim_tmean_season),
                'tmin_temporada': med(g.clim_tmin_season),
                'tmax_temporada': med(g.clim_tmax_season),
                'tmin_tardia': med(g.clim_tmin_late),
                'inicio': med(g.pl_ndvi_sos),
                'fin': med(g.pl_ndvi_eos),
            }
            for edo, g in m.groupby('edo')
        },
        'region': {
            'lluvia': mensual(ruta_lluvia, 'media_mm_mes_region'),
            'tmax': mensual(ruta_temp, 'media_region', 'Tmax'),
            'tmin': mensual(ruta_temp, 'media_region', 'Tmin'),
        },
    }

    with open(salida, 'w', encoding='utf-8') as f:
        f.write('/* Generado por herramientas/exportar_temporada.py — no editar a mano.\n'
                '   parcelas: ID → [inicio, pico, fin, temporadas] del verdor de 2025 (día del año, Planet).\n'
                '   region: promedios mensuales de los tres estados (archivos de clima del reto). */\n'
                '"use strict";\nwindow.TEMPORADA = ')
        json.dump(datos, f, ensure_ascii=False, separators=(',', ':'))
        f.write(';\n')
    print('escrito', salida, '·', datos['fenologia'], datos['historia'], datos['clima_parcelas'])


if __name__ == '__main__':
    main(*sys.argv[1:7])
