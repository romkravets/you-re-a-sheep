"""Procedural "skincare ad" background for the p1-ad clip. No AI, no third-party assets.

Needs numpy and pillow (e.g. in a venv: `pip install numpy pillow`).
Usage:
  python scripts/make-ad-clip.py /tmp/adframes   # writes frame_000.png ... (720x1280, 25 fps, 5 s)
  ffmpeg -framerate 25 -i /tmp/adframes/frame_%03d.png -vf format=yuv420p -an \
    -c:v libvpx-vp9 -crf 42 -b:v 420k -row-mt 1 public/clips/p1-ad.webm
  ffmpeg -framerate 25 -i /tmp/adframes/frame_%03d.png -vf format=yuv420p -an \
    -c:v libx264 -crf 30 -maxrate 400k -bufsize 800k -preset slow -movflags +faststart public/clips/p1-ad.mp4
  ffmpeg -i /tmp/adframes/frame_000.png -q:v 5 public/clips/p1-ad.jpg
"""
import math
import os
import sys

import numpy as np
from PIL import Image

W, H, FPS, SECONDS = 720, 1280, 25, 5
N = FPS * SECONDS
rng = np.random.default_rng(7)

yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)


def lerp(a, b, t):
    return a + (b - a) * t


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def blend(img, color, alpha):
    """img: HxWx3 float, color: (3,) or HxWx3, alpha: HxW in 0..1."""
    a = alpha[..., None]
    return img * (1 - a) + np.asarray(color, np.float32) * a


# --- background palette (blush → peach → lilac), slowly drifting
C1 = np.array([247, 198, 210], np.float32)  # blush pink
C2 = np.array([253, 226, 212], np.float32)  # peach
C3 = np.array([232, 205, 236], np.float32)  # soft lilac


def background(t):
    phase = 0.5 + 0.5 * math.sin(2 * math.pi * t / SECONDS)
    d = (xx / W * 0.45 + yy / H * 0.85)  # diagonal
    d = d + 0.06 * np.sin(yy / H * 6.0 + t * 1.3)
    top = lerp(C1, C3, phase * 0.6)
    g = smoothstep(0.0, 1.3, d)[..., None]
    img = top * (1 - g) + C2 * g
    # soft centre glow where the drop lands
    glow = np.exp(-(((xx - W * 0.68) / (W * 0.55)) ** 2 + ((yy - H * 0.70) / (H * 0.38)) ** 2))
    img = blend(img, (255, 244, 240), glow * 0.55)
    # vignette
    vig = ((xx / W - 0.5) ** 2 + (yy / H - 0.5) ** 2 * 0.6)
    img = blend(img, (226, 160, 178), smoothstep(0.10, 0.50, vig) * 0.35)
    return img


# --- bokeh circles drifting up
BOKEH = [
    dict(x=rng.uniform(0, W), y=rng.uniform(0, H + 300), r=rng.uniform(18, 95),
         a=rng.uniform(0.10, 0.28), v=rng.uniform(40, 120), sway=rng.uniform(8, 30),
         ph=rng.uniform(0, 6.28))
    for _ in range(22)
]


def bokeh(img, t):
    for b in BOKEH:
        span = H + 2 * b["r"] + 200
        cy = (b["y"] - b["v"] * t) % span - b["r"] - 100
        cx = b["x"] + b["sway"] * math.sin(t * 1.1 + b["ph"])
        x0, x1 = int(max(cx - b["r"] - 3, 0)), int(min(cx + b["r"] + 3, W))
        y0, y1 = int(max(cy - b["r"] - 3, 0)), int(min(cy + b["r"] + 3, H))
        if x0 >= x1 or y0 >= y1:
            continue
        dx = xx[y0:y1, x0:x1] - cx
        dy = yy[y0:y1, x0:x1] - cy
        dist = np.sqrt(dx * dx + dy * dy)
        disc = 1 - smoothstep(b["r"] - 3, b["r"] + 1, dist)
        rim = np.exp(-((dist - b["r"] * 0.92) / 3.0) ** 2) * 0.6
        alpha = (disc * 0.55 + rim) * b["a"]
        img[y0:y1, x0:x1] = blend(img[y0:y1, x0:x1], (255, 255, 255), alpha)
    return img


