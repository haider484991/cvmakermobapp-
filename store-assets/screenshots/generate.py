"""
Aurora Strata — Play Store Screenshot Generator
================================================

Generates the 8-frame premium screenshot series for FreeResume AI.
All output at 1080×1920 PNG. One script, one source of truth.
"""

from PIL import Image, ImageDraw, ImageFont, ImageFilter
from pathlib import Path
import os
import platform

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

W, H = 1080, 1920
OUT_DIR = Path(__file__).parent

# Aurora palette — calibrated cool gradient
TEAL_DEEP = (14, 58, 77)        # #0E3A4D
TEAL_PRIMARY = (8, 145, 178)    # #0891B2
CYAN = (6, 182, 212)            # #06B6D4
CYAN_LIGHT = (103, 232, 249)    # #67E8F9
CYAN_PALE = (207, 250, 254)     # #CFFAFE

INK = (15, 23, 42)               # body resume text
INK_LIGHT = (100, 116, 139)
WHITE = (255, 255, 255)
WHITE_80 = (255, 255, 255, 204)
WHITE_60 = (255, 255, 255, 153)
WHITE_25 = (255, 255, 255, 64)
WHITE_15 = (255, 255, 255, 38)
WHITE_08 = (255, 255, 255, 20)

AMBER = (251, 191, 36)
GREEN = (34, 197, 94)
RED = (239, 68, 68)
PURPLE = (124, 58, 237)


# ---------------------------------------------------------------------------
# Font loading
# ---------------------------------------------------------------------------

