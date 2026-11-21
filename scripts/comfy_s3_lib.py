import json
import os
import time
import urllib.request
import urllib.parse
import numpy as np
import cv2
from PIL import Image
from rembg import remove, new_session

COMFY_URL = "http://127.0.0.1:8188"
COMFY_OUTPUT_DIR = r"C:\Users\geoff\AppData\Local\Comfy-Desktop\ComfyUI-Shared\output"

CONSISTENT_RULE = (
    "Preserve Matthew's recognizable face and original head proportions wherever appropriate for the character. "
    "Create a polished, detailed 3D game-skin head asset with realistic materials and fine surface details. "
    "Show only the head, no neck, shoulders, or body. "
    "Keep the head centered, fully visible, and at the same camera angle, size, and framing as Image 1. "
    "Use a pure solid white (#FFFFFF) background with no text, watermark, border, or extra characters."
)

NEGATIVE_SKIN_DEFAULT = (
    "body, neck, shoulders, torso, arms, hands, cropped head, cut off top of head, multiple heads, "
    "extra characters, different face proportions, deformed face, text, watermark, border, frame, "
    "gray background, colored background, gradient background, drop shadow on background"
)


def remove_bg_high_quality(input_path: str, output_path: str, session, target_size: int = 512) -> None:
    """
    Highest-quality alpha cutout combining BiRefNet-General foreground matte with
    pure-white edge color unmixing so zero white halo appears around hair/masks
    and interior white details (Spider-Man lenses, Moon Knight hood) stay 100% opaque.
    """
    im = Image.open(input_path).convert("RGBA")
    rgba_ai = np.array(remove(im, session=session))
    ai_alpha = rgba_ai[:, :, 3].astype(np.float32) / 255.0

    rgb = np.array(im)[:, :, :3].astype(np.float32)
    h, w = rgb.shape[:2]

    # Floodfill strictly exterior near-white background connected to corners
    is_near_white = (
        (rgb[:, :, 0] >= 244) & (rgb[:, :, 1] >= 244) & (rgb[:, :, 2] >= 244)
    ).astype(np.uint8) * 255
    mask_ff = np.zeros((h + 2, w + 2), np.uint8)
    work = is_near_white.copy()
    for sx, sy in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        if work[sy, sx] == 255:
            cv2.floodFill(work, mask_ff, (sx, sy), 128)
    ext_bg = (work == 128)

    # Combine: exterior pure-white background forced alpha=0; interior BiRefNet pixels kept clean
    alpha = ai_alpha.copy()
    alpha[ext_bg] = 0.0
    # Solidify core interior pixels where BiRefNet is confident
    alpha[alpha > 0.92] = 1.0
    alpha[alpha < 0.06] = 0.0

    # Color decontamination against white background on semi-transparent edge pixels
    edge = (alpha > 0.0) & (alpha < 1.0)
    if np.any(edge):
        a = alpha[edge][:, None]
        rgb[edge] = np.clip((rgb[edge] - (1.0 - a) * 255.0) / np.maximum(a, 0.15), 0.0, 255.0)

    out_rgba = np.zeros((h, w, 4), dtype=np.uint8)
    out_rgba[:, :, :3] = rgb.astype(np.uint8)
    out_rgba[:, :, 3] = np.clip(alpha * 255.0, 0, 255).astype(np.uint8)

    # Trim transparent margins slightly while keeping square centered proportions
    ys, xs = np.where(out_rgba[:, :, 3] > 12)
    out_img = Image.fromarray(out_rgba, mode="RGBA")
    if len(xs) > 0 and len(ys) > 0:
        pad = int(max(h, w) * 0.04)
        x0 = max(0, int(xs.min()) - pad)
        y0 = max(0, int(ys.min()) - pad)
        x1 = min(w, int(xs.max()) + 1 + pad)
        y1 = min(h, int(ys.max()) + 1 + pad)
        bw, bh = x1 - x0, y1 - y0
        side = max(bw, bh)
        sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
        sq.paste(out_img.crop((x0, y0, x1, y1)), ((side - bw) // 2, (side - bh) // 2))
        out_img = sq

    if target_size and out_img.size != (target_size, target_size):
        out_img = out_img.resize((target_size, target_size), Image.Resampling.LANCZOS)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    out_img.save(output_path, format="PNG", optimize=True)


def build_qwen_workflow(
    prompt: str,
    negative_prompt: str,
    filename_prefix: str,
    seed: int,
    ref_image: str | None = "Main Mathew.png",
    resolution: int = 640,
    steps: int = 20,
) -> dict:
    has_ref = bool(ref_image)
    wf = {
        "461": {
            "inputs": {
                "filename_prefix": filename_prefix,
                "format": "png",
                "format.bit_depth": "8-bit",
                "format.input_color_space": "sRGB",
                "format.channels": "auto",
                "images": ["459:457", 0],
            },
            "class_type": "SaveImageAdvanced",
        },
        "459:451": {
            "inputs": {
                "unet_name": "qwen_image_2.1_int8_convrot.safetensors",
                "weight_dtype": "default",
            },
            "class_type": "UNETLoader",
        },
        "459:453": {
            "inputs": {
                "clip_name": "qwen3vl_8b_int8_convrot.safetensors",
                "type": "qwen_image",
                "device": "default",
            },
            "class_type": "CLIPLoader",
        },
        "459:454": {
            "inputs": {"vae_name": "qwen_image_2.1_vae_bf16.safetensors"},
            "class_type": "VAELoader",
        },
        "459:456": {
            "inputs": {"width": resolution, "height": resolution, "batch_size": 1},
            "class_type": "EmptyLatentImage",
        },
        "459:457": {
            "inputs": {"samples": ["459:458", 0], "vae": ["459:454", 0]},
            "class_type": "VAEDecode",
        },
        "459:458": {
            "inputs": {
                "seed": seed,
                "steps": steps,
                "cfg": 1,
                "sampler_name": "euler",
                "scheduler": "simple",
                "denoise": 1,
                "model": ["459:469", 0],
                "positive": ["459:474", 0],
                "negative": ["459:474", 1],
                "latent_image": ["459:468", 0],
            },
            "class_type": "KSampler",
        },
        "459:468": {
            "inputs": {
                "switch": not has_ref,
                "on_false": ["459:474", 2],
                "on_true": ["459:456", 0],
            },
            "class_type": "ComfySwitchNode",
        },
        "459:469": {
            "inputs": {"device": "auto", "dtype": "default", "model": ["459:451", 0]},
            "class_type": "QwenImage21Cache",
        },
        "459:474": {
            "inputs": {
                "prompt": prompt,
                "negative_prompt": negative_prompt,
                "resolution": resolution,
                "clip": ["459:453", 0],
                "vae": ["459:454", 0],
            },
            "class_type": "TextEncodeQwenImage21",
        },
    }
    if has_ref:
        wf["470"] = {"inputs": {"image": ref_image}, "class_type": "LoadImage"}
        wf["459:474"]["inputs"]["images.image_1"] = ["470", 0]
    return wf


def run_comfy_job(workflow: dict, timeout_sec: int = 180) -> str:
    payload = json.dumps({"prompt": workflow}).encode("utf-8")
    req = urllib.request.Request(
        f"{COMFY_URL}/prompt",
        data=payload,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        prompt_id = json.loads(resp.read().decode("utf-8"))["prompt_id"]

    t0 = time.time()
    while time.time() - t0 < timeout_sec:
        with urllib.request.urlopen(f"{COMFY_URL}/history/{prompt_id}", timeout=15) as r:
            hist = json.loads(r.read().decode("utf-8"))
        if prompt_id in hist:
            entry = hist[prompt_id]
            status = entry.get("status", {})
            if status.get("status_str") == "error":
                raise RuntimeError(f"ComfyUI error: {json.dumps(status)}")
            outputs = entry.get("outputs", {})
            for node_out in outputs.values():
                imgs = node_out.get("images", [])
                if imgs:
                    sub = imgs[0].get("subfolder", "")
                    fname = imgs[0]["filename"]
                    return os.path.join(COMFY_OUTPUT_DIR, sub, fname) if sub else os.path.join(COMFY_OUTPUT_DIR, fname)
        time.sleep(0.5)
    raise TimeoutError(f"ComfyUI timeout for {prompt_id}")


if __name__ == "__main__":
    sess = new_session("birefnet-general")
    test_src = os.path.join(COMFY_OUTPUT_DIR, "Qwen_image_2.1_00005.png")
    test_dst = r"W:\Mathew Clicker\public\images\s3\skins\spider_man_matthew.png"
    remove_bg_high_quality(test_src, test_dst, sess, target_size=512)
    print("Cut spider_man_matthew.png OK ->", test_dst)

    t0 = time.time()
    wf = build_qwen_workflow(
        prompt=(
            "Create a Matthew Iron Man Mark III version of the exact Matthew character in Image 1. "
            "Red-and-gold metallic Iron Man Mark III helmet partially opened revealing Matthew's full face inside, "
            "detailed metal seams, crisp specular highlights. " + CONSISTENT_RULE
        ),
        negative_prompt=NEGATIVE_SKIN_DEFAULT,
        filename_prefix="s3_test_iron_man",
        seed=100002,
        ref_image="Main Mathew.png",
        resolution=640,
        steps=20,
    )
    out_raw = run_comfy_job(wf)
    dt = time.time() - t0
    print(f"Generated in {dt:.1f}s -> {out_raw}")
    remove_bg_high_quality(out_raw, r"W:\Mathew Clicker\public\images\s3\skins\iron_man_mk3_matthew.png", sess, target_size=512)
    print("Cut iron_man_mk3_matthew.png OK")