# --- twinkling sparkles (4-point stars)
SPARK = [dict(x=rng.uniform(W * 0.4, W - 60), y=rng.uniform(H * 0.62, H * 0.92),
              s=rng.uniform(7, 16), ph=rng.uniform(0, 6.28), f=rng.uniform(1.2, 2.4))
         for _ in range(9)]


def sparkles(img, t):
    for s in SPARK:
        k = max(0.0, math.sin(t * s["f"] * 2 + s["ph"])) ** 3
        if k < 0.02:
            continue
        r = s["s"] * (0.6 + 0.6 * k)
        x0, x1 = int(max(s["x"] - r * 2, 0)), int(min(s["x"] + r * 2, W))
        y0, y1 = int(max(s["y"] - r * 2, 0)), int(min(s["y"] + r * 2, H))
        dx = np.abs(xx[y0:y1, x0:x1] - s["x"])
        dy = np.abs(yy[y0:y1, x0:x1] - s["y"])
        star = np.exp(-(dx * dy) / (r * 0.9)) * np.exp(-(dx + dy) / (r * 1.4))
        img[y0:y1, x0:x1] = blend(img[y0:y1, x0:x1], (255, 255, 255), np.clip(star * k, 0, 1))
    return img


# --- the serum drop and its ripples
LAND = (W * 0.70, H * 0.78)
TIP = (W * 0.70, H * 0.215)  # pipette tip
DROPS = [(0.75, 1.55), (3.05, 3.85)]  # (start, landing time) in seconds
R = 44.0


def drop_alpha(u, v, r):
    """Teardrop half-width profile; u = horizontal, v = vertical (down +), origin at bulb centre."""
    circ = r * np.sqrt(np.clip(1 - (v / r) ** 2, 0, 1))
    tail_len = 2.4 * r
    taper = r * np.clip((v + tail_len) / tail_len, 0, 1) ** 1.7
    w = np.where(v >= 0, circ, np.maximum(circ * (v > -r), taper))
    w = np.where(v < -tail_len, 0, w)
    return smoothstep(-1.2, 1.2, w - np.abs(u))


def draw_drop(img, cx, cy, stretch):
    r = R
    x0, x1 = int(max(cx - r - 4, 0)), int(min(cx + r + 4, W))
    y0, y1 = int(max(cy - 2.6 * r * stretch - 4, 0)), int(min(cy + r + 4, H))
    if x0 >= x1 or y0 >= y1:
        return img
    u = xx[y0:y1, x0:x1] - cx
    v = (yy[y0:y1, x0:x1] - cy) / stretch
    a = drop_alpha(u, v, r)
    # body: translucent rose with darker rim and bright highlight
    dist = np.sqrt(u * u + np.minimum(v, 0) ** 2 * 0.25 + np.maximum(v, 0) ** 2) / r
    body = np.stack([lerp(255, 214, dist), lerp(196, 108, dist), lerp(206, 138, dist)], -1)
    patch = img[y0:y1, x0:x1]
    out = blend(patch, body, a * 0.9)
    hl = np.exp(-(((u + 0.35 * r) / (0.22 * r)) ** 2 + ((v + 0.25 * r) / (0.32 * r)) ** 2))
    out = blend(out, (255, 255, 255), hl * a * 0.95)
    hl2 = np.exp(-(((u - 0.38 * r) / (0.12 * r)) ** 2 + ((v - 0.45 * r) / (0.10 * r)) ** 2))
    out = blend(out, (255, 255, 255), hl2 * a * 0.6)
    img[y0:y1, x0:x1] = out
    return img


def draw_drop_scaled(img, cx, cy, k):
    global R
    saved, R = R, R * k
    try:
        return draw_drop(img, cx, cy, 1.0)
    finally:
        R = saved


