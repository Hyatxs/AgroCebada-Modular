"""
Genera vistas/01-introduccion/mapa-inicio-datos.js: el mapa de la portada del capítulo 1.

Fuentes (las dos derivan de Natural Earth, de dominio público):
  - Estados de México: TopoJSON incluido en el paquete npm datamaps 0.5.10 (MIT), dist/datamaps.mex.js.
  - Países del mundo: paquete npm world-atlas 2.0.2 (ISC), countries-110m.json.
  - Parcelas: vistas/07-modelo/datos-modelo.js (lon/lat reales de las 197 parcelas del reto).

Uso:
  python exportar_mapa_inicio.py RUTA/datamaps.mex.js RUTA/countries-110m.json RUTA/datos-modelo.js SALIDA.js

Salida: coordenadas lon/lat (grados, 2 decimales) para dibujar con d3-geo en proyección ortográfica: el globo
que gira en la portada y el acercamiento a los tres estados. Es un mapa ilustrativo de ubicación, no
cartografía oficial.
"""
import json, math, sys

COS = math.cos(math.radians(20))
K = 10  # unidades por grado (0.1 = 0.01°, unos 1.1 km)


def extraer_topojson(js, clave='"type":"Topology"'):
    i = js.find(clave)
    a = js.rfind('{', 0, i)
    prof = 0
    for j in range(a, len(js)):
        if js[j] == '{':
            prof += 1
        elif js[j] == '}':
            prof -= 1
            if prof == 0:
                return json.loads(js[a:j + 1])
    raise ValueError('No se encontró el TopoJSON')


def arcos(topo):
    sx, sy = topo['transform']['scale']
    tx, ty = topo['transform']['translate']
    salida = []
    for arco in topo['arcs']:
        x = y = 0
        pts = []
        for dx, dy in arco:
            x += dx
            y += dy
            pts.append((x * sx + tx, y * sy + ty))
        salida.append(pts)
    return salida


def anillo(indices, ARC):
    pts = []
    for k in indices:
        a = ARC[k] if k >= 0 else ARC[~k][::-1]
        pts.extend(a if not pts else a[1:])
    return pts


def poligonos(geom, ARC):
    if geom['type'] == 'Polygon':
        return [[anillo(r, ARC) for r in geom['arcs']]]
    if geom['type'] == 'MultiPolygon':
        return [[anillo(r, ARC) for r in p] for p in geom['arcs']]
    return []


def proyectar(lon, lat):
    return (lon * COS * K, -lat * K)


def dp(pts, tol):
    """Douglas-Peucker sobre puntos ya proyectados."""
    if len(pts) < 4:
        return pts
    def dist(p, a, b):
        (x, y), (x1, y1), (x2, y2) = p, a, b
        dx, dy = x2 - x1, y2 - y1
        if dx == dy == 0:
            return math.hypot(x - x1, y - y1)
        t = max(0, min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)))
        return math.hypot(x - x1 - t * dx, y - y1 - t * dy)
    pila, guardar = [(0, len(pts) - 1)], {0, len(pts) - 1}
    while pila:
        i, j = pila.pop()
        mx, imx = 0, None
        for k in range(i + 1, j):
            d = dist(pts[k], pts[i], pts[j])
            if d > mx:
                mx, imx = d, k
        if imx is not None and mx > tol:
            guardar.add(imx)
            pila += [(i, imx), (imx, j)]
    return [pts[k] for k in sorted(guardar)]


def desenvolver(r):
    """Anillos que cruzan el meridiano 180° (Rusia, Fiyi): se pasan a longitudes continuas para que no
    dibujen una raya horizontal de lado a lado del mapa."""
    if any(abs(r[i][0] - r[i - 1][0]) > 180 for i in range(1, len(r))):
        return [(lon + 360 if lon < 0 else lon, lat) for lon, lat in r]
    return r


def camino(polis, tol, minimo=0.0):
    partes = []
    for p in polis:
        for r in p:
            if max(lat for _, lat in r) < -55:
                continue  # la Antártida no entra en ninguna vista y su anillo da la vuelta al mundo
            q = dp([proyectar(*c) for c in desenvolver(r)], tol)
            if len(q) < 3:
                continue
            area = abs(sum(q[k][0] * q[k - 1][1] - q[k - 1][0] * q[k][1] for k in range(len(q)))) / 2
            if area < minimo:
                continue
            partes.append('M' + 'L'.join(f'{x:.1f},{y:.1f}' for x, y in q) + 'Z')
    return ''.join(partes)


def caja(polis):
    xs = [proyectar(*c)[0] for p in polis for r in p for c in r]
    ys = [proyectar(*c)[1] for p in polis for r in p for c in r]
    return [round(min(xs), 1), round(min(ys), 1), round(max(xs) - min(xs), 1), round(max(ys) - min(ys), 1)]


def dentro(lon, lat, polis):
    hay = False
    for p in polis:
        for r in p:
            for k in range(len(r)):
                (x1, y1), (x2, y2) = r[k - 1], r[k]
                if (y1 > lat) != (y2 > lat) and lon < (x2 - x1) * (lat - y1) / (y2 - y1) + x1:
                    hay = not hay
    return hay


