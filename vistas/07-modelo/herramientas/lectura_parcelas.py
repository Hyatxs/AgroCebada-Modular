"""Lee las parcelas del reto sin geopandas.

- Shapefile Parcelas_Reto_AGC_CONJUNTO (.shp + .dbf, WGS84): polígonos para lon/lat.
- DataSet_Maestro_AgroCebada.csv: los mismos polígonos en EPSG:6372 (metros) y el municipio.
- ID_area_rendimiento_70_30_Reto_AgroCebada.csv: área, rendimiento y conjunto.

Los archivos se buscan por nombre dentro de la carpeta del reto (con subcarpetas).
"""
import glob, os, struct
import numpy as np
import pandas as pd


def buscar(carpeta, patron):
    encontrados = sorted(glob.glob(os.path.join(carpeta, '**', patron), recursive=True))
    if not encontrados:
        raise FileNotFoundError(f'No encuentro {patron} dentro de {carpeta}')
    return encontrados[0]


def read_dbf(path):
    with open(path, 'rb') as f:
        data = f.read()
    nrec, hlen, rlen = struct.unpack('<IHH', data[4:12])
    fields = []
    pos = 32
    while data[pos] != 0x0D:
        name = data[pos:pos + 11].split(b'\x00')[0].decode('utf-8', 'replace')
        ftype = chr(data[pos + 11]); flen = data[pos + 16]
        fields.append((name, ftype, flen))
        pos += 32
    rows = []
    for i in range(nrec):
        off = hlen + i * rlen
        rec = data[off:off + rlen]
        if rec[0:1] == b'*':
            continue
        p = 1; row = {}
        for name, ftype, flen in fields:
            raw = rec[p:p + flen].decode('utf-8', 'replace').strip(); p += flen
            if ftype in 'NF':
                try: raw = float(raw)
                except ValueError: raw = np.nan
            row[name] = raw
        rows.append(row)
    return pd.DataFrame(rows)


def read_shp(path):
    with open(path, 'rb') as f:
        data = f.read()
    pos = 100; shapes = []
    while pos < len(data):
        _, clen = struct.unpack('>ii', data[pos:pos + 8]); pos += 8
        content = data[pos:pos + clen * 2]; pos += clen * 2
        stype = struct.unpack('<i', content[:4])[0]
        if stype == 0:
            shapes.append([]); continue
        nparts, npts = struct.unpack('<ii', content[36:44])
        parts = struct.unpack('<%di' % nparts, content[44:44 + 4 * nparts])
        p0 = 44 + 4 * nparts
        pts = np.frombuffer(content[p0:p0 + 16 * npts], dtype='<f8').reshape(-1, 2)
        rings = []
        for k in range(nparts):
            a = parts[k]; b = parts[k + 1] if k + 1 < nparts else npts
            rings.append(pts[a:b].copy())
        shapes.append(rings)
    return shapes


def ring_area_centroid(r):
    x, y = r[:, 0], r[:, 1]
    x1, y1 = np.roll(x, -1), np.roll(y, -1)
    c = x * y1 - x1 * y
    a = c.sum() / 2
    if abs(a) < 1e-12:
        return 0.0, x.mean(), y.mean()
    return a, ((x + x1) * c).sum() / (6 * a), ((y + y1) * c).sum() / (6 * a)


def poly_centroid(rings):
    A = 0; cx = 0; cy = 0
    for r in rings:  # outer CW / holes CCW in shapefile; use signed areas
        a, x, y = ring_area_centroid(r)
        A += a; cx += a * x; cy += a * y
    return A, cx / A, cy / A


def parse_wkt_polygon(w):
    body = w[w.index('((') + 2: w.rindex('))')]
    rings = []
    for ring in body.split('), ('):
        pts = [tuple(map(float, p.split()[:2])) for p in ring.strip('()').split(',')]
        rings.append(np.array(pts))
    return rings


def load_plots(carpeta_reto):
    dbf = read_dbf(buscar(carpeta_reto, '*Parcelas_Reto_AGC_CONJUNTO.dbf'))
    shp = read_shp(buscar(carpeta_reto, '*Parcelas_Reto_AGC_CONJUNTO.shp'))
    dbf['rings_wgs'] = shp
    m = pd.read_csv(buscar(carpeta_reto, '*DataSet_Maestro_AgroCebada.csv'))
    lab = pd.read_csv(buscar(carpeta_reto, '*ID_area_rendimiento_70_30_Reto_AgroCebada.csv'), encoding='utf-8-sig')
    lab = lab[['ID_POLIGONO', 'AREA_HA', 'RENDIMIENTO_T_HA', 'CONJUNTO']]
    m = m.rename(columns={'ID_POLIGON': 'id'})
    m['rings_lcc'] = m.geometry.map(parse_wkt_polygon)
    cen = m.rings_lcc.map(poly_centroid)
    m['x_km'] = [c[1] / 1000 for c in cen]
    m['y_km'] = [c[2] / 1000 for c in cen]
    m['area_lcc_ha'] = [abs(c[0]) / 1e4 for c in cen]
    idcol = [c for c in dbf.columns if c.upper().startswith('ID_POL')][0]
    dbf = dbf.rename(columns={idcol: 'id'})
    cw = dbf.rings_wgs.map(poly_centroid)
    dbf['lon'] = [c[1] for c in cw]
    dbf['lat'] = [c[2] for c in cw]
    d = (m[['id', 'Municipio', 'Estado', 'x_km', 'y_km', 'area_lcc_ha', 'elevacion_m', 'pendiente_grados', 'rings_lcc']]
         .merge(dbf[['id', 'lon', 'lat', 'rings_wgs']], on='id')
         .merge(lab.rename(columns={'ID_POLIGONO': 'id'}), on='id'))
    d = d.sort_values('id').reset_index(drop=True)
    return d


if __name__ == '__main__':
    import sys
    d = load_plots(sys.argv[1] if len(sys.argv) > 1 else '.')
    print(d.drop(columns=['rings_lcc', 'rings_wgs']).head())
    print(d.shape, d.CONJUNTO.value_counts().to_dict())
    print('area check (lcc vs given):', np.corrcoef(d.area_lcc_ha, d.AREA_HA)[0, 1], (d.area_lcc_ha / d.AREA_HA).describe()[['min', '50%', 'max']].round(3).to_dict())
    print(d[['lon', 'lat']].describe().loc[['min', 'max']])
