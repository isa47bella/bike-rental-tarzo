#!/usr/bin/env python3
"""Genera le immagini dell'opuscolo a partire dai file GPX dei percorsi:

  mappe/<nome>.png       mappa del percorso (basemap CARTO/OSM + traccia GPS)
  mappe/qr-<nome>.png    QR code che apre la traccia su Wikiloc

Niente e' disegnato a memoria: la linea del percorso e' la traccia GPS reale
del file GPX, il fondo cartografico e' OpenStreetMap, e il link del QR e' la
pagina Wikiloc indicata nei metadati dello stesso GPX. Uso una tantum.

    python3 genera-mappe.py

Dipendenze: Pillow, segno.
"""
import io
import math
import os
import time
import urllib.request
import xml.etree.ElementTree as ET

import segno
from PIL import Image, ImageDraw, ImageFont

BASE = os.path.dirname(os.path.abspath(__file__))
TRACCE = os.path.join(BASE, "tracce")
MAPPE = os.path.join(BASE, "mappe")
os.makedirs(MAPPE, exist_ok=True)

ROUTES = [
    ("follina",           "follina-laghi-di-revine-anello.gpx"),
    ("refrontolo",        "refrontolo-val-trippera.gpx"),
    ("pian-de-le-femene", "pian-de-le-femene-bivacco-col-dei-gai.gpx"),
]

FRAME_W, FRAME_H = 720, 290         # geo-pixel (tile 256) -> immagine 1440x580
FILL = 0.82                         # quota del frame occupata dalla traccia
TILE = 256
SCALE = 2                           # tile @2x: immagine ad alta risoluzione
ARANCIO = (234, 88, 12)             # #EA580C, arancio brand
INK = (42, 39, 35)                  # "nero" caldo
UA = "ArfantaBikeRental-opuscolo/1.0 (mappe percorsi, uso una tantum)"


def parse_gpx(path):
    """Restituisce (lista di punti lat/lon, url Wikiloc della traccia)."""
    pts = []
    url = None
    for _, el in ET.iterparse(path):
        tag = el.tag.split("}")[-1]
        if tag == "trkpt":
            pts.append((float(el.get("lat")), float(el.get("lon"))))
        elif tag == "link":
            href = el.get("href") or ""
            if "mountain-biking-trails" in href:
                url = href
    return pts, url


def proj(lon, lat, z):
    """lon/lat -> geo-pixel (Web Mercator, tile da 256)."""
    n = 2.0 ** z
    x = (lon + 180.0) / 360.0 * n * TILE
    r = math.radians(lat)
    y = (1.0 - math.asinh(math.tan(r)) / math.pi) / 2.0 * n * TILE
    return x, y


def pick_zoom(pts):
    for z in range(15, 8, -1):
        xy = [proj(lon, lat, z) for lat, lon in pts]
        xs = [p[0] for p in xy]
        ys = [p[1] for p in xy]
        if (max(xs) - min(xs)) <= FRAME_W * FILL and (max(ys) - min(ys)) <= FRAME_H * FILL:
            return z
    return 9


def fetch_tile(z, x, y):
    sub = "abc"[(x + y) % 3]
    url = f"https://{sub}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png"
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return Image.open(io.BytesIO(r.read())).convert("RGBA")


def load_font(size, bold=False):
    names = ["Arial Bold.ttf"] if bold else ["Arial.ttf", "Arial Unicode.ttf"]
    for d in ("/System/Library/Fonts/Supplemental/", "/Library/Fonts/"):
        for n in names:
            p = d + n
            if os.path.exists(p):
                try:
                    return ImageFont.truetype(p, size)
                except Exception:
                    pass
    if os.path.exists("/System/Library/Fonts/Helvetica.ttc"):
        try:
            return ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", size)
        except Exception:
            pass
    return ImageFont.load_default()


