import os
import shutil
import sys
from rembg import new_session

sys.path.insert(0, os.path.dirname(__file__))
from comfy_s3_lib import COMFY_OUTPUT_DIR, remove_bg_high_quality, run_comfy_job
from generate_qwen_missing_assets import (
    COMFY_INPUT_DIR,
    PUBLIC_S3_DIR,
    build_workflow_from_saved_json,
)

UPGRADES_DIR = os.path.join(PUBLIC_S3_DIR, "upgrades")

# 27 rich, unique 3D game-icon prompts for s3_u_25 .. s3_u_51
PART2_UPGRADE_ICONS: list[tuple[str, str]] = [
    ("s3_u_25.png", "3D game icon of a glowing green-and-gold Sakaar elevator control panel with twin Asgardian lightning sparks, metallic sci-fi badge, pure solid white background"),
    ("s3_u_26.png", "3D game icon of Loki's horned golden crown resting atop glowing emerald-green Yggdrasil timeline branches, crisp metallic 3D render, pure solid white background"),
    ("s3_u_27.png", "3D game icon of a glowing golden brass Sling Ring casting a spinning fiery orange Doctor Strange magic portal spark ring, 3D game item, pure solid white background"),
    ("s3_u_28.png", "3D game icon of a glowing green Eye of Agamotto time-loop mandala floating inside a fractured purple Dark Dimension crystal orb, 3D game icon, pure solid white background"),
    ("s3_u_29.png", "3D game icon of crossed gleaming silver adamantium Wolverine claws intersecting twin crimson-and-black Deadpool katana hilts, 3D game render, pure solid white background"),
    ("s3_u_30.png", "3D game icon of the silver metallic Cerebro mutant telepathy helmet glowing with concentric cyan psychic wave rings, 3D game item render, pure solid white background"),
    ("s3_u_31.png", "3D game icon of Scarlet Witch's crimson chaos magic crown and swirling ruby probability hex energy orbs, detailed 3D game icon, pure solid white background"),
    ("s3_u_32.png", "3D game icon of the ancient Darkhold spellbook bound in dark obsidian leather with glowing molten crimson runes hovering above, 3D render, pure solid white background"),
    ("s3_u_33.png", "3D game icon of Vision's red-and-emerald forehead Mind Stone jewel set in sleek vibranium-gold geometric armor plating, 3D game icon, pure solid white background"),
    ("s3_u_34.png", "3D game icon of a floating metallic Sokovia vibranium spire core pulsing with bright cyan anti-gravity energy rings, 3D game icon render, pure solid white background"),
    ("s3_u_35.png", "3D game icon of Captain America's red-white-blue Vibranium shield crossed behind Thor's crackling lightning-charged Mjolnir hammer, 3D game icon, pure solid white background"),
    ("s3_u_36.png", "3D game icon of the glowing Asgardian Bifrost rainbow prism sword key surrounded by electric blue Odinforce lightning arcs, 3D render, pure solid white background"),
    ("s3_u_37.png", "3D game icon of a golden TVA TemPad time-reset canister glowing with bright orange-amber pruned timeline sparks, retro-futuristic 3D game item, pure solid white background"),
    ("s3_u_38.png", "3D game icon of an ornate obsidian-and-gold Citadel desk timepiece with a glowing golden Sacred Timeline ring looping around it, 3D render, pure solid white background"),
    ("s3_u_39.png", "3D game icon of a blazing golden-crimson Phoenix bird crest made of cosmic solar flames and white-hot starlight, 3D game icon render, pure solid white background"),
    ("s3_u_40.png", "3D game icon of Captain Marvel's eight-pointed golden Hala star emblem blazing with glowing photon-binary plasma energy, 3D game render, pure solid white background"),
    ("s3_u_41.png", "3D game icon of the jagged obsidian All-Black Necrosword dripping with dark shadow-void energy and pale gold runes, 3D game icon, pure solid white background"),
    ("s3_u_42.png", "3D game icon of a cracked silver-purple Orb containment sphere revealing the radiant violet Power Stone inside, detailed 3D game icon, pure solid white background"),
    ("s3_u_43.png", "3D game icon of the luminous sky-blue translucent Tesseract Space Cube floating with electric blue wormhole arcs, 3D game icon render, pure solid white background"),
    ("s3_u_44.png", "3D game icon of an ornate Asgardian golden display pedestal with swirling liquid crimson Reality Aether tendrils rising from it, 3D render, pure solid white background"),
    ("s3_u_45.png", "3D game icon of the radiant amber-orange Soul Stone hovering above twin carved Vormir obsidian cliff pillars, 3D game icon render, pure solid white background"),
    ("s3_u_46.png", "3D game icon of a heroic golden battle-horn emblem framed by three glowing orange Kamar-Taj portal rings and golden sparks, 3D game icon, pure solid white background"),
    ("s3_u_47.png", "3D game icon of a heroic stylized wrapped golden-foil shawarma feast platter with an Avengers-red napkin and steaming glow, fun 3D game icon, pure solid white background"),
    ("s3_u_48.png", "3D game icon of a shattered cosmic glass prism revealing a glowing celestial blue Watcher eye peering through multiverse shards, 3D icon, pure solid white background"),
    ("s3_u_49.png", "3D game icon of a glowing white-and-violet starfield silhouette chalice of Eternity filled with swirling nebula galaxies, 3D game icon, pure solid white background"),
    ("s3_u_50.png", "3D game icon of Galactus's towering horned purple-and-magenta cosmic helmet crest with glowing Power Cosmic starlight, 3D game icon, pure solid white background"),
    ("s3_u_51.png", "3D game icon of Tony Stark's red-and-gold Nano-Gauntlet fingers snapping with all 6 Infinity Stones blazing in a brilliant golden star burst, 3D icon, pure solid white background"),
]


