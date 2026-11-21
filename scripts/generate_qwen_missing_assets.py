import copy
import json
import os
import shutil
import sys
import time
from PIL import Image
from rembg import new_session

sys.path.insert(0, os.path.dirname(__file__))
from comfy_s3_lib import (
    COMFY_OUTPUT_DIR,
    remove_bg_high_quality,
    run_comfy_job,
)

WORKFLOW_TEMPLATE_PATH = os.path.join(os.path.dirname(__file__), "comfy_qwen_workflow.json")
COMFY_INPUT_DIR = r"C:\Users\geoff\AppData\Local\Comfy-Desktop\ComfyUI-Shared\input"
PUBLIC_S3_DIR = r"W:\Mathew Clicker\public\images\s3"


def build_workflow_from_saved_json(
    prompt: str,
    negative_prompt: str,
    filename_prefix: str,
    seed: int,
    ref_image: str | None = None,
    width: int = 1024,
    height: int = 1024,
    steps: int = 24,
) -> dict:
    with open(WORKFLOW_TEMPLATE_PATH, "r", encoding="utf-8") as f:
        wf = json.load(f)

    # Remove UI-only compare/unused nodes
    wf.pop("472", None)
    wf.pop("475", None)
    wf.pop("459:500", None)
    wf.pop("459:485", None)
    wf.pop("459:477", None)
    wf.pop("459:479", None)

    wf["461"]["inputs"]["filename_prefix"] = filename_prefix
    wf["459:456"]["inputs"]["width"] = width
    wf["459:456"]["inputs"]["height"] = height
    wf["459:458"]["inputs"]["seed"] = seed
    wf["459:458"]["inputs"]["steps"] = steps

    # Bypass TextGenerate (459:500) by feeding prompt directly into 459:474
    wf.pop("459:480", None)
    wf.pop("459:484", None)
    wf["459:474"]["inputs"]["prompt"] = prompt
    wf["459:474"]["inputs"]["negative_prompt"] = negative_prompt
    wf["459:474"]["inputs"]["resolution"] = max(width, height)

    if ref_image:
        wf["470"]["inputs"]["image"] = ref_image
        wf["459:474"]["inputs"]["images.image_1"] = ["470", 0]
        wf["459:468"]["inputs"]["switch"] = False
    else:
        wf.pop("470", None)
        wf["459:474"]["inputs"].pop("images.image_1", None)
        wf["459:468"]["inputs"]["switch"] = True

    return wf


