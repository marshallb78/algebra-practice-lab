import math
import os
import random
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

S3_DIR = Path(r"w:\Mathew Clicker\public\images\s3")
GAUNTLET_DIR = S3_DIR / "gauntlet"
UPGRADES_DIR = S3_DIR / "upgrades"


def build_simple_marvel_bg():
    """Creates a clean, simpler dark cosmic Marvel nebula backdrop (1280x720, zero busy buildings)."""
    W, H = 1280, 720
    img = Image.new("RGB", (W, H), (5, 3, 14))
    px = img.load()

    # Smooth cosmic gradient from deep space top to subtle crimson-violet horizon
    for y in range(H):
        t = y / (H - 1)
        r = int(5 + 34 * (t ** 1.6))
        g = int(3 + 8 * (t ** 1.4))
        b = int(16 + 38 * math.sin(t * math.pi * 0.85))
        for x in range(W):
            px[x, y] = (r, g, b)

    # Soft nebula blooms
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    nebulae = [
        (320, 260, 340, (168, 85, 247, 58)),
        (940, 220, 360, (220, 38, 38, 48)),
        (640, 420, 420, (245, 158, 11, 34)),
    ]
    for cx, cy, rad, col in nebulae:
        od.ellipse((cx - rad, cy - rad, cx + rad, cy + rad), fill=col)
    overlay = overlay.filter(ImageFilter.GaussianBlur(95))
    img = Image.alpha_composite(img.convert("RGBA"), overlay)

    # Subtle distant stars (lightweight & clean)
    rng = random.Random(42)
    sd = ImageDraw.Draw(img)
    for _ in range(110):
        sx = rng.randint(0, W - 1)
        sy = rng.randint(0, H - 1)
        sr = rng.choice([1, 1, 1, 2])
        sa = rng.randint(90, 210)
        sd.ellipse((sx - sr, sy - sr, sx + sr, sy + sr), fill=(255, 250, 235, sa))

    img.convert("RGB").save(S3_DIR / "marvel_bg.jpg", format="JPEG", quality=88, optimize=True)
    print("Saved simpler marvel_bg.jpg")


def build_loading_m_gauntlet():
    """Creates the big Avengers-style 'M' ring logo with the Infinity Gauntlet centered on dark obsidian."""
    W, H = 512, 512
    canvas = Image.new("RGBA", (W, H), (4, 10, 23, 255))

    # Outer crimson-gold glow
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((66, 66, 446, 446), fill=(220, 38, 38, 70))
    gd.ellipse((116, 116, 396, 396), fill=(251, 191, 36, 75))
    glow = glow.filter(ImageFilter.GaussianBlur(34))
    canvas = Image.alpha_composite(canvas, glow)

    # Supersampled 2x vector Avengers-style ring + sharp 'M'
    S = 1024
    vec = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    vd = ImageDraw.Draw(vec)

    # Outer ring
    vd.ellipse((120, 120, 904, 904), outline=(245, 158, 11, 255), width=38)
    vd.ellipse((160, 160, 864, 864), outline=(220, 38, 38, 255), width=22)

    # Giant Avengers-style beveled 'M'
    m_poly = [
        (220, 820),
        (220, 240),
        (365, 240),
        (512, 520),
        (659, 240),
        (804, 240),
        (804, 820),
        (676, 820),
        (676, 465),
        (548, 710),
        (476, 710),
        (348, 465),
        (348, 820),
    ]
    vd.polygon(m_poly, fill=(185, 28, 28, 255), outline=(253, 224, 71, 255), width=12)
    # Sharp Avengers arrow crossbar accent
    vd.polygon([(140, 560), (884, 560), (920, 515), (140, 515)], fill=(251, 191, 36, 235))

    vec_small = vec.resize((W, H), Image.Resampling.LANCZOS)
    canvas = Image.alpha_composite(canvas, vec_small)

    # Composite actual Infinity Gauntlet cleanly in front
    gauntlet_path = GAUNTLET_DIR / "infinity_gauntlet.png"
    if gauntlet_path.exists():
        g_img = Image.open(gauntlet_path).convert("RGBA").resize((280, 280), Image.Resampling.LANCZOS)
        canvas.alpha_composite(g_img, (116, 172))

    canvas.save(S3_DIR / "loading_m_gauntlet.png", format="PNG", optimize=True)
    print("Saved loading_m_gauntlet.png")