def _font_paths():
    """Return candidate paths to find a clean geometric sans-serif."""
    win = platform.system() == "Windows"
    if win:
        return [
            r"C:\Windows\Fonts\segoeuib.ttf",   # Segoe UI Bold
            r"C:\Windows\Fonts\segoeui.ttf",
            r"C:\Windows\Fonts\arialbd.ttf",
            r"C:\Windows\Fonts\arial.ttf",
        ]
    return [
        "/System/Library/Fonts/Helvetica.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ]


def font(size, weight="regular"):
    """Load a font at the given pixel size. Weight: regular | bold."""
    win = platform.system() == "Windows"
    if win:
        candidates = [
            r"C:\Windows\Fonts\segoeuib.ttf" if weight == "bold" else r"C:\Windows\Fonts\segoeui.ttf",
            r"C:\Windows\Fonts\arialbd.ttf" if weight == "bold" else r"C:\Windows\Fonts\arial.ttf",
        ]
    else:
        candidates = [
            "/System/Library/Fonts/Helvetica.ttc",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
            if weight == "bold"
            else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        ]
    for p in candidates:
        if Path(p).exists():
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                continue
    return ImageFont.load_default()


# ---------------------------------------------------------------------------
# Background — Aurora gradient
# ---------------------------------------------------------------------------

def make_gradient(variant=0):
    """
    Produce the Aurora gradient background. `variant` shifts the hue slightly
    so the 8-frame series feels alive without breaking visual continuity.
    """
    base = Image.new("RGB", (W, H), TEAL_DEEP)
    px = base.load()

    # Multi-stop vertical gradient with subtle horizontal bias by row.
    stops = [
        (0.00, TEAL_DEEP),
        (0.18, TEAL_PRIMARY),
        (0.55, CYAN),
        (0.85, CYAN_LIGHT),
        (1.00, CYAN_PALE),
    ]

    # Tiny variant-driven hue rotation through the stops.
    shift = (variant - 4) * 4

    def lerp(a, b, t):
        return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

    for y in range(H):
        t = y / (H - 1)
        # Find segment
        for i in range(len(stops) - 1):
            t0, c0 = stops[i]
            t1, c1 = stops[i + 1]
            if t0 <= t <= t1:
                local = (t - t0) / max(t1 - t0, 1e-6)
                base_color = lerp(c0, c1, local)
                # Apply tiny shift (clamped) — pushes toward more green or more blue
                base_color = (
                    max(0, min(255, base_color[0] + shift // 2)),
                    max(0, min(255, base_color[1] + shift // 3)),
                    max(0, min(255, base_color[2] - shift // 2)),
                )
                for x in range(W):
                    px[x, y] = base_color
                break

    # Add atmospheric radial glows on a separate RGBA layer
    glow_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow_layer)

    # Big soft top-right glow
    for r, alpha in [(900, 18), (720, 26), (540, 36), (380, 48), (240, 64), (140, 80)]:
        gd.ellipse(
            [W - 200 - r, -300 - r // 4, W - 200 + r, -300 - r // 4 + 2 * r],
            fill=(193, 245, 252, alpha),
        )

    # Lower-left subtle glow
    for r, alpha in [(700, 14), (520, 22), (360, 30), (220, 42), (120, 56)]:
        gd.ellipse(
            [-260 - r, H - 320 - r, -260 + r, H - 320 + r],
            fill=(167, 243, 250, alpha),
        )

    glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(38))

    final = Image.new("RGB", (W, H))
    final.paste(base)
    final.paste(glow_layer, (0, 0), glow_layer)

    return final


# ---------------------------------------------------------------------------
# Reusable primitives
# ---------------------------------------------------------------------------

def rounded_rect(draw_layer, xy, radius, fill=None, outline=None, width=1):
    """Wrapper for rounded rectangle that works on RGBA layers."""
    draw_layer.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)


def text_centered(draw, text, font_obj, y, color, x_center=W // 2):
    """Draw text horizontally centered at the given y."""
    bbox = draw.textbbox((0, 0), text, font=font_obj)
    tw = bbox[2] - bbox[0]
    x = x_center - tw // 2
    draw.text((x, y), text, font=font_obj, fill=color)
    return (x, y, x + tw, y + (bbox[3] - bbox[1]))


def text_wrapped_centered(draw, text, font_obj, y, color, max_width, line_gap=10):
    """Word-wrap text to a max pixel width, centered."""
    words = text.split()
    lines = []
    current = ""
    for w in words:
        trial = (current + " " + w).strip()
        bbox = draw.textbbox((0, 0), trial, font=font_obj)
        if bbox[2] - bbox[0] <= max_width:
            current = trial
        else:
            if current:
                lines.append(current)
            current = w
    if current:
        lines.append(current)

    line_height = font_obj.size + line_gap
    cy = y
    for line in lines:
        text_centered(draw, line, font_obj, cy, color)
        cy += line_height
    return cy


def soft_shadow_box(canvas, x, y, w, h, radius, blur=16, alpha=70, color=(0, 0, 0)):
    """Draw a soft drop shadow behind a rounded rect at the given canvas coords."""
    pad = blur * 2
    shadow = Image.new("RGBA", (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle(
        [pad, pad, pad + w, pad + h], radius=radius, fill=(*color, alpha)
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(blur))
    canvas.paste(shadow, (x - pad, y - pad + 6), shadow)


# ---------------------------------------------------------------------------
# Phone frame
# ---------------------------------------------------------------------------

PHONE_W = 540
PHONE_H = 1100
PHONE_RADIUS = 56


def draw_phone(canvas, draw, cx, cy, screen_painter):
    """
    Draw a clean phone mockup centered at (cx, cy). `screen_painter(s_canvas,
    s_draw, sx, sy, sw, sh)` is called to paint inside the screen area.
    """
    x = cx - PHONE_W // 2
    y = cy - PHONE_H // 2

    # Drop shadow
    soft_shadow_box(canvas, x, y + 8, PHONE_W, PHONE_H, PHONE_RADIUS, blur=28, alpha=110)

    # Outer bezel
    bezel = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    bd = ImageDraw.Draw(bezel)
    bd.rounded_rectangle(
        [x, y, x + PHONE_W, y + PHONE_H], radius=PHONE_RADIUS, fill=(15, 23, 42, 255)
    )
    # Thin highlight rim
    bd.rounded_rectangle(
        [x + 1, y + 1, x + PHONE_W - 1, y + PHONE_H - 1],
        radius=PHONE_RADIUS - 1,
        outline=(255, 255, 255, 30),
        width=2,
    )
    canvas.paste(bezel, (0, 0), bezel)

    # Screen area
    screen_pad = 14
    sx = x + screen_pad
    sy = y + screen_pad
    sw = PHONE_W - screen_pad * 2
    sh = PHONE_H - screen_pad * 2

    # Mask out a rounded screen so painting stays inside
    screen = Image.new("RGB", (sw, sh), (250, 252, 254))
    s_draw = ImageDraw.Draw(screen)

    # Top notch/island
    notch_w = 160
    notch_h = 28
    s_draw.rounded_rectangle(
        [sw // 2 - notch_w // 2, 14, sw // 2 + notch_w // 2, 14 + notch_h],
        radius=14,
        fill=(15, 23, 42),
    )

    # Call painter — origin is (0,0) inside screen
    screen_painter(screen, s_draw, sw, sh)

    # Round the screen corners by pasting through a rounded mask
    mask = Image.new("L", (sw, sh), 0)
    mdraw = ImageDraw.Draw(mask)
    mdraw.rounded_rectangle([0, 0, sw, sh], radius=PHONE_RADIUS - screen_pad, fill=255)
    canvas.paste(screen, (sx, sy), mask)


# ---------------------------------------------------------------------------
# Resume UI block (used inside phone screens)
# ---------------------------------------------------------------------------

def draw_resume_card(s_draw, x, y, w, h, accent=(8, 145, 178), variant="left-bar", scale=1.0):
    """Draw a miniature resume preview inside a card area."""
    f_small = font(int(11 * scale), "regular")
    f_xsmall = font(int(9 * scale), "regular")
    f_med = font(int(13 * scale), "bold")

    s_draw.rounded_rectangle([x, y, x + w, y + h], radius=int(10 * scale), fill=(255, 255, 255),
                             outline=(226, 232, 240), width=1)

    if variant == "sidebar":
        sb = int(w * 0.34)
        s_draw.rounded_rectangle([x, y, x + sb, y + h], radius=int(10 * scale), fill=accent)
        # Pretend it's only rounded on left — paint the right edge flat
        s_draw.rectangle([x + sb - 10, y, x + sb, y + h], fill=accent)
        # Avatar circle
        ar = int(min(sb - 16, 36) * scale)
        s_draw.ellipse(
            [x + sb // 2 - ar // 2, y + 14, x + sb // 2 + ar // 2, y + 14 + ar],
            fill=(255, 255, 255, 200),
        )
        # Sidebar text lines
        for i, ww in enumerate([0.7, 0.55, 0.65]):
            ly = y + 14 + ar + 10 + i * 8
            s_draw.rounded_rectangle(
                [x + 6, ly, x + 6 + int((sb - 12) * ww), ly + 4], radius=2, fill=(255, 255, 255, 200)
            )
        # Right side — text lines
        rx = x + sb + 10
        rw = w - sb - 16
        for i in range(7):
            lw = int(rw * (0.85 - (i % 3) * 0.1))
            ly = y + 14 + i * 12
            s_draw.rounded_rectangle([rx, ly, rx + lw, ly + 5], radius=2, fill=(203, 213, 225))

    elif variant == "banner":
        bh = int(h * 0.22)
        s_draw.rounded_rectangle([x, y, x + w, y + bh], radius=int(10 * scale), fill=accent)
        s_draw.rectangle([x, y + bh - 10, x + w, y + bh], fill=accent)
        # Lines
        for i in range(8):
            lw = int((w - 24) * (0.8 - (i % 3) * 0.12))
            ly = y + bh + 12 + i * 11
            s_draw.rounded_rectangle([x + 12, ly, x + 12 + lw, ly + 4], radius=2, fill=(203, 213, 225))

    elif variant == "split":
        sw = int(w * 0.4)
        s_draw.rounded_rectangle([x, y, x + sw, y + h], radius=int(10 * scale), fill=accent)
        s_draw.rectangle([x + sw - 10, y, x + sw, y + h], fill=accent)
        # Right column lines
        rx = x + sw + 8
        rw = w - sw - 14
        for i in range(9):
            lw = int(rw * (0.85 - (i % 3) * 0.08))
            ly = y + 12 + i * 11
            s_draw.rounded_rectangle([rx, ly, rx + lw, ly + 4], radius=2, fill=(203, 213, 225))

    elif variant == "timeline":
        # Left rail
        rx = x + 18
        s_draw.line([rx, y + 12, rx, y + h - 12], fill=accent, width=2)
        for i in range(5):
            cy = y + 18 + i * 18
            s_draw.ellipse([rx - 4, cy - 4, rx + 4, cy + 4], fill=accent)
            s_draw.rounded_rectangle(
                [rx + 10, cy - 3, rx + 10 + int(w * 0.55), cy + 1], radius=2, fill=(15, 23, 42)
            )
            s_draw.rounded_rectangle(
                [rx + 10, cy + 4, rx + 10 + int(w * 0.42), cy + 7], radius=2, fill=(148, 163, 184)
            )

    elif variant == "two-col":
        # 40/60 split with vertical hairline
        midx = x + int(w * 0.4)
        s_draw.line([midx, y + 14, midx, y + h - 14], fill=(226, 232, 240), width=1)
        # Header line (full width)
        s_draw.rounded_rectangle([x + 10, y + 12, x + 10 + int(w * 0.5), y + 17], radius=2, fill=(15, 23, 42))
        s_draw.rounded_rectangle([x + 10, y + 20, x + 10 + int(w * 0.35), y + 24], radius=2, fill=accent)
        # Left col
        for i in range(5):
            ly = y + 36 + i * 12
            s_draw.rounded_rectangle([x + 10, ly, x + midx - 8, ly + 4], radius=2, fill=(203, 213, 225))
        # Right col
        for i in range(7):
            ly = y + 36 + i * 12
            s_draw.rounded_rectangle([midx + 8, ly, x + w - 10, ly + 4], radius=2, fill=(203, 213, 225))

    else:  # left-bar / classic
        s_draw.rounded_rectangle([x, y, x + 4, y + h], radius=2, fill=accent)
        # Header
        s_draw.rounded_rectangle([x + 12, y + 12, x + 12 + int(w * 0.55), y + 17], radius=2, fill=(15, 23, 42))
        s_draw.rounded_rectangle([x + 12, y + 20, x + 12 + int(w * 0.4), y + 24], radius=2, fill=accent)
        # Section title underline
        s_draw.rounded_rectangle([x + 12, y + 34, x + 12 + 50, y + 38], radius=2, fill=accent)
        # Body lines
        for i in range(7):
            lw = int((w - 24) * (0.85 - (i % 3) * 0.1))
            ly = y + 46 + i * 11
            s_draw.rounded_rectangle([x + 12, ly, x + 12 + lw, ly + 4], radius=2, fill=(203, 213, 225))


# ---------------------------------------------------------------------------
# Common screenshot scaffold
# ---------------------------------------------------------------------------

def base_frame(variant):
    """Return a (canvas, draw) tuple with gradient + glows applied."""
    canvas = make_gradient(variant).convert("RGBA")
    return canvas, ImageDraw.Draw(canvas)


def draw_headline(draw, headline, subhead, top_y=140, headline_size=96, subhead_size=44):
    """Stack a wrapped headline + subhead at the top of the frame."""
    f_head = font(headline_size, "bold")
    f_sub = font(subhead_size, "regular")

    end_y = text_wrapped_centered(
        draw, headline, f_head, top_y, WHITE, max_width=920, line_gap=4
    )
    text_wrapped_centered(
        draw, subhead, f_sub, end_y + 22, (224, 242, 254), max_width=860, line_gap=4
    )
    return end_y


def draw_brand_footer(canvas, draw, badge_text="Free · No subscription"):
    """Bottom area: small wordmark + pill badge."""
    f_brand = font(28, "bold")
    f_pill = font(22, "regular")

    # Wordmark
    text_centered(draw, "FreeResume AI", f_brand, H - 130, WHITE)

    # Pill badge
    bbox = draw.textbbox((0, 0), badge_text, font=f_pill)
    pw = bbox[2] - bbox[0] + 44
    ph = 50
    px = W // 2 - pw // 2
    py = H - 88

    pill = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    pd = ImageDraw.Draw(pill)
    pd.rounded_rectangle(
        [px, py, px + pw, py + ph], radius=ph // 2, fill=WHITE_15, outline=WHITE_25, width=1
    )
    canvas.paste(pill, (0, 0), pill)

    text_centered(draw, badge_text, f_pill, py + 14, WHITE_80)


# ---------------------------------------------------------------------------
# SCREENSHOT 1 — Hero / "Stand Out With 22 Premium Templates"
# ---------------------------------------------------------------------------

def screen_01():
    canvas, draw = base_frame(0)

    draw_headline(
        draw,
        "Stand Out With 22 Premium Templates",
        "All free. All ATS-ready.",
        top_y=140,
        headline_size=92,
    )

    # Fanned cards behind the phone
    fan_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    fan_d = ImageDraw.Draw(fan_layer)

    def fan_card(x, y, angle, accent, variant):
        # Render a card on its own layer then rotate
        cw, ch = 360, 480
        card = Image.new("RGBA", (cw + 40, ch + 40), (0, 0, 0, 0))
        cdraw = ImageDraw.Draw(card)
        # Shadow
        sh = Image.new("RGBA", (cw + 80, ch + 80), (0, 0, 0, 0))
        shd = ImageDraw.Draw(sh)
        shd.rounded_rectangle([20, 20, 20 + cw, 20 + ch], radius=18, fill=(0, 0, 0, 80))
        sh = sh.filter(ImageFilter.GaussianBlur(16))
        # Composite card on top
        result = Image.new("RGBA", (cw + 80, ch + 80), (0, 0, 0, 0))
        result.paste(sh, (0, 0), sh)
        cdraw2 = ImageDraw.Draw(result)
        draw_resume_card(cdraw2, 40, 40, cw, ch, accent=accent, variant=variant, scale=1.4)
        rotated = result.rotate(angle, resample=Image.BICUBIC, expand=True)
        return rotated

    # Place fan cards
    c1 = fan_card(0, 0, -12, (124, 58, 237), "sidebar")
    c2 = fan_card(0, 0, 14, (234, 88, 12), "banner")
    canvas.paste(c1, (40, 740), c1)
    canvas.paste(c2, (W - c2.size[0] - 40, 760), c2)

    # Phone in front — templates grid screen
    def screen_painter(s, sd, sw, sh):
        # Top bar
        sd.text((24, 70), "Templates", font=font(26, "bold"), fill=(15, 23, 42))
        sd.text((24, 104), "22 designs · 5 categories", font=font(16), fill=(100, 116, 139))
        # 2x4 grid of mini templates
        gx = 22
        gy = 156
        gap = 14
        cell_w = (sw - gx * 2 - gap) // 2
        cell_h = 196
        variants = [
            ((8, 145, 178), "left-bar"),
            ((124, 58, 237), "sidebar"),
            ((234, 88, 12), "banner"),
            ((22, 163, 74), "split"),
            ((220, 38, 38), "timeline"),
            ((37, 99, 235), "two-col"),
            ((163, 28, 175), "sidebar"),
            ((71, 85, 105), "left-bar"),
        ]
        for i, (accent, variant) in enumerate(variants):
            col = i % 2
            row = i // 2
            cx = gx + col * (cell_w + gap)
            cy = gy + row * (cell_h + 12)
            draw_resume_card(sd, cx, cy, cell_w, cell_h, accent=accent, variant=variant, scale=1.0)

    draw_phone(canvas, draw, W // 2, 1180, screen_painter)

    draw_brand_footer(canvas, draw, "Free · No subscription · No watermark")

    return canvas


# ---------------------------------------------------------------------------
# SCREENSHOT 2 — "Upload Your Old Resume"
# ---------------------------------------------------------------------------

def screen_02():
    canvas, draw = base_frame(1)

    draw_headline(
        draw,
        "Upload Your Old Resume",
        "AI rebuilds it in 10 seconds.",
        top_y=140,
    )

    # "Powered by AI" badge near the headline
    f_badge = font(22, "bold")
    bbox = draw.textbbox((0, 0), "POWERED BY AI", font=f_badge)
    pw = bbox[2] - bbox[0] + 32
    px = W // 2 - pw // 2
    py = 410

    badge = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    bd = ImageDraw.Draw(badge)
    bd.rounded_rectangle([px, py, px + pw, py + 42], radius=21, fill=(251, 191, 36, 230))
    canvas.paste(badge, (0, 0), badge)
    text_centered(draw, "POWERED BY AI", f_badge, py + 9, (15, 23, 42))

    def screen_painter(s, sd, sw, sh):
        # Title
        sd.text((24, 72), "Import Resume", font=font(26, "bold"), fill=(15, 23, 42))
        sd.text((24, 106), "Your old PDF → polished CV", font=font(15), fill=(100, 116, 139))

        # Before card (faded)
        bx, by, bw, bh = 30, 180, 200, 270
        sd.rounded_rectangle([bx, by, bx + bw, by + bh], radius=12,
                             fill=(241, 245, 249), outline=(203, 213, 225), width=1)
        sd.text((bx + 24, by + 16), "old.pdf", font=font(14, "bold"), fill=(100, 116, 139))
        # Faint document lines
        for i in range(8):
            ly = by + 50 + i * 24
            sd.rounded_rectangle([bx + 16, ly, bx + bw - 16, ly + 6],
                                 radius=3, fill=(203, 213, 225))

        # Arrow + sparkles
        arrow_y = by + bh // 2
        sd.text((bx + bw + 6, arrow_y - 18), "→", font=font(56, "bold"), fill=(8, 145, 178))
        # Sparkles
        for sx, sy_, ss in [(bx + bw + 12, arrow_y - 36, 8), (bx + bw + 42, arrow_y + 16, 6),
                            (bx + bw + 24, arrow_y + 28, 4)]:
            sd.polygon(
                [(sx, sy_ - ss), (sx + ss / 2, sy_), (sx, sy_ + ss), (sx - ss / 2, sy_)],
                fill=(251, 191, 36),
            )

        # After card (polished, color)
        ax, ay, aw, ah = sw - bw - 30, by, bw, bh
        draw_resume_card(sd, ax, ay, aw, ah, accent=(8, 145, 178), variant="sidebar", scale=1.0)

        # Bottom — "10 seconds" timer card
        ty = by + bh + 32
        sd.rounded_rectangle([24, ty, sw - 24, ty + 100], radius=14,
                             fill=(240, 253, 250), outline=(167, 243, 250), width=1)
        sd.text((44, ty + 22), "10 SECONDS", font=font(26, "bold"), fill=(8, 145, 178))
        sd.text((44, ty + 58), "Fully parsed, fully editable", font=font(15), fill=(100, 116, 139))
        # Big check mark
        cx_ = sw - 78
        cy_ = ty + 50
        sd.ellipse([cx_ - 28, cy_ - 28, cx_ + 28, cy_ + 28], fill=(34, 197, 94))
        sd.line([cx_ - 12, cy_ + 2, cx_ - 4, cy_ + 10], fill="white", width=5)
        sd.line([cx_ - 4, cy_ + 10, cx_ + 14, cy_ - 10], fill="white", width=5)

    draw_phone(canvas, draw, W // 2, 1200, screen_painter)

    draw_brand_footer(canvas, draw)
    return canvas


# ---------------------------------------------------------------------------
# SCREENSHOT 3 — AI Resume Score
# ---------------------------------------------------------------------------

def screen_03():
    canvas, draw = base_frame(2)

    draw_headline(
        draw,
        "Get an Instant AI Resume Score",
        "See exactly how to improve it.",
        top_y=140,
    )

    def screen_painter(s, sd, sw, sh):
        # Header
        sd.text((24, 72), "AI Resume Analysis", font=font(24, "bold"), fill=(15, 23, 42))

        # Score ring
        cx, cy = sw // 2, 234
        radius = 78
        sd.ellipse([cx - radius, cy - radius, cx + radius, cy + radius],
                   outline=(226, 232, 240), width=10)
        # Drawn arc — pseudo at 82%
        sd.arc([cx - radius, cy - radius, cx + radius, cy + radius],
               start=270, end=270 + int(360 * 0.82), fill=(34, 197, 94), width=10)
        sd.text((cx - 36, cy - 28), "82", font=font(60, "bold"), fill=(34, 197, 94))
        sd.text((cx - 14, cy + 24), "/ 100", font=font(13), fill=(100, 116, 139))

        # Headline below ring
        sd.text((24, 340), "Good Resume", font=font(20, "bold"), fill=(15, 23, 42))
        # ATS badge
        sd.rounded_rectangle([sw - 134, 342, sw - 24, 374], radius=16,
                             fill=(240, 253, 244), outline=(167, 243, 250), width=1)
        sd.text((sw - 124, 350), "ATS PASS  85%", font=font(13, "bold"), fill=(34, 197, 94))

        # Category bars
        cats = [("Content Quality", 85, (34, 197, 94)),
                ("Formatting", 92, (34, 197, 94)),
                ("Keywords", 68, (251, 191, 36)),
                ("Impact", 78, (34, 197, 94)),
                ("Completeness", 80, (34, 197, 94))]
        by = 400
        for i, (label, val, c) in enumerate(cats):
            ly = by + i * 38
            sd.text((24, ly), label, font=font(13), fill=(71, 85, 105))
            sd.text((sw - 56, ly), f"{val}%", font=font(13, "bold"), fill=(15, 23, 42))
            # Bar bg
            sd.rounded_rectangle([24, ly + 22, sw - 24, ly + 28], radius=3, fill=(226, 232, 240))
            # Bar fill
            fw = int((sw - 48) * val / 100)
            sd.rounded_rectangle([24, ly + 22, 24 + fw, ly + 28], radius=3, fill=c)

        # Strengths panel
        py = by + len(cats) * 38 + 16
        sd.rounded_rectangle([24, py, sw - 24, py + 90], radius=10,
                             fill=(240, 253, 244), outline=(187, 247, 208), width=1)
        sd.text((40, py + 14), "STRENGTHS", font=font(11, "bold"), fill=(22, 101, 52))
        sd.text((40, py + 36), "• Quantified achievements", font=font(13), fill=(20, 83, 45))
        sd.text((40, py + 58), "• Strong action verbs", font=font(13), fill=(20, 83, 45))

        # Improvements
        py2 = py + 102
        sd.rounded_rectangle([24, py2, sw - 24, py2 + 90], radius=10,
                             fill=(255, 251, 235), outline=(253, 224, 71), width=1)
        sd.text((40, py2 + 14), "IMPROVE", font=font(11, "bold"), fill=(146, 64, 14))
        sd.text((40, py2 + 36), "• Add more keywords for ATS", font=font(13), fill=(146, 64, 14))
        sd.text((40, py2 + 58), "• Quantify 2 more bullets", font=font(13), fill=(146, 64, 14))

    draw_phone(canvas, draw, W // 2, 1180, screen_painter)
    draw_brand_footer(canvas, draw, "AI-powered · Personalized tips")
    return canvas


# ---------------------------------------------------------------------------
# SCREENSHOT 4 — AI Writing
# ---------------------------------------------------------------------------

def screen_04():
    canvas, draw = base_frame(3)

    draw_headline(
        draw,
        "AI Writes Better Than You",
        "Smart suggestions for every section.",
        top_y=140,
    )

    def screen_painter(s, sd, sw, sh):
        # v1.5.1 — show the new in-app top bar with Preview pill + step
        # indicator so the screenshot truthfully reflects what users see.
        sd.text((20, 60), "← FreeResume AI", font=font(13, "bold"), fill=(15, 23, 42))
        # Preview pill on the right
        sd.rounded_rectangle([sw - 110, 54, sw - 22, 82], radius=14,
                             fill=(8, 145, 178, 25), outline=(8, 145, 178, 80), width=1)
        sd.text((sw - 96, 60), "Preview", font=font(13, "bold"), fill=(8, 145, 178))

        # Step indicator + section title hero
        sd.text((24, 100), "STEP 3 OF 5", font=font(11, "bold"), fill=(8, 145, 178))
        sd.text((24, 118), "Experience", font=font(24, "bold"), fill=(15, 23, 42))
        # Progress bar
        sd.rounded_rectangle([24, 154, sw - 24, 158], radius=2, fill=(226, 232, 240))
        sd.rounded_rectangle([24, 154, 24 + int((sw - 48) * 0.6), 158], radius=2, fill=(8, 145, 178))

        # Underlying experience card (semi-faded)
        sd.rounded_rectangle([24, 180, sw - 24, 360], radius=12,
                             fill=(248, 250, 252), outline=(226, 232, 240), width=1)
        sd.text((40, 198), "Senior Product Designer", font=font(15, "bold"), fill=(15, 23, 42))
        sd.text((40, 222), "Acme Corp · 2021–Present", font=font(12), fill=(100, 116, 139))
        for i in range(4):
            sd.rounded_rectangle([40, 254 + i * 22, sw - 40, 258 + i * 22],
                                 radius=2, fill=(203, 213, 225))

        # AI suggestion modal floating
        mx, my, mw, mh = 14, 380, sw - 28, 380
        # Shadow
        sd.rounded_rectangle([mx + 4, my + 8, mx + mw + 4, my + mh + 8],
                             radius=18, fill=(15, 23, 42, 60))
        # Card
        sd.rounded_rectangle([mx, my, mx + mw, my + mh], radius=18,
                             fill=(255, 255, 255), outline=(8, 145, 178), width=2)

        # Header inside modal
        # Sparkle icon
        sx_, sy_ = mx + 28, my + 28
        sd.ellipse([sx_, sy_, sx_ + 32, sy_ + 32], fill=(124, 58, 237))
        sd.text((sx_ + 9, sy_ + 4), "✦", font=font(20, "bold"), fill="white")
        sd.text((mx + 76, my + 28), "AI SUGGESTIONS", font=font(13, "bold"), fill=(124, 58, 237))
        sd.text((mx + 76, my + 50), "Pick a bullet to add", font=font(13), fill=(100, 116, 139))

        # Suggestion list items
        suggestions = [
            "Led redesign of checkout flow, increasing conversion by 23%",
            "Mentored 4 junior designers across 2 product teams",
            "Launched component library used across 8 internal apps",
        ]
        for i, sug in enumerate(suggestions):
            iy = my + 96 + i * 78
            sd.rounded_rectangle([mx + 16, iy, mx + mw - 16, iy + 66],
                                 radius=10, fill=(240, 249, 255),
                                 outline=(186, 230, 253), width=1)
            # Tiny sparkle
            sd.ellipse([mx + 30, iy + 24, mx + 46, iy + 40], fill=(8, 145, 178))
            sd.text((mx + 32, iy + 22), "✦", font=font(12, "bold"), fill="white")
            # Wrap text into the card
            words = sug.split()
            line = ""
            ly = iy + 14
            for w in words:
                trial = (line + " " + w).strip()
                bbox = sd.textbbox((0, 0), trial, font=font(12))
                if bbox[2] - bbox[0] > mw - 90:
                    sd.text((mx + 58, ly), line, font=font(12), fill=(15, 23, 42))
                    ly += 16
                    line = w
                else:
                    line = trial
            if line:
                sd.text((mx + 58, ly), line, font=font(12), fill=(15, 23, 42))

        # Apply pill
        ay = my + mh - 56
        sd.rounded_rectangle([mx + 16, ay, mx + mw - 16, ay + 40],
                             radius=20, fill=(8, 145, 178))
        sd.text((mx + mw // 2 - 38, ay + 11), "Apply All", font=font(15, "bold"), fill="white")

    draw_phone(canvas, draw, W // 2, 1180, screen_painter)
    draw_brand_footer(canvas, draw, "AI-powered writing")
    return canvas


# ---------------------------------------------------------------------------
# SCREENSHOT 5 — 22 Designs For Every Industry
# ---------------------------------------------------------------------------

def screen_05():
    canvas, draw = base_frame(4)

    draw_headline(
        draw,
        "22 Designs For Every Industry",
        "Tech · Finance · Creative · Academic",
        top_y=140,
    )

    def screen_painter(s, sd, sw, sh):
        sd.text((24, 72), "Pick a Template", font=font(24, "bold"), fill=(15, 23, 42))
        # Category chips
        chips = ["All", "Modern", "Pro", "ATS", "Creative"]
        cx = 24
        for c in chips:
            bbox = sd.textbbox((0, 0), c, font=font(12, "bold"))
            cw = bbox[2] - bbox[0] + 22
            fill = (8, 145, 178) if c == "All" else (241, 245, 249)
            tc = (255, 255, 255) if c == "All" else (71, 85, 105)
            sd.rounded_rectangle([cx, 108, cx + cw, 138], radius=15, fill=fill)
            sd.text((cx + 11, 116), c, font=font(12, "bold"), fill=tc)
            cx += cw + 6

        # 2x3 grid of distinct templates
        gx = 22
        gy = 162
        gap = 16
        cell_w = (sw - gx * 2 - gap) // 2
        cell_h = 232
        variants = [
            ((8, 145, 178), "sidebar"),       # Modern Pro
            ((234, 88, 12), "banner"),         # Startup Bold
            ((15, 23, 42), "left-bar"),        # Classic
            ((147, 51, 234), "timeline"),      # Timeline
            ((37, 99, 235), "two-col"),        # Designer Grid
            ((22, 163, 74), "split"),          # Sleek
        ]
        names = ["Modern Pro", "Startup Bold", "ATS Classic", "Timeline", "Two-Column", "Split"]
        for i, ((accent, variant), name) in enumerate(zip(variants, names)):
            col = i % 2
            row = i // 2
            cx_ = gx + col * (cell_w + gap)
            cy_ = gy + row * (cell_h + 20)
            draw_resume_card(sd, cx_, cy_, cell_w, cell_h - 20, accent=accent, variant=variant)
            sd.text((cx_ + 4, cy_ + cell_h - 18),
                    name, font=font(12, "bold"), fill=(15, 23, 42))

    draw_phone(canvas, draw, W // 2, 1180, screen_painter)
    draw_brand_footer(canvas, draw, "22 templates · all free")
    return canvas


# ---------------------------------------------------------------------------
# SCREENSHOT 6 — Export to PDF
# ---------------------------------------------------------------------------

def screen_06():
    canvas, draw = base_frame(5)

    draw_headline(
        draw,
        "Export to PDF in One Tap",
        "US Letter or A4. Yours to keep.",
        top_y=140,
    )

    def screen_painter(s, sd, sw, sh):
        sd.text((24, 72), "Export Resume", font=font(24, "bold"), fill=(15, 23, 42))

        # Big resume preview
        draw_resume_card(sd, 36, 130, sw - 72, 530,
                         accent=(8, 145, 178), variant="sidebar", scale=1.5)

        # Paper size pills
        py = 686
        sizes = [("Letter", True), ("A4", False)]
        cx = 32
        for label, sel in sizes:
            bbox = sd.textbbox((0, 0), label, font=font(15, "bold"))
            pw = bbox[2] - bbox[0] + 36
            if sel:
                sd.rounded_rectangle([cx, py, cx + pw, py + 44], radius=12,
                                     fill=(8, 145, 178))
                sd.text((cx + 18, py + 12), label, font=font(15, "bold"), fill="white")
            else:
                sd.rounded_rectangle([cx, py, cx + pw, py + 44], radius=12,
                                     fill=(241, 245, 249))
                sd.text((cx + 18, py + 12), label, font=font(15, "bold"), fill=(71, 85, 105))
            cx += pw + 12

        # Big download button
        by = py + 76
        sd.rounded_rectangle([24, by, sw - 24, by + 64], radius=18,
                             fill=(8, 145, 178))
        sd.text((sw // 2 - 76, by + 22), "Download PDF", font=font(17, "bold"), fill="white")

    draw_phone(canvas, draw, W // 2, 1180, screen_painter)

    # Decorative floating PDF icon to the right of phone
    px = W - 200
    py = 940
    sd2 = draw
    sd2.rounded_rectangle([px, py, px + 130, py + 170], radius=12,
                          fill=(255, 255, 255, 230), outline=(207, 250, 254), width=2)
    sd2.text((px + 18, py + 22), "PDF", font=font(40, "bold"), fill=(8, 145, 178))
    for i in range(5):
        ly = py + 86 + i * 16
        sd2.rounded_rectangle([px + 18, ly, px + 112, ly + 4], radius=2, fill=(203, 213, 225))

    draw_brand_footer(draw=draw, canvas=canvas, badge_text="PDF · Letter · A4")
    return canvas


# ---------------------------------------------------------------------------
# SCREENSHOT 7 — Beat the ATS
# ---------------------------------------------------------------------------

def screen_07():
    canvas, draw = base_frame(6)

    draw_headline(
        draw,
        "Beat the Applicant Tracking System",
        "Every template is ATS-optimized.",
        top_y=140,
        headline_size=84,
    )

    def screen_painter(s, sd, sw, sh):
        sd.text((24, 72), "Resume · ATS Check", font=font(22, "bold"), fill=(15, 23, 42))

        # Big ATS PASS badge
        sd.rounded_rectangle([24, 120, sw - 24, 200], radius=14,
                             fill=(240, 253, 244), outline=(167, 243, 250), width=2)
        sd.ellipse([44, 138, 92, 186], fill=(34, 197, 94))
        sd.line([56, 162, 66, 172], fill="white", width=5)
        sd.line([66, 172, 84, 154], fill="white", width=5)
        sd.text((108, 138), "ATS PASS", font=font(22, "bold"), fill=(22, 101, 52))
        sd.text((108, 168), "92% compatibility score", font=font(14), fill=(22, 101, 52))

        # Resume body
        draw_resume_card(sd, 36, 230, sw - 72, 450, accent=(8, 145, 178),
                         variant="left-bar", scale=1.5)

        # Check stamps
        for i, label in enumerate(["No tables", "Clean fonts", "Single column"]):
            iy = 690 + i * 36
            sd.ellipse([28, iy, 56, iy + 28], fill=(34, 197, 94))
            sd.line([34, iy + 14, 41, iy + 21], fill="white", width=3)
            sd.line([41, iy + 21, 50, iy + 8], fill="white", width=3)
            sd.text((68, iy + 4), label, font=font(14, "bold"), fill=(15, 23, 42))

    draw_phone(canvas, draw, W // 2, 1180, screen_painter)

    # Floating check badges around the phone
    badges = [
        (120, 760, "Keyword-rich"),
        (W - 280, 800, "Parser-friendly"),
        (160, 1240, "ATS-tested"),
        (W - 260, 1280, "Clean format"),
    ]
    for (bx, by, text) in badges:
        bbox = draw.textbbox((0, 0), text, font=font(20, "bold"))
        bw = bbox[2] - bbox[0] + 56
        bh = 50
        pill = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        pd = ImageDraw.Draw(pill)
        pd.rounded_rectangle([bx, by, bx + bw, by + bh], radius=bh // 2,
                             fill=(255, 255, 255, 240), outline=(167, 243, 250), width=2)
        canvas.paste(pill, (0, 0), pill)
        # Check
        draw.ellipse([bx + 12, by + 12, bx + 38, by + 38], fill=(34, 197, 94))
        draw.line([bx + 18, by + 25, bx + 23, by + 30], fill="white", width=3)
        draw.line([bx + 23, by + 30, bx + 32, by + 19], fill="white", width=3)
        draw.text((bx + 46, by + 14), text, font=font(18, "bold"), fill=(15, 23, 42))

    draw_brand_footer(canvas, draw, "ATS-friendly by default")
    return canvas


# ---------------------------------------------------------------------------
# SCREENSHOT 8 — CTA
# ---------------------------------------------------------------------------

def screen_08():
    canvas, draw = base_frame(7)

    draw_headline(
        draw,
        "Land Your Next Interview",
        "Join thousands building winning resumes.",
        top_y=140,
    )

    def screen_painter(s, sd, sw, sh):
        sd.text((24, 72), "My Resumes", font=font(24, "bold"), fill=(15, 23, 42))
        sd.text((24, 104), "Pick up where you left off", font=font(14), fill=(100, 116, 139))

        # Premium import hero card (matches in-app design)
        sd.rounded_rectangle([24, 150, sw - 24, 290], radius=18,
                             fill=(8, 145, 178))
        sd.text((44, 174), "AI POWERED", font=font(11, "bold"), fill=(207, 250, 254))
        sd.text((44, 198), "Have a resume already?", font=font(18, "bold"), fill="white")
        sd.text((44, 230), "Upload PDF, Word or photo —", font=font(13), fill=(207, 250, 254))
        sd.text((44, 250), "AI rebuilds it in 10 seconds.", font=font(13), fill=(207, 250, 254))
        # Right icon
        sd.rounded_rectangle([sw - 100, 188, sw - 44, 244], radius=16,
                             fill=(255, 255, 255, 60))
        sd.text((sw - 88, 196), "↑", font=font(38, "bold"), fill="white")

        # Create card
        sd.rounded_rectangle([24, 304, sw - 24, 390], radius=16,
                             fill=(255, 255, 255), outline=(226, 232, 240), width=1)
        sd.rounded_rectangle([44, 326, 88, 370], radius=12, fill=(207, 250, 254))
        sd.text((58, 332), "+", font=font(28, "bold"), fill=(8, 145, 178))
        sd.text((108, 332), "Start from Scratch", font=font(16, "bold"), fill=(15, 23, 42))
        sd.text((108, 358), "Build a new resume with AI", font=font(12), fill=(100, 116, 139))

        # Recent resume card
        sd.rounded_rectangle([24, 410, sw - 24, 540], radius=16,
                             fill=(255, 255, 255), outline=(226, 232, 240), width=1)
        # Mini preview
        draw_resume_card(sd, 38, 426, 84, 100, accent=(8, 145, 178),
                         variant="sidebar", scale=0.9)
        sd.text((140, 432), "Senior Designer", font=font(15, "bold"), fill=(15, 23, 42))
        sd.text((140, 458), "Modern Pro · 4 sections", font=font(12), fill=(100, 116, 139))
        # Progress bar
        sd.rounded_rectangle([140, 488, sw - 50, 494], radius=3, fill=(226, 232, 240))
        sd.rounded_rectangle([140, 488, 140 + 220, 494], radius=3, fill=(34, 197, 94))
        sd.text((140, 502), "85% complete", font=font(11, "bold"), fill=(34, 197, 94))

        # Score row
        sd.rounded_rectangle([24, 560, sw - 24, 660], radius=16,
                             fill=(240, 253, 244), outline=(187, 247, 208), width=1)
        sd.ellipse([42, 582, 110, 650], outline=(34, 197, 94), width=6)
        sd.text((60, 594), "82", font=font(28, "bold"), fill=(34, 197, 94))
        sd.text((132, 588), "Resume Score", font=font(15, "bold"), fill=(22, 101, 52))
        sd.text((132, 614), "Tap for AI tips", font=font(12), fill=(20, 83, 45))

        # Stars row
        sy = 690
        for i in range(5):
            sx = 24 + i * 28
            sd.polygon(
                [
                    (sx + 12, sy),
                    (sx + 16, sy + 8),
                    (sx + 24, sy + 9),
                    (sx + 18, sy + 16),
                    (sx + 20, sy + 24),
                    (sx + 12, sy + 20),
                    (sx + 4, sy + 24),
                    (sx + 6, sy + 16),
                    (sx + 0, sy + 9),
                    (sx + 8, sy + 8),
                ],
                fill=(251, 191, 36),
            )
        sd.text((168, sy + 4), "4.7 · 10,000+ downloads",
                font=font(13, "bold"), fill=(15, 23, 42))

    draw_phone(canvas, draw, W // 2, 1180, screen_painter)

    # Big "Get Started Free" pill below the phone
    bw_, bh_ = 480, 78
    bx_ = W // 2 - bw_ // 2
    by_ = 1740
    soft_shadow_box(canvas, bx_, by_, bw_, bh_, 39, blur=22, alpha=80)
    pill = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    pd = ImageDraw.Draw(pill)
    pd.rounded_rectangle([bx_, by_, bx_ + bw_, by_ + bh_], radius=39, fill=WHITE)
    canvas.paste(pill, (0, 0), pill)
    text_centered(draw, "Get Started Free", font(30, "bold"), by_ + 22, TEAL_DEEP)

    # Subtle footer text below
    text_centered(draw, "FreeResume AI", font(22, "bold"), by_ + bh_ + 24, WHITE_80)

    return canvas


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------

def main():
    screens = [
        ("screenshot-01-hero.png", screen_01),
        ("screenshot-02-import.png", screen_02),
        ("screenshot-03-score.png", screen_03),
        ("screenshot-04-ai-writing.png", screen_04),
        ("screenshot-05-templates.png", screen_05),
        ("screenshot-06-export.png", screen_06),
        ("screenshot-07-ats.png", screen_07),
        ("screenshot-08-cta.png", screen_08),
    ]

    for name, fn in screens:
        print(f"Rendering {name}...")
        img = fn()
        # Final check — force exact size
        if img.size != (W, H):
            print(f"  WARN: size was {img.size}, resizing")
            img = img.resize((W, H), Image.LANCZOS)
        img = img.convert("RGB")
        out_path = OUT_DIR / name
        img.save(out_path, "PNG", optimize=True)
        print(f"  -> {out_path} ({out_path.stat().st_size // 1024} KB)")

    print("\nDone — 8 screenshots written.")


if __name__ == "__main__":
    main()