def main() -> None:
    os.makedirs(COMFY_INPUT_DIR, exist_ok=True)
    os.makedirs(os.path.join(PUBLIC_S3_DIR, "gauntlet"), exist_ok=True)

    print("Loading BiRefNet background removal session...")
    sess = new_session("birefnet-general")

    # 1. Simpler cosmic Marvel background
    print("\n[1/8] Generating simpler cosmic Marvel background...")
    bg_wf = build_workflow_from_saved_json(
        prompt=(
            "A clean, cinematic deep-space cosmic Marvel nebula background in 16:9 widescreen. "
            "Smooth dark indigo, deep violet, and subtle crimson-gold cosmic clouds with soft distant stars. "
            "Minimalist, uncluttered, dark atmospheric lighting, no buildings, no skyline, no characters, "
            "no text, no logos, smooth gradient edges suitable for a game UI backdrop."
        ),
        negative_prompt=(
            "buildings, city, skyline, skyscrapers, busy details, characters, faces, people, text, "
            "logo, watermark, bright white areas, clutter, frame, border"
        ),
        filename_prefix="s3_marvel_bg_qwen",
        seed=303101,
        ref_image=None,
        width=1344,
        height=768,
        steps=22,
    )
    bg_raw = run_comfy_job(bg_wf)
    bg_out = os.path.join(PUBLIC_S3_DIR, "marvel_bg.jpg")
    Image.open(bg_raw).convert("RGB").save(bg_out, format="JPEG", quality=92, optimize=True)
    print(f"Saved {bg_out}")

    # 2. Loading screen Avengers-style "M" + Infinity Gauntlet emblem
    print("\n[2/8] Generating Avengers-style 'M' + Infinity Gauntlet loading emblem...")
    logo_wf = build_workflow_from_saved_json(
        prompt=(
            "A bold, iconic metallic superhero emblem shaped like a giant Avengers-style letter 'M' "
            "in brushed silver-titanium and crimson-gold trim with a subtle glowing arc-reactor ring behind it, "
            "with the golden Infinity Gauntlet gripping forward in front of the center of the 'M' with all six "
            "glowing Infinity Stones (purple, blue, red, orange, green, yellow). "
            "High-quality 3D game logo render, crisp metallic bevels, clean edges, centered on a pure solid white (#FFFFFF) background."
        ),
        negative_prompt=(
            "letter A, Avengers A logo, extra words, small text, watermark, person, face, background scene, "
            "gray background, dark background, cropped edges"
        ),
        filename_prefix="s3_loading_m_gauntlet_qwen",
        seed=303102,
        ref_image=None,
        width=1024,
        height=1024,
        steps=24,
    )
    logo_raw = run_comfy_job(logo_wf)
    logo_out = os.path.join(PUBLIC_S3_DIR, "loading_m_gauntlet.png")
    remove_bg_high_quality(logo_raw, logo_out, sess, target_size=640)
    print(f"Saved {logo_out}")

    # 3. Consistent Progressive Gauntlet 1..6
    print("\n[3/8] Generating base Infinity Gauntlet (1 stone lit)...")
    g1_wf = build_workflow_from_saved_json(
        prompt=(
            "A single upright golden Infinity Gauntlet facing straight forward, upright open-palm/fist-forward game icon pose, "
            "intricate Uru gold armor plates and weathered metallic engravings. "
            "ONLY 1 Infinity Stone is inserted and glowing brightly: the purple Power Stone on the index knuckle. "
            "The other 5 stone sockets (middle knuckle, ring knuckle, pinky knuckle, thumb socket, and center back-of-hand socket) "
            "are completely EMPTY dark recessed metallic sockets with NO gems in them. "
            "High-quality 3D game icon render, centered, clean edges, on a pure solid white (#FFFFFF) background."
        ),
        negative_prompt=(
            "multiple gauntlets, person, arm, body, dark background, gray background, text, watermark, "
            "all stones lit, 6 stones, full gauntlet, cropped fingers"
        ),
        filename_prefix="s3_gauntlet_1_qwen",
        seed=303201,
        ref_image=None,
        width=1024,
        height=1024,
        steps=24,
    )
    g1_raw = run_comfy_job(g1_wf)
    g1_out = os.path.join(PUBLIC_S3_DIR, "gauntlet", "gauntlet_1.png")
    remove_bg_high_quality(g1_raw, g1_out, sess, target_size=512)
    print(f"Saved {g1_out}")

    # Copy g1_raw into ComfyUI input dir so steps 2..6 edit the EXACT same glove!
    ref_name = "s3_gauntlet_base_ref.png"
    shutil.copyfile(g1_raw, os.path.join(COMFY_INPUT_DIR, ref_name))

    stone_stages = [
        (
            2,
            "Insert and light up ONLY the blue Space Stone on the middle knuckle next to the purple Power Stone. "
            "Keep exactly 2 stones glowing (purple Power, blue Space) and leave the remaining 4 sockets empty dark metal.",
        ),
        (
            3,
            "Have ONLY 3 stones glowing brightly: purple Power Stone (index), blue Space Stone (middle), and red Reality Stone (ring knuckle). "
            "Leave the remaining 3 sockets (pinky, thumb, center back) completely empty dark recessed metal.",
        ),
        (
            4,
            "Have ONLY 4 stones glowing brightly: purple Power (index), blue Space (middle), red Reality (ring), and orange Soul Stone (pinky knuckle). "
            "Leave the thumb socket and large center back-of-hand socket empty dark recessed metal.",
        ),
        (
            5,
            "Have ONLY 5 stones glowing brightly: purple Power (index), blue Space (middle), red Reality (ring), orange Soul (pinky), and green Time Stone (thumb). "
            "Leave ONLY the large center back-of-hand Mind Stone socket empty dark recessed metal.",
        ),
        (
            6,
            "Fill and brightly illuminate ALL 6 Infinity Stones: purple Power (index), blue Space (middle), red Reality (ring), "
            "orange Soul (pinky), green Time (thumb), and the large glowing yellow Mind Stone in the center back-of-hand socket, "
            "with a subtle golden-rainbow energy aura radiating from the stones.",
        ),
    ]

    for idx, desc in stone_stages:
        print(f"\n[{idx + 2}/8] Generating consistent Gauntlet ({idx} stones lit) from reference...")
        g_wf = build_workflow_from_saved_json(
            prompt=(
                f"Edit the exact golden Infinity Gauntlet in Image 1 while keeping the glove in the exact same position, angle, size, "
                f"metallic Uru plates, lighting, and pure solid white (#FFFFFF) background. {desc} "
                f"Do not rotate, resize, or shift the gauntlet."
            ),
            negative_prompt=(
                "shifted position, different angle, different gauntlet, rotated glove, dark background, gray background, "
                "text, watermark, arm, body, cropped"
            ),
            filename_prefix=f"s3_gauntlet_{idx}_qwen",
            seed=303200 + idx,
            ref_image=ref_name,
            width=1024,
            height=1024,
            steps=22,
        )
        raw_path = run_comfy_job(g_wf)
        out_path = os.path.join(PUBLIC_S3_DIR, "gauntlet", f"gauntlet_{idx}.png")
        remove_bg_high_quality(raw_path, out_path, sess, target_size=512)
        print(f"Saved {out_path}")

    print("\nALL 8 QWEN ASSETS GENERATED SUCCESSFULLY!")


if __name__ == "__main__":
    main()
