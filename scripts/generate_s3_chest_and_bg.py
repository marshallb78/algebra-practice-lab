import json
import os
import shutil
import sys
import time
from pathlib import Path
from PIL import Image
from rembg import new_session

sys.path.insert(0, str(Path(__file__).resolve().parent))
from comfy_s3_lib import COMFY_URL, build_qwen_workflow, remove_bg_high_quality, run_comfy_job  # noqa: E402

COMFY_INPUT_DIR = Path(r"C:\Users\geoff\AppData\Local\Comfy-Desktop\ComfyUI-Shared\input")
CHEST_DIR = Path(r"w:\Mathew Clicker\public\images\s3\chest")
CHEST_DIR.mkdir(parents=True, exist_ok=True)
EVENTS_DIR = Path(r"w:\Mathew Clicker\public\images\s3\events")
EVENTS_DIR.mkdir(parents=True, exist_ok=True)
S3_DIR = Path(r"w:\Mathew Clicker\public\images\s3")
S3_DIR.mkdir(parents=True, exist_ok=True)

NEG_ICON = (
    "text, watermark, border, frame, gray background, colored background, gradient background, "
    "drop shadow on floor, clutter, blurry, 3d realistic render, human"
)


def wait_for_comfy(timeout_sec: int = 90) -> bool:
    import urllib.request
    t0 = time.time()
    while time.time() - t0 < timeout_sec:
        try:
            with urllib.request.urlopen(f"{COMFY_URL}/system_stats", timeout=2) as r:
                if r.status == 200:
                    return True
        except Exception:
            pass
        time.sleep(2.0)
    return False


def main():
    if not wait_for_comfy(120):
        print("ERROR: ComfyUI did not start within 120s")
        sys.exit(1)

    print("ComfyUI online! Loading BiRefNet-General session...", flush=True)
    sess = new_session("birefnet-general")

    # 1. Closed Marvel Chest (base reference)
    closed_out = CHEST_DIR / "marvel_chest_closed.png"
    t0 = time.time()
    wf_closed = build_qwen_workflow(
        prompt=(
            "2D stylized Marvel comic-game treasure chest asset, front three-quarter angle, completely closed lid. "
            "Armored crimson red Stark Vibranium plating with gleaming gold Infinity trim and a glowing purple-gold "
            "Avengers lock emblem in the center, crisp cel-shaded 2D outlines, centered and completely visible, "
            "isolated on pure solid white #FFFFFF background."
        ),
        negative_prompt=NEG_ICON + ", open lid, glowing beam inside",
        filename_prefix="s3_chest_closed",
        seed=881001,
        ref_image=None,
        resolution=640,
        steps=18,
    )
    raw_closed = run_comfy_job(wf_closed)
    # Copy clean white-bg raw closed chest into ComfyUI input folder as our consistent reference!
    COMFY_INPUT_DIR.mkdir(parents=True, exist_ok=True)
    ref_filename = "marvel_chest_ref.png"
    shutil.copyfile(raw_closed, COMFY_INPUT_DIR / ref_filename)
    remove_bg_high_quality(raw_closed, str(closed_out), sess, target_size=512)
    print(f"[1/6] Closed chest OK ({time.time() - t0:.1f}s)", flush=True)

    # 2. In-between animation frames referenced directly from closed chest!
    frames = [
        (
            "marvel_chest_f1.png",
            881002,
            "Keep the exact same 2D Marvel crimson-and-gold chest from Image 1 at the exact same camera angle, size, and position. "
            "Show the chest lid slightly cracked open by 15 degrees with purple-gold Infinity cosmic light glowing brightly out of the crack. "
            "Pure solid white #FFFFFF background.",
        ),
        (
            "marvel_chest_f2.png",
            881003,
            "Keep the exact same 2D Marvel crimson-and-gold chest from Image 1 at the exact same camera angle, size, and position. "
            "Show the chest lid halfway open at 50 degrees with a bright golden-violet Infinity energy beam and sparkling cosmic light pouring upward from inside. "
            "Pure solid white #FFFFFF background.",
        ),
        (
            "marvel_chest_open.png",
            881004,
            "Keep the exact same 2D Marvel crimson-and-gold chest from Image 1 at the exact same camera angle, size, and position. "
            "Show the chest lid thrown fully wide open at 105 degrees with radiant golden treasure, gems, and blazing Infinity light bursting from inside. "
            "Pure solid white #FFFFFF background.",
        ),
    ]
    for idx, (fname, seed, prompt) in enumerate(frames, 2):
        tf = time.time()
        wf = build_qwen_workflow(
            prompt=prompt,
            negative_prompt=NEG_ICON,
            filename_prefix=f"s3_chest_{idx}",
            seed=seed,
            ref_image=ref_filename,
            resolution=640,
            steps=18,
        )
        raw_f = run_comfy_job(wf)
        remove_bg_high_quality(raw_f, str(CHEST_DIR / fname), sess, target_size=512)
        print(f"[{idx}/6] {fname} OK ({time.time() - tf:.1f}s)", flush=True)

    # 3. Dr. Strange Dark Ice Event Icon
    t_ice = time.time()
    wf_ice = build_qwen_workflow(
        prompt=(
            "2D Marvel comic game icon: Doctor Strange Mirror Dimension Dark Ice crystal trap — jagged obsidian-purple "
            "and emerald dark ice shards wrapped in glowing golden Doctor Strange eldritch mandala runes, "
            "centered on pure solid white #FFFFFF background."
        ),
        negative_prompt=NEG_ICON + ", snow, snowman, blue sky",
        filename_prefix="s3_dark_ice",
        seed=881055,
        ref_image=None,
        resolution=512,
        steps=16,
    )
    raw_ice = run_comfy_job(wf_ice)
    remove_bg_high_quality(raw_ice, str(EVENTS_DIR / "attack_time_freeze.png"), sess, target_size=256)
    print(f"[5/6] Dr. Strange Dark Ice icon OK ({time.time() - t_ice:.1f}s)", flush=True)

    # 4. Iconic Marvel Cosmic Avengers Tower Skyline Scene Background
    t_bg = time.time()
    wf_bg = build_qwen_workflow(
        prompt=(
            "Epic wide comic-book cinematic Marvel scene backdrop: the iconic futuristic Stark Avengers Tower rising in the center "
            "of the New York City skyline at dramatic cosmic twilight, huge swirling purple-gold-and-crimson Bifrost multiverse portal "
            "nebula and golden lightning clouds glowing high in the night sky, glowing red and gold city lights, vibrant high-contrast artwork, "
            "no characters, no text, no letters, no watermark, no logos with text."
        ),
        negative_prompt="text, letters, watermark, signature, logo words, blurry, lowres, snow, winter, icebergs, white void",
        filename_prefix="s3_marvel_bg",
        seed=881099,
        ref_image=None,
        resolution=1024,
        steps=20,
    )
    # Adjust EmptyLatentImage for widescreen aspect cleanly (1024x576)
    wf_bg["459:456"]["inputs"]["width"] = 1024
    wf_bg["459:456"]["inputs"]["height"] = 576
    raw_bg = run_comfy_job(wf_bg, timeout_sec=240)
    bg_img = Image.open(raw_bg).convert("RGB").resize((1280, 720), Image.Resampling.LANCZOS)
    bg_img.save(S3_DIR / "marvel_bg.jpg", format="JPEG", quality=88, optimize=True)
    print(f"[6/6] Marvel background OK ({time.time() - t_bg:.1f}s)", flush=True)
    print("ALL S3 CHEST & BG ASSETS DONE!")


if __name__ == "__main__":
    main()