def regenerate_avengers_m_logo(sess) -> None:
    print("\n[Logo] Regenerating Avengers-style 'M' + Gauntlet loading logo...")
    # Look for the Avengers-style A image we generated earlier so we can swap A -> M while keeping the exact Avengers circle style!
    candidates = [
        f
        for f in os.listdir(COMFY_OUTPUT_DIR)
        if f.startswith("s3_loading_m_gauntlet_v2") and f.endswith(".png")
    ]
    ref_name = None
    if candidates:
        candidates.sort()
        src = os.path.join(COMFY_OUTPUT_DIR, candidates[-1])
        ref_name = "s3_avengers_a_ref.png"
        shutil.copyfile(src, os.path.join(COMFY_INPUT_DIR, ref_name))
        print(f"Using exact Avengers style reference: {candidates[-1]}")

    if ref_name:
        prompt = (
            "Edit Image 1: keep the exact same circular dark metallic ring, dark gunmetal steel, crimson red, and bright gold bevel style, "
            "and keep the golden Infinity Gauntlet at the bottom center. Replace ONLY the letter 'A' in the middle with a matching bold, sharp-angled "
            "Avengers-style capital letter 'M' (with two outer legs and a sharp central V-dip, clearly an M with NO A crossbar) extending slightly past the ring "
            "in the exact same dark gunmetal, crimson, and gold metallic finish on a pure solid white (#FFFFFF) background."
        )
    else:
        prompt = (
            "A bold, iconic metallic superhero emblem styled like the Avengers circle-and-letter logo, "
            "but featuring a giant sharp-angled capital letter 'M' instead of 'A', forged in dark gunmetal steel, deep crimson red, and gold bevel trim, "
            "overlapping a thick metallic circular ring, with the golden Infinity Gauntlet at the bottom center. "
            "Centered on a pure solid white (#FFFFFF) background."
        )

    wf = build_workflow_from_saved_json(
        prompt=prompt,
        negative_prompt="letter A, crossbar, Avengers A, triangle top, extra text, words, watermark, dark background, gray background",
        filename_prefix="s3_loading_m_gauntlet_final",
        seed=303199,
        ref_image=ref_name,
        width=1024,
        height=1024,
        steps=24,
    )
    raw = run_comfy_job(wf)
    out = os.path.join(PUBLIC_S3_DIR, "loading_m_gauntlet.png")
    remove_bg_high_quality(raw, out, sess, target_size=640)
    print(f"Saved {out}")


def regenerate_part2_upgrades(sess) -> None:
    os.makedirs(UPGRADES_DIR, exist_ok=True)
    total = len(PART2_UPGRADE_ICONS)
    for i, (filename, prompt) in enumerate(PART2_UPGRADE_ICONS, start=1):
        print(f"\n[{i}/{total}] Generating {filename} via ComfyUI Qwen Image 2.1...")
        wf = build_workflow_from_saved_json(
            prompt=prompt + ", centered, crisp edges, no text, no watermark",
            negative_prompt="text, words, letters, watermark, frame, border, dark background, gray background, cropped, blurry, flat 2d",
            filename_prefix=f"s3_upg_{filename[:-4]}",
            seed=304000 + i,
            ref_image=None,
            width=768,
            height=768,
            steps=20,
        )
        raw = run_comfy_job(wf)
        out = os.path.join(UPGRADES_DIR, filename)
        remove_bg_high_quality(raw, out, sess, target_size=256)
        print(f"Saved {out}")


if __name__ == "__main__":
    sess = new_session("birefnet-general")
    regenerate_avengers_m_logo(sess)
    regenerate_part2_upgrades(sess)
    print("\nALL LOGO + 27 PART-2 UPGRADE ICONS REGENERATED!")