def ripples(img, age):
    """Elliptical rings on the 'skin' surface after a landing; age in seconds."""
    for k, delay in enumerate((0.0, 0.22, 0.44)):
        a_t = age - delay
        if a_t <= 0:
            continue
        rad = 22 + 190 * (1 - math.exp(-a_t * 1.6))
        fade = math.exp(-a_t * 1.1) * (1 - 0.25 * k)
        if fade < 0.02:
            continue
        dx = (xx - LAND[0]) / rad
        dy = (yy - LAND[1]) / (rad * 0.32)
        d = np.sqrt(dx * dx + dy * dy)
        ring = np.exp(-((d - 1) * rad / 4.5) ** 2)
        img = blend(img, (255, 255, 255), np.clip(ring * fade * 1.0, 0, 1))
        shade = np.exp(-((d - 1.06) * rad / 4.0) ** 2)
        img = blend(img, (205, 120, 150), np.clip(shade * fade * 0.45, 0, 1))
    if age < 0.35:  # little splash glow
        g = np.exp(-(((xx - LAND[0]) / 60) ** 2 + ((yy - LAND[1]) / 22) ** 2)) * (1 - age / 0.35)
        img = blend(img, (255, 255, 255), g * 0.8)
    return img


def pipette(img, t):
    """Glass dropper hanging from the top: rose rubber bulb + translucent glass tube."""
    sway = 3.0 * math.sin(t * 1.4)
    cx = TIP[0] + sway
    # glass tube
    tube_top, tube_bot = H * 0.035, TIP[1]
    in_y = (yy >= tube_top) & (yy <= tube_bot)
    taper = np.clip((yy - tube_top) / (tube_bot - tube_top), 0, 1)
    half = 15 - 9 * taper ** 3
    d = np.abs(xx - cx)
    glass = (1 - smoothstep(half - 1.2, half + 1.2, d)) * in_y
    img = blend(img, (255, 248, 250), glass * 0.42)
    edge = np.exp(-((d - half + 1.5) / 1.4) ** 2) * in_y
    img = blend(img, (255, 255, 255), edge * 0.85)
    shine = np.exp(-((xx - cx + half * 0.45) / 2.2) ** 2) * in_y
    img = blend(img, (255, 255, 255), shine * 0.6)
    # serum inside the lower part of the tube
    fill = (1 - smoothstep(half - 4, half - 2, d)) * (yy > tube_top + (tube_bot - tube_top) * 0.55) * in_y
    img = blend(img, (240, 150, 175), fill * 0.75)
    # rubber bulb
    bx, by = cx, H * 0.0
    e = ((xx - bx) / 30) ** 2 + ((yy - by) / 52) ** 2
    bulb = 1 - smoothstep(0.92, 1.05, e)
    img = blend(img, (196, 112, 132), bulb)
    hl = np.exp(-(((xx - bx + 11) / 6) ** 2 + ((yy - by - 20) / 14) ** 2)) * bulb
    img = blend(img, (240, 190, 200), hl * 0.8)
    collar = (np.abs(yy - H * 0.04) < 7) & (np.abs(xx - cx) < 22)
    img = blend(img, (225, 196, 160), collar.astype(np.float32) * 0.95)  # gold ring
    return img


def frame(i):
    t = i / FPS
    img = background(t)
    img = bokeh(img, t)
    # landing pool: a faint glossy ellipse that is always there
    pool = np.exp(-(((xx - LAND[0]) / 170) ** 2 + ((yy - LAND[1]) / 40) ** 2))
    img = blend(img, (255, 238, 242), pool * 0.6)
    for start, land in DROPS:
        if t >= land:
            img = ripples(img, t - land)
    img = pipette(img, t)
    for start, land in DROPS:
        if start <= t < land:
            p = (t - start) / (land - start)
            y = lerp(TIP[1] + R * 0.6, LAND[1] - R * 0.6, p * p)  # accelerating fall
            img = draw_drop(img, LAND[0], y, 1.0 + 0.3 * p)
        elif t < start and start - t < 0.7:
            # drop swelling at the pipette tip before it falls
            grow = 1 - (start - t) / 0.7
            img = draw_drop_scaled(img, LAND[0], TIP[1] + R * 0.6 * grow, 0.35 + 0.65 * grow)
    img = sparkles(img, t)
    grain = rng.normal(0, 2.2, (H, W, 1)).astype(np.float32)
    return np.clip(img + grain, 0, 255).astype(np.uint8)


if __name__ == "__main__":
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    for i in range(N):
        Image.fromarray(frame(i)).save(os.path.join(out, f"frame_{i:03d}.png"))
    print("frames:", N)
