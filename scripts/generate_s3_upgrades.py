import os
import sys
import time
from pathlib import Path
from rembg import new_session

sys.path.insert(0, str(Path(__file__).resolve().parent))
from comfy_s3_lib import build_qwen_workflow, remove_bg_high_quality, run_comfy_job  # noqa: E402

UPGRADES_DIR = Path(r"w:\Mathew Clicker\public\images\s3\upgrades")
UPGRADES_DIR.mkdir(parents=True, exist_ok=True)

NEG = (
    "text, watermark, border, frame, gray background, colored background, gradient background, "
    "floor shadow, clutter, human face, portrait"
)

UPGRADE_PROMPTS = [
    ("s3_u_01", "2D Marvel comic game icon: silver-and-red Spider-Man mechanical web-fluid cartridge glowing faintly, isolated on pure solid white #FFFFFF background."),
    ("s3_u_02", "2D Marvel comic game icon: glowing cyan-blue Iron Man Arc Reactor chest core in brushed silver ring, isolated on pure solid white #FFFFFF background."),
    ("s3_u_03", "2D Marvel comic game icon: glowing red-and-blue Pym Particle glass vial with shrinking atoms inside, isolated on pure solid white #FFFFFF background."),
    ("s3_u_04", "2D Marvel comic game icon: Captain America red-white-and-blue Vibranium star shield angled cleanly, isolated on pure solid white #FFFFFF background."),
    ("s3_u_05", "2D Marvel comic game icon: Hawkeye purple-and-black high-tech tactical arrow quiver with glowing arrow tips, isolated on pure solid white #FFFFFF background."),
    ("s3_u_06", "2D Marvel comic game icon: Black Widow sleek black-and-red electric Widow's Bite wrist gauntlets crackling with blue sparks, isolated on pure solid white #FFFFFF background."),
    ("s3_u_07", "2D Marvel comic game icon: Falcon red-and-silver mechanical jetpack wings folded cleanly, isolated on pure solid white #FFFFFF background."),
    ("s3_u_08", "2D Marvel comic game icon: glowing neon-green Hulk gamma energy beaker bubbling with radioactive power, isolated on pure solid white #FFFFFF background."),
    ("s3_u_09", "2D Marvel comic game icon: Wakandan black-and-purple vibranium Kimoyo beads glowing with kinetic energy, isolated on pure solid white #FFFFFF background."),
    ("s3_u_10", "2D Marvel comic game icon: glossy black Venom symbiote containment jar with writhing black tendrils inside, isolated on pure solid white #FFFFFF background."),
    ("s3_u_11", "2D Marvel comic game icon: Green Goblin metallic purple-and-orange glowing pumpkin bomb, isolated on pure solid white #FFFFFF background."),
    ("s3_u_12", "2D Marvel comic game icon: Asgardian silver hammer Mjolnir crackling with blue lightning, isolated on pure solid white #FFFFFF background."),
    ("s3_u_13", "2D Marvel comic game icon: Loki ornate golden Chitauri scepter with glowing blue gem, isolated on pure solid white #FFFFFF background."),
    ("s3_u_14", "2D Marvel comic game icon: Doctor Strange golden double-finger Sling Ring surrounded by glowing orange mystic sparks, isolated on pure solid white #FFFFFF background."),
    ("s3_u_15", "2D Marvel comic game icon: Wolverine gleaming silver-steel triple Adamantium claw blades, isolated on pure solid white #FFFFFF background."),
    ("s3_u_16", "2D Marvel comic game icon: Scarlet Witch glowing crimson Chaos Magic crown orb with swirling red runes, isolated on pure solid white #FFFFFF background."),
    ("s3_u_17", "2D Marvel comic game icon: glowing golden Mind Stone jewel set in futuristic crimson-and-gold synthezoid circuitry, isolated on pure solid white #FFFFFF background."),
    ("s3_u_18", "2D Marvel comic game icon: Thor's Asgardian Stormbreaker axe-hammer glowing with rainbow Bifrost lightning, isolated on pure solid white #FFFFFF background."),
    ("s3_u_19", "2D Marvel comic game icon: Kang futuristic cobalt-blue and purple Chronopolis time-ring engine, isolated on pure solid white #FFFFFF background."),
    ("s3_u_20", "2D Marvel comic game icon: fiery golden-orange Phoenix Force cosmic bird emblem blazing with solar fire, isolated on pure solid white #FFFFFF background."),
    ("s3_u_21", "2D Marvel comic game icon: Knull dark crimson-and-black All-Black Necrosword blade pulsing with void energy, isolated on pure solid white #FFFFFF background."),
    ("s3_u_22", "2D Marvel comic game icon: glowing blue Space Stone Tesseract cube floating with cosmic sparkles, isolated on pure solid white #FFFFFF background."),
    ("s3_u_23", "2D Marvel comic game icon: golden Eye of Agamotto amulet open revealing a luminous green Time Stone, isolated on pure solid white #FFFFFF background."),
    ("s3_u_24", "2D Marvel comic game icon: radiant white-and-gold cosmic Infinity Gauntlet sunburst emblem of supreme power, isolated on pure solid white #FFFFFF background."),
]


def main():
    print("Loading BiRefNet-General session...")
    sess = new_session("birefnet-general")
    for idx, (uid, prompt) in enumerate(UPGRADE_PROMPTS, 1):
        out_path = UPGRADES_DIR / f"{uid}.png"
        if out_path.exists() and out_path.stat().st_size > 3000:
            print(f"[{idx}/{len(UPGRADE_PROMPTS)}] SKIP: {uid}")
            continue
        t0 = time.time()
        wf = build_qwen_workflow(
            prompt=prompt,
            negative_prompt=NEG,
            filename_prefix=f"s3_upg_{uid}",
            seed=770000 + idx * 13,
            ref_image=None,
            resolution=512,
            steps=16,
        )
        raw_out = run_comfy_job(wf)
        remove_bg_high_quality(raw_out, str(out_path), sess, target_size=256)
        print(f"[{idx}/{len(UPGRADE_PROMPTS)}] OK ({time.time() - t0:.1f}s): {uid}", flush=True)
    print("UPGRADE ICONS DONE!")


if __name__ == "__main__":
    main()