def build_progressive_gauntlets():
    """Creates gauntlet_1.png .. gauntlet_6.png keeping the exact same glove position with stones lighting up."""
    base_path = GAUNTLET_DIR / "infinity_gauntlet.png"
    base = Image.open(base_path).convert("RGBA").resize((512, 512), Image.Resampling.LANCZOS)

    # Exact socket coordinates on 512x512 gauntlet (knuckles + thumb + center)
    stones_order = [
        ("stone_power.png", (118, 174), 48, (168, 85, 247)),
        ("stone_space.png", (196, 138), 48, (56, 189, 248)),
        ("stone_reality.png", (276, 138), 48, (244, 63, 94)),
        ("stone_soul.png", (346, 174), 48, (251, 146, 60)),
        ("stone_time.png", (392, 294), 48, (52, 211, 153)),
        ("stone_mind.png", (246, 268), 66, (250, 204, 21)),
    ]

    for count in range(1, 7):
        frame = base.copy()
        glow_layer = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
        gd = ImageDraw.Draw(glow_layer)
        for s_file, (sx, sy), sz, rgb in stones_order[:count]:
            rad = int(sz * 0.95)
            gd.ellipse((sx - rad, sy - rad, sx + rad, sy + rad), fill=(rgb[0], rgb[1], rgb[2], 195))
        glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(14))
        frame = Image.alpha_composite(frame, glow_layer)

        for s_file, (sx, sy), sz, _ in stones_order[:count]:
            sp = GAUNTLET_DIR / s_file
            if sp.exists():
                s_img = Image.open(sp).convert("RGBA").resize((sz, sz), Image.Resampling.LANCZOS)
                frame.alpha_composite(s_img, (sx - sz // 2, sy - sz // 2))

        frame.save(GAUNTLET_DIR / f"gauntlet_{count}.png", format="PNG", optimize=True)
    print("Saved gauntlet_1.png .. gauntlet_6.png")


def build_unique_upgrade_icons():
    """Creates unique 256x256 Marvel emblem icons for s3_u_25 .. s3_u_51 so zero upgrades share an image."""
    UPGRADES_DIR.mkdir(parents=True, exist_ok=True)
    palettes = [
        ((220, 38, 38), (251, 191, 36)),   # Iron/Stark
        ((37, 99, 235), (248, 250, 252)),  # Cap
        ((22, 163, 74), (163, 230, 53)),   # Gamma
        ((147, 51, 234), (216, 180, 254)), # Wakanda/Power
        ((234, 88, 12), (253, 224, 71)),   # Strange/Eldritch
        ((15, 23, 42), (226, 232, 240)),   # Symbiote/Stealth
        ((190, 18, 60), (253, 164, 175)),  # Scarlet Chaos
        ((14, 165, 233), (186, 230, 253)), # Cosmic/Tesseract
    ]
    for idx in range(25, 52):
        out = UPGRADES_DIR / f"s3_u_{idx:02d}.png"
        c1, c2 = palettes[(idx - 25) % len(palettes)]
        shape_kind = (idx - 25) % 6
        S = 512
        im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)

        # Metallic outer shield/hex emblem
        d.ellipse((46, 46, 466, 466), fill=(12, 16, 32, 255), outline=c2, width=20)
        d.ellipse((78, 78, 434, 434), fill=c1, outline=(255, 255, 255, 190), width=8)

        if shape_kind == 0:  # Star / Shield core
            pts = []
            for k in range(10):
                ang = math.radians(k * 36 - 90)
                rad = 125 if k % 2 == 0 else 52
                pts.append((256 + math.cos(ang) * rad, 256 + math.sin(ang) * rad))
            d.polygon(pts, fill=c2, outline=(255, 255, 255, 230), width=6)
        elif shape_kind == 1:  # Lightning / Energy bolt
            bolt = [(280, 110), (170, 270), (248, 270), (215, 405), (345, 235), (266, 235)]
            d.polygon(bolt, fill=c2, outline=(255, 255, 255, 230), width=6)
        elif shape_kind == 2:  # Diamond / Cosmic Gem
            gem = [(256, 112), (376, 256), (256, 400), (136, 256)]
            d.polygon(gem, fill=c2, outline=(255, 255, 255, 230), width=6)
        elif shape_kind == 3:  # Twin Blades / Claws
            for ox in (-66, 0, 66):
                d.polygon([(242 + ox, 125), (270 + ox, 125), (262 + ox, 385), (250 + ox, 385)], fill=c2)
        elif shape_kind == 4:  # Eldritch Mandala Ring
            d.ellipse((146, 146, 366, 366), outline=c2, width=16)
            d.polygon([(256, 130), (366, 320), (146, 320)], outline=c2, width=10)
        else:  # Reactor Core
            d.ellipse((150, 150, 362, 362), fill=(15, 23, 42, 235), outline=c2, width=18)
            d.ellipse((202, 202, 310, 310), fill=c2)

        im.resize((256, 256), Image.Resampling.LANCZOS).save(out, format="PNG", optimize=True)
    print("Saved s3_u_25.png .. s3_u_51.png")


if __name__ == "__main__":
    build_simple_marvel_bg()
    build_loading_m_gauntlet()
    build_progressive_gauntlets()
    build_unique_upgrade_icons()
