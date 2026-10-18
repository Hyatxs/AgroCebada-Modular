"""Mapa esquemático compacto para la escena 3D del capítulo 2.

Las 197 parcelas reales están repartidas en más de 100 km; vistas a escala, cada una es un punto.
Para verlas juntas se acomodan en un mapa pequeño, en dos niveles:

1. Grupos: parcelas a menos de UMBRAL km entre sí (enlace simple). Una vecina que influye en la
   predicción (a menos de ~1 km) siempre queda en el mismo grupo que su parcela.
2. Dentro de cada grupo, cada parcela se acerca al centro del grupo (factor LOCAL) y se coloca en el
   lugar libre más cercano, sin encimarse (con HUECO_PARCELA km entre polígonos). Se conserva qué
   parcela está al norte, sur, este u oeste de cuál, pero no la distancia exacta.
3. Los grupos ya compactos se acomodan cerca de su posición real encogida (factor ESCALA), con
   HUECO_GRUPO km entre ellos. Así se conserva la geografía general (estados, municipios).

Los polígonos conservan su forma y tamaño reales; solo se trasladan. El modelo nunca usa estas
posiciones: calcula siempre con las coordenadas reales.

Solo necesita numpy.
"""
import numpy as np


def grupos(X, umbral):
    """Etiqueta de grupo por enlace simple (componentes con distancia < umbral)."""
    n = len(X)
    lab = -np.ones(n, int)
    c = 0
    D = np.sqrt(((X[:, None] - X[None]) ** 2).sum(-1))
    for i in range(n):
        if lab[i] >= 0:
            continue
        pila = [i]
        lab[i] = c
        while pila:
            j = pila.pop()
            for k in np.where((D[j] < umbral) & (lab < 0))[0]:
                lab[k] = c
                pila.append(k)
        c += 1
    return lab


def _dentro(px, py, anillo):
    """Punto en polígono (rayo), vectorizado."""
    si = np.zeros(px.shape, bool)
    n = len(anillo)
    for i in range(n):
        x1, y1 = anillo[i - 1]
        x2, y2 = anillo[i]
        cruza = (y2 > py) != (y1 > py)
        with np.errstate(divide="ignore", invalid="ignore"):
            xc = (x1 - x2) * (py - y2) / (y1 - y2) + x2
        si ^= cruza & (px < xc)
    return si


