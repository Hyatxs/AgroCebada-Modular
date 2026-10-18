"""Genera vistas/07-modelo/datos-modelo.js: la única fuente de cifras del capítulo 2.

Entradas
  CARPETA_RETO  archivos del reto (con subcarpetas): shapefile de parcelas, DataSet_Maestro,
                ID_area_rendimiento.
  CARPETA_NB07  salidas oficiales del NB07 en Drive (con subcarpetas):
                outputs/app_bundle/model_bundle.json, outputs/app_bundle/model_scores.csv,
                outputs/predicciones_todas.csv, outputs/predicciones_finales.csv, qa/nb07_report.md

Uso
  python exportar_datos_modelo.py CARPETA_RETO CARPETA_NB07 ../datos-modelo.js
  node verificar_motor.js ../datos-modelo.js ../motor-hgp.js      # comprueba el motor

Solo necesita numpy y pandas (sin geopandas).
"""
import json, sys, re
import numpy as np, pandas as pd
from lectura_parcelas import load_plots, buscar
from compactar_mapa import empacar

if len(sys.argv) < 4:
    sys.exit(__doc__)
carpeta_reto, carpeta_nb07, out_path = sys.argv[1:4]

d = load_plots(carpeta_reto)
off = json.load(open(buscar(carpeta_nb07, 'model_bundle.json')))
todas = pd.read_csv(buscar(carpeta_nb07, 'predicciones_todas.csv'))
P = (todas.rename(columns={'ID_POLIGONO': 'id', 'RENDIMIENTO_PRED_T_HA': 'pred', 'RENDIMIENTO_SATELITAL_T_HA': 'sat'})
     .set_index('id')[['pred', 'sd', 'riesgo', 'sat']])
scores = pd.read_csv(buscar(carpeta_nb07, 'model_scores.csv'))
report = open(buscar(carpeta_nb07, 'nb07_report.md'), encoding='utf-8').read()
finales = pd.read_csv(buscar(carpeta_nb07, 'predicciones_finales.csv'))

tr = d[d.CONJUNTO == 'ENTRENAMIENTO']
mu = float(tr.RENDIMIENTO_T_HA.mean())

# --- coordenadas locales en km (EPSG:6372), y hacia abajo para SVG -------------
x0 = float(d.x_km.min()) - 1.0
y1 = float(d.y_km.max()) + 1.0


def to_local(rings):
    return [[[round(x / 1000 - x0, 4), round(y1 - y / 1000, 4)] for x, y in r] for r in rings]


plots = []
for _, r in d.iterrows():
    p = P.loc[r.id]
    rec = dict(id=r.id, mun=r.Municipio, edo=r.Estado, pred=r.CONJUNTO == 'PREDICCION',
               ha=float(r.AREA_HA), x=round(float(r.x_km) - x0, 5), y=round(y1 - float(r.y_km), 5),
               lon=round(float(r.lon), 5), lat=round(float(r.lat), 5),
               poly=to_local(r.rings_lcc))
    rec['elev'] = None if pd.isna(r.elevacion_m) else round(float(r.elevacion_m), 1)
    if r.CONJUNTO == 'PREDICCION':
        rec.update(est=float(p.pred), sd=float(p.sd), riesgo=p.riesgo, sat=float(p.sat))
    else:
        rec.update(y_obs=float(r.RENDIMIENTO_T_HA), oof=float(p.pred), oof_sd=float(p.sd))
    plots.append(rec)

# --- mapa compacto para la escena 3D (ver compactar_mapa.py) -------------------
ESQUEMA = dict(umbral=1.0, local=0.45, hueco_parcela=0.03, hueco_grupo=0.15, escala=0.07)
grupo, desp = empacar(plots, **ESQUEMA)
for i, rec in enumerate(plots):
    rec['grupo'] = int(grupo[i])
    rec['dx'] = round(float(desp[i, 0]), 4)
    rec['dy'] = round(float(desp[i, 1]), 4)

# --- municipios ---------------------------------------------------------------
mun = []
for m, g in d.groupby('Municipio'):
    t = g[g.CONJUNTO == 'ENTRENAMIENTO']
    mun.append(dict(nombre=m, estado=g.Estado.iloc[0], n_entren=int(len(t)), n_pred=int((g.CONJUNTO == 'PREDICCION').sum()),
                    media=round(float(t.RENDIMIENTO_T_HA.mean()), 3),
                    cx=round(float(g.x_km.mean()) - x0, 3), cy=round(y1 - float(g.y_km.mean()), 3),
                    elev=round(float(g.elevacion_m.mean()), 1)))

