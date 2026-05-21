#!/usr/bin/env python3
"""Genera le immagini delle mappe dei percorsi dell'opuscolo dai file GPX.

Basemap: CARTO Positron (light) su dati OpenStreetMap. La traccia e il punto di
partenza sono disegnati sopra. Le mappe vengono salvate in mappe/<nome>.png.

Le mappe NON sono disegnate a memoria: la linea del percorso e' la traccia GPS
reale del file GPX, il fondo cartografico e' OpenStreetMap. Uso una tantum.

    python3 genera-mappe.py
"""
import io
import math
import os
import time
import urllib.request
import xml.etree.ElementTree as ET

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

FRAME_W, FRAME_H = 720, 450        # frame in geo-pixel (tile da 256) -> immagine 1440x900
FILL = 0.80                        # quota del frame occupata dalla traccia
TILE = 256
SCALE = 2                          # tile @2x: immagine finale ad alta risoluzione
ARANCIO = (234, 88, 12)            # #EA580C, arancio brand
UA = "ArfantaBikeRental-opuscolo/1.0 (mappe percorsi, uso una tantum)"


def parse_gpx(path):
    pts = []
    for _, el in ET.iterparse(path):
        if el.tag.split("}")[-1] == "trkpt":
            pts.append((float(el.get("lat")), float(el.get("lon"))))
            el.clear()
    return pts


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


def load_font(size):
    for p in (
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/Library/Fonts/Arial.ttf",
    ):
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                pass
    return ImageFont.load_default()


def build(name, gpx):
    print(f"- {name}")
    pts = parse_gpx(os.path.join(TRACCE, gpx))
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

    draw = ImageDraw.Draw(img, "RGBA")
    line = [((x - left) * SCALE, (y - top) * SCALE) for x, y in xy]
    draw.line(line, fill=(255, 255, 255, 235), width=16, joint="curve")
    draw.line(line, fill=ARANCIO + (255,), width=9, joint="curve")

    sx, sy = line[0]
    for r, col in ((19, (255, 255, 255, 255)), (11, ARANCIO + (255,))):
        draw.ellipse((sx - r, sy - r, sx + r, sy + r), fill=col)

    txt = "© OpenStreetMap  © CARTO"
    font = load_font(15)
    tb = draw.textbbox((0, 0), txt, font=font)
    tw, th = tb[2] - tb[0], tb[3] - tb[1]
    W, H = img.size
    pad = 7
    draw.rectangle((W - tw - 2 * pad - 5, H - th - 2 * pad - 5, W - 5, H - 5),
                   fill=(255, 255, 255, 205))
    draw.text((W - tw - pad - 5, H - th - pad - 5 - tb[1]), txt,
              fill=(120, 120, 118, 255), font=font)

    out = os.path.join(MAPPE, name + ".png")
    img.save(out)
    print(f"  zoom {z}, {len(pts)} punti -> {out} ({img.size[0]}x{img.size[1]})")


if __name__ == "__main__":
    for name, gpx in ROUTES:
        build(name, gpx)
    print("Fatto.")