def _rasterizar(anillo, celda):
    a = np.asarray(anillo, float)
    x0, y0 = a.min(0)
    x1, y1 = a.max(0)
    nx = int(np.ceil((x1 - x0) / celda)) + 1
    ny = int(np.ceil((y1 - y0) / celda)) + 1
    gx = x0 + (np.arange(nx) + 0.5) * celda
    gy = y0 + (np.arange(ny) + 0.5) * celda
    X, Y = np.meshgrid(gx, gy)
    m = _dentro(X, Y, a)
    if not m.any():
        m[ny // 2, nx // 2] = True
    return m, (x0, y0)


def _dilatar(m, r):
    """Dilata una máscara r celdas (disco)."""
    if r <= 0:
        return m.copy(), 0
    h, w = m.shape
    out = np.zeros((h + 2 * r, w + 2 * r), bool)
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if dx * dx + dy * dy <= r * r:
                out[r + dy:r + dy + h, r + dx:r + dx + w] |= m
    return out, r


def _marcar(lienzo, m, a0, b0):
    """lienzo[a0:, b0:] |= m, recortando lo que quede fuera."""
    H, W = lienzo.shape
    h, w = m.shape
    sa, sb = max(0, -a0), max(0, -b0)
    ea, eb = min(h, H - a0), min(w, W - b0)
    if ea > sa and eb > sb:
        lienzo[a0 + sa:a0 + ea, b0 + sb:b0 + eb] |= m[sa:ea, sb:eb]


def _colocar(ocupado, mascara, objetivo):
    """Esquina (i, j) libre más cercana a 'objetivo' donde 'mascara' no toca 'ocupado'."""
    H, W = ocupado.shape
    h, w = mascara.shape
    pad = np.zeros((H, W))
    pad[:h, :w] = mascara
    corr = np.real(np.fft.ifft2(np.fft.fft2(ocupado.astype(float)) * np.conj(np.fft.fft2(pad))))
    libre = corr[: H - h + 1, : W - w + 1] < 0.5
    ii, jj = np.nonzero(libre)
    if len(ii) == 0:
        raise RuntimeError("Lienzo demasiado chico para acomodar las parcelas")
    k = np.argmin((ii - objetivo[0]) ** 2 + (jj - objetivo[1]) ** 2)
    return ii[k], jj[k]


def empacar(P, umbral=1.0, local=0.45, hueco_parcela=0.03, hueco_grupo=0.15, escala=0.07, celda=0.01):
    """Devuelve (grupo por parcela, desplazamiento [dx, dy] en km por parcela)."""
    X = np.array([[p["x"], p["y"]] for p in P])
    lab = grupos(X, umbral)
    G = lab.max() + 1
    rp = int(round(hueco_parcela / celda))
    rg = int(round(hueco_grupo / celda))
    mascaras = [_rasterizar(p["poly"][0], celda) for p in P]
    desp = np.zeros((len(P), 2))

    # --- 1. Compactar cada grupo -----------------------------------------------
    figuras = []  # por grupo: (máscara unida, esquina en km, centro real del grupo)
    for g in range(G):
        idx = np.where(lab == g)[0]
        cg = X[idx].mean(0)
        R = np.sqrt(((X[idx] - cg) ** 2).sum(-1)).max() + 0.6
        lado = int(np.ceil(2 * R / celda)) + 80
        origen = cg - lado * celda / 2
        ocupado = np.zeros((lado, lado), bool)
        union = np.zeros((lado, lado), bool)
        orden = idx[np.argsort(np.sqrt(((X[idx] - cg) ** 2).sum(-1)))]
        for i in orden:
            m, (x0, y0) = mascaras[i]
            meta = cg + (X[i] - cg) * local - X[i]  # desplazamiento deseado
            obj = ((y0 + meta[1] - origen[1]) / celda, (x0 + meta[0] - origen[0]) / celda)
            fi, fj = _colocar(ocupado, m, obj)
            md, r = _dilatar(m, rp)
            _marcar(ocupado, md, fi - r, fj - r)
            _marcar(union, m, fi, fj)
            desp[i] = (origen[0] + fj * celda - x0, origen[1] + fi * celda - y0)
        filas = np.nonzero(union.any(1))[0]
        cols = np.nonzero(union.any(0))[0]
        recorte = union[filas[0]:filas[-1] + 1, cols[0]:cols[-1] + 1]
        esquina = origen + np.array([cols[0], filas[0]]) * celda
        figuras.append((recorte, esquina, cg, len(idx)))

    # --- 2. Acomodar los grupos ----------------------------------------------------
    tam = np.array([f[3] for f in figuras])
    centros = np.array([f[2] for f in figuras])
    c0 = np.average(centros, axis=0, weights=tam)
    total = sum(f[0].sum() for f in figuras) * celda * celda
    lado = int(np.ceil(np.sqrt(total) * 4.5 / celda)) + 400
    origen = c0 - lado * celda / 2
    ocupado = np.zeros((lado, lado), bool)
    for g in np.argsort(-tam):
        m, esquina, cg, _ = figuras[g]
        # centro de la figura compacta → posición real encogida
        centro_fig = esquina + np.array([m.shape[1], m.shape[0]]) * celda / 2
        meta = c0 + (cg - c0) * escala
        obj_esq = esquina + (meta - centro_fig)
        obj = ((obj_esq[1] - origen[1]) / celda, (obj_esq[0] - origen[0]) / celda)
        fi, fj = _colocar(ocupado, m, obj)
        md, r = _dilatar(m, rg)
        _marcar(ocupado, md, fi - r, fj - r)
        mover = origen + np.array([fj, fi]) * celda - esquina
        desp[lab == g] += mover
    return lab, desp