# --- modelos (NB07, model_scores.csv) -----------------------------------------
NOMBRES = {
    '0 municipality mean': ('Promedio del municipio', 'ubicacion', 'Línea base: el rendimiento medio de su municipio.'),
    '1 ridge on residuals': ('Municipio + ridge con satélite', 'mixto', 'Corrige el promedio municipal con índices satelitales (regresión ridge).'),
    '2 random forest on residuals': ('Municipio + bosque aleatorio', 'mixto', 'Corrige el promedio municipal con un bosque aleatorio sobre variables satelitales, de clima y suelo.'),
    '3 LightGBM on residuals': ('Municipio + LightGBM', 'mixto', 'Corrige el promedio municipal con árboles potenciados (LightGBM).'),
    '4 spatial GP on residuals': ('Municipio + vecinos', 'ubicacion', 'Promedio municipal más un ajuste por parcelas cercanas.'),
    '5 hierarchical GP': ('GP jerárquico', 'ubicacion', 'Municipio y vecinos estimados juntos, con rango de confianza. Modelo final.'),
    '6 hierarchical GP + features': ('GP jerárquico + satélite', 'mixto', 'El modelo final con variables satelitales añadidas.'),
    '7 regression kriging': ('Kriging con regresión', 'mixto', 'Regresión con variables y luego interpolación espacial de los errores.'),
    '8 satellite-only ridge': ('Solo satélite · ridge', 'satelite', 'Sin ubicación: solo índices, clima, suelo y terreno.'),
    '9 satellite-only random forest': ('Solo satélite · bosque aleatorio', 'satelite', 'Sin ubicación: bosque aleatorio con índices, clima, suelo y terreno.'),
}
modelos = []
for name, g in scores.groupby('model', sort=False):
    nm, cat, desc = NOMBRES[name]
    row = dict(id=int(name.split()[0]), nombre=nm, tipo=cat, desc=desc, final=name.startswith('5 '))
    for _, s in g.iterrows():
        row[s.scheme] = dict(rmse=float(s.rmse), mae=float(s.mae), r2=float(s.r2))
    modelos.append(row)


# --- preguntas guía (tablas del nb07_report.md) -------------------------------
def tabla(titulo):
    i = report.index(titulo)
    lines = report[i:].split('\n')[1:]
    rows = []
    for ln in lines:
        if not ln.startswith('|'):
            if rows:
                break
            continue
        rows.append([c.strip() for c in ln.strip('|').split('|')])
    head, body = rows[0], rows[2:]
    return [dict(zip(head, b)) for b in body]

NOM_IDX = {'msavi': 'MSAVI', 'savi': 'SAVI', 'evi': 'EVI', 'lai': 'LAI', 'fapar': 'FAPAR', 'ndwi': 'NDWI', 'msi': 'MSI',
           'emsi': 'EMSI', 'dswi5': 'DSWI5', 'endwi': 'ENDWI', 'ndti': 'NDTI', 'ndvi': 'NDVI', 'sti': 'STI', 'dswi4': 'DSWI4',
           'mra': 'MRA', 'nddi': 'NDDI', 'dswi3': 'DSWI3', 'dswi2': 'DSWI2', 'srndi': 'SRNDI', 'enddi': 'ENDDI', 'vi6t': 'VI6T',
           'mcrc': 'MCRC', 'crc': 'CRC', 'ndsvi': 'NDSVI'}
NOM_CLIMA = {'amp': 'Amplitud térmica', 'tmax': 'Temperatura máxima', 'pet': 'Evapotranspiración potencial',
             'tmin': 'Temperatura mínima', 'gdd': 'Grados-día', 'wb': 'Balance hídrico', 'prec': 'Precipitación',
             'tmean': 'Temperatura media'}
NOM_FAM = {'climate': 'clima', 'soil': 'suelo', 'terrain': 'terreno', 'satellite indices': 'índices satelitales',
           'history 2022–24': 'historia 2022–24', 'phenology': 'fenología'}

skill = tabla('## Lens 2 — Q1/Q2')
q1 = [dict(nombre=NOM_IDX[s['group']], rmse=float(s['rmse']), se=float(s['se']), mejora=float(s['skill_vs_no_information_%']))
      for s in skill if s['kind'] == 'index']