def build_map(name, pts):
    z = pick_zoom(pts)
    xy = [proj(lon, lat, z) for lat, lon in pts]
    xs = [p[0] for p in xy]
    ys = [p[1] for p in xy]
    cx = (min(xs) + max(xs)) / 2
    cy = (min(ys) + max(ys)) / 2
    left = cx - FRAME_W / 2
    top = cy - FRAME_H / 2

    tx0, ty0 = int(left // TILE), int(top // TILE)
    tx1 = int((left + FRAME_W) // TILE)
    ty1 = int((top + FRAME_H) // TILE)

    canvas = Image.new("RGBA", ((tx1 - tx0 + 1) * TILE * SCALE, (ty1 - ty0 + 1) * TILE * SCALE))
    for tx in range(tx0, tx1 + 1):
        for ty in range(ty0, ty1 + 1):
            try:
                tile = fetch_tile(z, tx, ty)
            except Exception as e:
                print(f"  tile non scaricata z{z} {tx},{ty}: {e}")
                tile = Image.new("RGBA", (TILE * SCALE, TILE * SCALE), (245, 244, 242, 255))
            canvas.paste(tile, ((tx - tx0) * TILE * SCALE, (ty - ty0) * TILE * SCALE))
            time.sleep(0.05)

    ox = (left - tx0 * TILE) * SCALE
    oy = (top - ty0 * TILE) * SCALE
    img = canvas.crop((round(ox), round(oy),
                       round(ox + FRAME_W * SCALE), round(oy + FRAME_H * SCALE))).convert("RGB")
    W, H = img.size
    draw = ImageDraw.Draw(img, "RGBA")

    line = [((x - left) * SCALE, (y - top) * SCALE) for x, y in xy]
    draw.line(line, fill=(255, 255, 255, 235), width=16, joint="curve")
    draw.line(line, fill=ARANCIO + (255,), width=9, joint="curve")
    sx, sy = line[0]

    # etichetta "Partenza" sopra (o sotto) il punto di partenza
    lf = load_font(27, bold=True)
    label = "Partenza"
    lb = draw.textbbox((0, 0), label, font=lf)
    lw, lh = lb[2] - lb[0], lb[3] - lb[1]
    pad = 10
    bw, bh = lw + 2 * pad, lh + 2 * pad
    bx = min(max(8, sx - bw / 2), W - bw - 8)
    by = sy - 32 - bh
    if by < 8:
        by = sy + 32
    draw.rounded_rectangle((bx, by, bx + bw, by + bh), radius=9, fill=(255, 255, 255, 240))
    draw.text((bx + pad, by + pad - lb[1]), label, fill=INK + (255,), font=lf)

    # marcatore del punto di partenza
    for r, col in ((20, (255, 255, 255, 255)), (11, ARANCIO + (255,))):
        draw.ellipse((sx - r, sy - r, sx + r, sy + r), fill=col)

    # attribuzione cartografica
    txt = "© OpenStreetMap  © CARTO"
    af = load_font(15)
    tb = draw.textbbox((0, 0), txt, font=af)
    tw, th = tb[2] - tb[0], tb[3] - tb[1]
    p = 7
    draw.rectangle((W - tw - 2 * p - 5, H - th - 2 * p - 5, W - 5, H - 5), fill=(255, 255, 255, 205))
    draw.text((W - tw - p - 5, H - th - p - 5 - tb[1]), txt, fill=(120, 120, 118, 255), font=af)

    out = os.path.join(MAPPE, name + ".png")
    img.save(out)
    print(f"  mappa: zoom {z}, {len(pts)} punti -> {out} ({W}x{H})")


def build_qr(name, url):
    out = os.path.join(MAPPE, "qr-" + name + ".png")
    segno.make(url, error="m").save(out, scale=16, border=3, dark="#2a2723", light="#ffffff")
    print(f"  qr:    {out}  ->  {url}")


if __name__ == "__main__":
    for name, gpx in ROUTES:
        print(f"- {name}")
        pts, url = parse_gpx(os.path.join(TRACCE, gpx))
        build_map(name, pts)
        if url:
            build_qr(name, url)
        else:
            print("  ATTENZIONE: nessun link Wikiloc trovato nel GPX")
    print("Fatto.")