def centroide(polis):
    # centroide del anillo exterior más grande, en coordenadas proyectadas
    mejor, amax = None, -1
    for p in polis:
        r = [proyectar(*c) for c in p[0]]
        a = sum(r[k - 1][0] * r[k][1] - r[k][0] * r[k - 1][1] for k in range(len(r))) / 2
        if abs(a) > amax:
            amax, mejor = abs(a), (r, a)
    r, a = mejor
    cx = sum((r[k - 1][0] + r[k][0]) * (r[k - 1][0] * r[k][1] - r[k][0] * r[k - 1][1]) for k in range(len(r))) / (6 * a)
    cy = sum((r[k - 1][1] + r[k][1]) * (r[k - 1][0] * r[k][1] - r[k][0] * r[k - 1][1]) for k in range(len(r))) / (6 * a)
    return round(cx, 1), round(cy, 1)


def main(ruta_mex, ruta_mundo, ruta_datos, salida):
    mex = extraer_topojson(open(ruta_mex, encoding='utf-8').read())
    ARC_M = arcos(mex)
    estados = {}
    for g in mex['objects']['mex']['geometries']:
        nombre = (g.get('properties') or {}).get('name')
        if nombre:
            estados[nombre] = poligonos(g, ARC_M)

    mundo = json.load(open(ruta_mundo, encoding='utf-8'))
    ARC_W = arcos(mundo)
    paises = []
    contorno_mexico = None
    for g in mundo['objects']['countries']['geometries']:
        polis = poligonos(g, ARC_W)
        if (g.get('properties') or {}).get('name') == 'Mexico':
            contorno_mexico = polis
        else:
            paises.extend(polis)

    js = open(ruta_datos, encoding='utf-8').read()
    datos = json.loads(js[js.index('window.MODELO_HGP = ') + len('window.MODELO_HGP = '):].rstrip().rstrip(';'))
    parcelas = datos['parcelas']

    # Revisión: los contornos de Natural Earth están simplificados. Cerca de las fronteras (Chignahuapan,
    # Apan, Emiliano Zapata) algunas parcelas caen del otro lado de la línea por 1–5 km. Por eso el mapa
    # de la portada solo se acerca hasta el nivel de los estados y no dibuja fronteras a la escala de parcela.
    fuera = [p['id'] for p in parcelas if not dentro(p['lon'], p['lat'], estados[p['edo']])]
    print('parcelas del otro lado de una frontera simplificada:', len(fuera))

    objetivo = ['Hidalgo', 'Puebla', 'Tlaxcala']

    def simplificar_lonlat(r, tol):
        """Douglas-Peucker en grados (lon escalada por cos 20°)."""
        pts = [(lon * COS, lat) for lon, lat in r]
        q = dp(pts, tol)
        return [(round(x / COS, 2), round(y, 2)) for x, y in q]

    def multipoligono(polis, tol, quitar_antartida=False):
        salida = []
        for p in polis:
            anillos = []
            for r in p:
                if quitar_antartida and max(lat for _, lat in r) < -55:
                    break
                q = simplificar_lonlat(r, tol)
                # d3 necesita anillos cerrados de al menos 4 puntos
                if len(q) < 3:
                    continue
                if q[0] != q[-1]:
                    q.append(q[0])
                if len(q) >= 4:
                    anillos.append([list(c) for c in q])
            if anillos:
                salida.append(anillos)
        return salida

    def caja_lonlat(polis):
        lons = [c[0] for p in polis for r in p for c in r]
        lats = [c[1] for p in polis for r in p for c in r]
        return [round(min(lons), 3), round(min(lats), 3), round(max(lons), 3), round(max(lats), 3)]

    salida_js = {
        'fuente': 'Natural Earth (dominio público) vía datamaps 0.5.10 y world-atlas 2.0.2; parcelas del Reto AgroCebada',
        'mundo': multipoligono(paises, 0.12, quitar_antartida=True),
        'mexico': multipoligono(contorno_mexico, 0.04),
        'estados': [
            {'n': n, 'reto': n in objetivo, 'p': multipoligono(polis, 0.008)}
            for n, polis in estados.items()
        ],
        'cajas': {
            'mexico': caja_lonlat(contorno_mexico),
            'reto': caja_lonlat([pp for n in objetivo for pp in estados[n]]),
        },
        'parcelas': [[round(p['lon'], 4), round(p['lat'], 4), 1 if p.get('pred') else 0] for p in parcelas],
    }

    with open(salida, 'w', encoding='utf-8') as f:
        f.write('/* Generado por herramientas/exportar_mapa_inicio.py — no editar a mano.\n'
                '   Contornos: Natural Earth (dominio público) vía datamaps (MIT) y world-atlas (ISC).\n'
                '   Parcelas: posiciones reales de las 197 parcelas del reto. Coordenadas [lon, lat]. */\n'
                '"use strict";\nwindow.MAPA_INICIO = ')
        json.dump(salida_js, f, ensure_ascii=False, separators=(',', ':'))
        f.write(';\n')
    print('escrito', salida)


if __name__ == '__main__':
    main(*sys.argv[1:5])