q2 = [dict(nombre=NOM_CLIMA[s['group']], clave=s['group'], rmse=float(s['rmse']), se=float(s['se']), mejora=float(s['skill_vs_no_information_%']))
      for s in skill if s['kind'] == 'climate']


def nombre_combo(c):
    return ' + '.join(NOM_FAM[f.strip()] for f in c.split(' + '))

q3 = [dict(nombre=nombre_combo(s['combination']), familias=int(s['n_families']), rmse=float(s['rmse']), se=float(s['se']))
      for s in tabla('## Lens 2 — Q3 best combinations')]
q3_solas = [dict(nombre=nombre_combo(s['combination']), rmse=float(s['rmse']), se=float(s['se']))
            for s in tabla('## Lens 2 — single families')]
# Lente 1 (nb07_report.md): la tabla trae '|ρ|' en el encabezado, que rompe el parseo por '|'.
# Fila 'all' copiada del reporte: 264 variables, máx |ρ| 0.244, percentil 95 del azar 0.315, p = 0.388.
perm_all = {'p-value': 0.388, 'rho': 0.244, 'chance 95th pct': 0.315, 'features': 264}

sd_y = float(tr.RENDIMIENTO_T_HA.std(ddof=0))
oof = np.array([p['oof'] for p in plots if not p['pred']]); yo = np.array([p['y_obs'] for p in plots if not p['pred']])
redondeados = int(np.isin(np.round(yo, 2), [2.5, 3.0, 3.5]).sum())
pred_ids = [p for p in plots if p['pred']]
dist = sorted(float(v) for v in finales.dist_parcela_entrenamiento_km)

bundle = dict(
    meta=dict(version='1.0', fuente='NB07 (6 oct 2026) · modelo final: GP jerárquico', unidades='t/ha', ciclo='2025 (abril–octubre)',
              origen_km=dict(x0=x0, y1=y1, crs='EPSG:6372')),
    modelo=dict(nombre='GP jerárquico', mu=round(mu, 6), s2_municipio=off['hgp_params']['s_muni'],
                s2_espacial=off['hgp_params']['s_spatial'], alcance_km=off['hgp_params']['l_spatial_km'],
                s2_ruido=off['hgp_params']['noise'], nucleo='matern32',
                q=dict(p10=off['conformal_quantiles']['P10'], p20=off['conformal_quantiles']['P20'],
                       p80=off['conformal_quantiles']['P80'], p90=off['conformal_quantiles']['P90']),
                umbrales_riesgo=off['risk_thresholds_relative_downside']),
    metricas=dict(rmse=0.5027, mae=0.3473, r2=0.6486, rmse_base=0.5087, mae_base=0.3313, r2_base=0.6401,
                  cobertura_p10_p90=0.791, cobertura_p20=0.795, sd_rendimiento=round(sd_y, 3),
                  n_entren=int(len(tr)), n_pred=len(pred_ids), redondeados=redondeados,
                  rmse_espacial=0.6588, rmse_espacial_base=0.657,
                  dist_mediana_km=round(float(np.median(dist)), 3), dist_max_km=round(max(dist), 3),
                  pruebas='10 repeticiones × 5 particiones estratificadas (municipio × tercil de rendimiento)'),
    modelos=modelos,
    preguntas=dict(q1=q1, q2=q2, q3=q3, q3_solas=q3_solas, rmse_ubicacion=0.509, rmse_sin_info=0.848,
                   permutacion=dict(p=float(perm_all['p-value']), rho=float(perm_all['rho']),
                                    azar95=float(perm_all['chance 95th pct']), variables=int(perm_all['features']))),
    escena=dict(**ESQUEMA, grupos=int(grupo.max() + 1),
                nota='Mapa esquemático: las parcelas se acercaron entre sí para verlas juntas (forma y tamaño reales, '
                     'distancias no). El modelo usa siempre la ubicación real.'),
    municipios=mun,
    parcelas=plots,
)
js = ('/* Generado por herramientas/exportar_datos_modelo.py — no editar a mano.\n'
      '   Fuente única de cifras del capítulo 2 (salidas oficiales del NB07). */\n'
      '"use strict";\nwindow.MODELO_HGP = ' + json.dumps(bundle, ensure_ascii=False, separators=(',', ':')) + ';\n')
open(out_path, 'w', encoding='utf-8').write(js)
print('ok', out_path, round(len(js) / 1024, 1), 'KB; mu', round(mu, 4), '; redondeados', redondeados, '; Q1 top', q1[0]['nombre'], '; Q3 top', q3[0]['nombre'])
