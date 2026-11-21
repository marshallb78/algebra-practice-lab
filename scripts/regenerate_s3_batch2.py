import shutil
import sys
import time
from pathlib import Path
from rembg import new_session

sys.path.insert(0, str(Path(__file__).resolve().parent))
from comfy_s3_lib import build_qwen_workflow, remove_bg_high_quality, run_comfy_job  # noqa: E402

ROOT = Path(r"w:\Mathew Clicker\public\images\s3")
S2_NORMAL_CRATE = Path(r"w:\Mathew Clicker\public\images\s2\crates\normal_crate.png")
COMFY_INPUT_DIR = Path(r"C:\Users\geoff\AppData\Local\Comfy-Desktop\ComfyUI-Shared\input")

NEGATIVE_CLEAN = (
    "text, watermark, border, frame, gray background, colored background, gradient background, "
    "floor shadow, clutter, middle finger, palm up, upside down hand"
)


def main():
    og_ref_name = "OG_Crate_Ref.png"
    if S2_NORMAL_CRATE.exists():
        shutil.copy2(S2_NORMAL_CRATE, COMFY_INPUT_DIR / og_ref_name)
        crates_dir = ROOT / "crates"
        crates_dir.mkdir(parents=True, exist_ok=True)
        shutil.copy2(S2_NORMAL_CRATE, crates_dir / "normal_crate.png")
        print(f"Copied OG Normal Crate -> {crates_dir / 'normal_crate.png'}")

    print("Loading BiRefNet-General session...")
    sess = new_session("birefnet-general")

    jobs = [
        # --- 3 MARVEL 2D CRATES USING OG CRATE AS REFERENCE ---
        (
            "stark_crate",
            ROOT / "crates" / "stark_crate.png",
            512,
            og_ref_name,
            (
                "Edit this exact 2D flat front-facing square game crate icon into an Iron Man Stark Tech Crate. "
                "Keep the exact same flat 2D square front view, the boy's face visible behind horizontal slats inside the frame, "
                "and the glowing mouse cursor icon in the bottom-right corner. "
                "Replace the wood frame with glossy crimson-red and brushed gold Iron Man armor plating with glowing cyan arc-reactor corners, "
                "and turn the bottom-right cursor icon into a glowing cyan-and-gold Stark cursor. "
                "2D vector game icon style, centered, isolated on a clean pure solid white #FFFFFF background."
            ),
        ),
        (
            "wakanda_crate",
            ROOT / "crates" / "wakanda_crate.png",
            512,
            og_ref_name,
            (
                "Edit this exact 2D flat front-facing square game crate icon into a Black Panther Wakanda Vibranium Crate. "
                "Keep the exact same flat 2D square front view, the boy's face visible behind horizontal slats inside the frame, "
                "and the glowing mouse cursor icon in the bottom-right corner. "
                "Replace the wood frame with sleek matte-black and silver vibranium armor trim glowing with bright purple kinetic runes, "
                "and turn the bottom-right cursor icon into a glowing neon-purple vibranium cursor. "
                "2D vector game icon style, centered, isolated on a clean pure solid white #FFFFFF background."
            ),
        ),
        (
            "infinity_crate",
            ROOT / "crates" / "infinity_crate.png",
            512,
            og_ref_name,
            (
                "Edit this exact 2D flat front-facing square game crate icon into a Thanos Infinity Crate. "
                "Keep the exact same flat 2D square front view, the boy's face visible behind horizontal slats inside the frame, "
                "and the glowing mouse cursor icon in the bottom-right corner. "
                "Replace the wood frame with ornate royal Uru gold and deep cosmic purple trim studded with 6 glowing colorful Infinity Gems along the edges, "
                "and turn the bottom-right cursor icon into a glowing cosmic gold-and-purple cursor. "
                "2D vector game icon style, centered, isolated on a clean pure solid white #FFFFFF background."
            ),
        ),
        # --- 3 HAND CURSORS (PALM DOWN, BACK OF HAND UP, INDEX FINGER POINTING TOP-LEFT, NO MIDDLE FINGER) ---
        (
            "web_shooter_cursor",
            ROOT / "cursors" / "web_shooter_cursor.png",
            256,
            None,
            (
                "2D stylized game mouse pointer icon of Spider-Man's gloved hand seen from the BACK of the hand with palm facing DOWN, "
                "tilted diagonally pointing toward the top-left corner like a computer mouse pointer cursor. "
                "ONLY the index finger is extended straight pointing top-left; thumb, middle, ring, and pinky fingers are tucked neatly underneath. "
                "Red-and-black webbed Spider-Man glove with a silver mechanical web-shooter on the wrist shooting a thin white web tip from the index finger. "
                "Isolated on a pure solid white #FFFFFF background, crisp dark outline, no text."
            ),
        ),
        (
            "repulsor_cursor",
            ROOT / "cursors" / "repulsor_cursor.png",
            256,
            None,
            (
                "2D stylized game mouse pointer icon of Iron Man's armored gauntlet hand seen from the BACK of the hand with palm facing DOWN, "
                "tilted diagonally pointing toward the top-left corner like a computer mouse pointer cursor. "
                "ONLY the index finger is extended straight pointing top-left; thumb, middle, ring, and pinky fingers are tucked neatly underneath. "
                "Metallic crimson red and gold Stark armor plates on the back of the hand with a glowing cyan energy line along the index finger. "
                "Isolated on a pure solid white #FFFFFF background, crisp outline, no text."
            ),
        ),
        (
            "infinity_gauntlet_cursor",
            ROOT / "cursors" / "infinity_gauntlet_cursor.png",
            256,
            None,
            (
                "2D stylized game mouse pointer icon of Thanos's golden Infinity Gauntlet hand seen from the BACK of the hand with palm facing DOWN, "
                "tilted diagonally pointing toward the top-left corner like a computer mouse pointer cursor. "
                "ONLY the index finger is extended straight pointing top-left; thumb, middle, ring, and pinky fingers are curled cleanly underneath (strictly index finger pointing, never middle finger). "
                "All 6 colorful glowing Infinity Stones (blue, yellow, red, purple, green, orange) embedded across the back of the golden gauntlet and knuckles. "
                "Isolated on a pure solid white #FFFFFF background, crisp outline, no text."
            ),
        ),
        # --- 8 BIG 2D EVENT / VILLAIN ATTACK ICONS (2x4 GRID) ---
        (
            "event_click_marathon",
            ROOT / "events" / "event_click_marathon.png",
            256,
            None,
            (
                "2D vibrant comic-book game icon of an Avengers Click Marathon: "
                "a glowing golden-red Stark target shield surrounded by yellow electric lightning bolts and speed lines. "
                "Bold 2D vector style, isolated on a pure solid white #FFFFFF background, no text."
            ),
        ),
        (
            "event_golden_rain",
            ROOT / "events" / "event_golden_rain.png",
            256,
            None,
            (
                "2D vibrant comic-book game icon of Stark Gold Rain: "
                "a shower of gleaming golden coins, gold bullion bars, and sparkling stars falling from a golden energy cloud. "
                "Bold 2D vector style, isolated on a pure solid white #FFFFFF background, no text."
            ),
        ),
        (
            "event_lucky_pinata",
            ROOT / "events" / "event_lucky_pinata.png",
            256,
            None,
            (
                "2D vibrant comic-book game icon of a Cosmic Avengers Star Piñata: "
                "a colorful red-gold-and-blue hero star piñata cracking open with glowing gems and confetti. "
                "Bold 2D vector style, isolated on a pure solid white #FFFFFF background, no text."
            ),
        ),
        (
            "event_jackpot_wheel",
            ROOT / "events" / "event_jackpot_wheel.png",
            256,
            None,
            (
                "2D vibrant comic-book game icon of a Cosmic Quantum Prize Wheel: "
                "a glowing multi-colored spinning jackpot wheel with golden rim, jewel segments, and a bright pointer arrow at the top. "
                "Bold 2D vector style, isolated on a pure solid white #FFFFFF background, no text."
            ),
        ),
        (
            "attack_time_freeze",
            ROOT / "events" / "attack_time_freeze.png",
            256,
            None,
            (
                "2D vibrant comic-book game icon of Loki Time Freeze: "
                "a glowing emerald-green and cyan frozen hourglass wrapped in Loki's golden horns and jagged frost crystals. "
                "Bold 2D vector style, isolated on a pure solid white #FFFFFF background, no text."
            ),
        ),
        (
            "attack_mirror_flip",
            ROOT / "events" / "attack_mirror_flip.png",
            256,
            None,
            (
                "2D vibrant comic-book game icon of Doctor Strange Mirror Dimension Flip: "
                "shattered glowing orange-and-purple geometric mirror shards swirling with golden mystic runes. "
                "Bold 2D vector style, isolated on a pure solid white #FFFFFF background, no text."
            ),
        ),
        (
            "attack_symbiote_blackout",
            ROOT / "events" / "attack_symbiote_blackout.png",
            256,
            None,
            (
                "2D vibrant comic-book game icon of a Symbiote Blackout: "
                "a swirling mass of glossy black Venom symbiote tendrils with sharp jagged white eyes and a glowing flashlight beam. "
                "Bold 2D vector style, isolated on a pure solid white #FFFFFF background, no text."
            ),
        ),
        (
            "attack_kingpin_tax",
            ROOT / "events" / "attack_kingpin_tax.png",
            256,
            None,
            (
                "2D vibrant comic-book game icon of a Kingpin Tax Heist: "
                "a dark purple-and-gold stolen money vault sack overflowing with coins and a glowing red warning diamond. "
                "Bold 2D vector style, isolated on a pure solid white #FFFFFF background, no text."
            ),
        ),
    ]

    print(f"Starting Batch 2 regeneration: {len(jobs)} assets...")
    for idx, (name, out_path, size, ref_img, prompt) in enumerate(jobs, 1):
        t0 = time.time()
        wf = build_qwen_workflow(
            prompt=prompt,
            negative_prompt=NEGATIVE_CLEAN,
            filename_prefix=f"s3_b2_{name}",
            seed=20261120 + idx * 17,
            ref_image=ref_img,
            resolution=512,
            steps=18,
        )
        raw_out = run_comfy_job(wf)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        remove_bg_high_quality(raw_out, str(out_path), sess, target_size=size)
        print(f"[{idx}/{len(jobs)}] OK ({time.time() - t0:.1f}s): {name} -> {out_path}", flush=True)

    print("BATCH 2 COMPLETE!")


if __name__ == "__main__":
    main()
