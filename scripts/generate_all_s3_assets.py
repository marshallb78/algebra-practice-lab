import os
import sys
import time
from rembg import new_session

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from comfy_s3_lib import (
    CONSISTENT_RULE,
    NEGATIVE_SKIN_DEFAULT,
    build_qwen_workflow,
    remove_bg_high_quality,
    run_comfy_job,
)

ROOT = r"W:\Mathew Clicker\public\images\s3"
SKINS_DIR = os.path.join(ROOT, "skins")
CURSORS_DIR = os.path.join(ROOT, "cursors")
CRATES_DIR = os.path.join(ROOT, "crates")
GAUNTLET_DIR = os.path.join(ROOT, "gauntlet")

NO_REF_RULE = (
    "Create a polished, detailed 3D stylized game asset icon, centered, clean silhouette, dramatic studio lighting, "
    "pure solid white (#FFFFFF) background with no text, watermark, border, or hands/arms unless part of the gauntlet."
)

NEGATIVE_OBJECT_DEFAULT = (
    "text, watermark, border, frame, gray background, colored background, gradient background, "
    "floor shadow, clutter, multiple objects, human face, portrait"
)

# All 50 Marvel Matthew Skins (matching user's exact 1..50 specification)
MARVEL_SKINS = [
    # Common 1-10
    ("spider_man_matthew", "Classic Spider-Man version of Matthew: classic red mask pulled up over his forehead, realistic wrinkles, black web pattern, two large white eye lenses clearly visible above forehead, red only no blue."),
    ("iron_man_mk3_matthew", "Matthew Iron Man Mark III: red-and-gold metallic helmet partially opened showing Matthew's face clearly inside, detailed metal seams."),
    ("captain_america_matthew", "Matthew Captain America: classic blue cowl worn on head leaving Matthew's face visible, small crisp white star emblem on forehead, realistic stitched fabric texture, red-white-blue accents."),
    ("hulk_matthew", "Matthew Hulk: vibrant green skin on Matthew's face and head, thick dark messy hair, heavy knitted eyebrows, fierce angry expression, realistic skin texture, keeping Matthew's recognizable facial features."),
    ("thor_matthew", "Matthew Thor: long flowing blond hair, short neat blond beard, silver winged Asgardian helmet worn on head, subtle blue-white lightning glow around the wings."),
    ("black_widow_matthew", "Matthew Black Widow: styled copper-red hair, sleek black tactical spy headgear with subtle metallic ear comms and realistic fabric texture."),
    ("hawkeye_matthew", "Matthew Hawkeye: tousled dark hair, sleek black tactical headpiece and brow visor with purple accents, sharp focused expression."),
    ("ant_man_matthew", "Matthew Ant-Man: red-and-silver Ant-Man helmet raised above his forehead showing Matthew's full face clearly, detailed metallic breathing panels and red lenses up top."),
    ("war_machine_matthew", "Matthew War Machine: dark gunmetal gray-and-silver armored helmet opened at the top/front showing Matthew's face, glowing red visor eyes on the raised faceplate, rugged brushed metal texture."),
    ("falcon_matthew", "Matthew Falcon: red-and-black sleek flight helmet with red flight goggles pushed up above his forehead, Matthew's face clearly visible, realistic tactical armor details."),
    # Uncommon 11-20
    ("miles_morales_matthew", "Matthew Miles Morales Spider-Man: matte black Spider-Man mask pulled up over forehead with thin red web lines and red spider emblem on forehead, white eye lenses above forehead, Matthew's face visible."),
    ("spider_gwen_matthew", "Matthew Spider-Gwen: crisp white Spider-Gwen hood pulled slightly back with white-and-pink mask folded above forehead, black and hot-pink trim details, Matthew's face visible."),
    ("venom_matthew", "Matthew Venom: glossy pitch-black symbiote head emerging around Matthew's face, large jagged white Venom eye patches on upper head, menacing sharp teeth lining mask edge, subtle black symbiote tendrils."),
    ("loki_matthew", "Matthew Loki: slicked-back black hair, tall curved metallic golden horns on an ornate green-and-gold Asgardian headpiece, subtle mischievous grin."),
    ("winter_soldier_matthew", "Matthew Winter Soldier: shoulder-length dark hair kept near head, black tactical domino eye mask/headband across upper face with matte dark metal accents, rugged facial details."),
    ("black_panther_matthew", "Matthew Black Panther: sleek matte-black vibranium panther mask with pointed ears raised above forehead, silver tribal engraved details, Matthew's face visible beneath."),
    ("deadpool_matthew", "Matthew Deadpool: red-and-black Deadpool mask rolled up above his forehead with expressive white eye patches visible on top, wrinkled stitched red-and-black fabric."),
    ("wolverine_matthew", "Matthew Wolverine: thick wild dark hair, heavy dark sideburns, iconic yellow-and-blue Wolverine cowl pulled back on head with tall pointed black ear fins."),
    ("green_goblin_matthew", "Matthew Green Goblin: menacing green-and-purple goblin mask/helmet raised above his forehead, pointed goblin ears, wrinkled metallic green scales and glowing orange eye details on top."),
    ("doctor_octopus_matthew", "Matthew Doctor Octopus: dark slicked-back bowl-cut hair, round green-tinted brass goggles worn on head/forehead with metallic head straps and realistic lens reflections."),
    # Rare 21-30
    ("iron_spider_matthew", "Matthew Iron Spider: sleek metallic red-and-gold nanotech mask folded above forehead, brilliant gold trim and glowing white eye lenses up top, tips of four small golden mechanical spider-legs peeking just behind the crown of the head."),
    ("black_suit_spider_matthew", "Matthew Black Suit Spider-Man: sleek glossy black symbiote Spider-Man mask pulled up over forehead with large angular white eye lenses on top and organic web sheen, Matthew's face clearly visible."),
    ("superior_spider_matthew", "Matthew Superior Spider-Man: sharp red-and-black Spider-Man mask raised above forehead with four sleek red mechanical eye-sensor lenses and razor-sharp black web lines."),
    ("scarlet_spider_matthew", "Matthew Scarlet Spider: distressed crimson-red Spider-Man mask rolled up above forehead with big angular white eye lenses and worn black web seams (keep any blue hoodie out of frame)."),
    ("spider_man_2099_matthew", "Matthew Spider-Man 2099: dark metallic navy-blue and crimson-red futuristic mask raised above forehead, angular glowing red eye shapes, sleek neon technology seams."),
    ("iron_man_mk85_matthew", "Matthew Iron Man Mark 85: ultra-sleek red-and-gold Endgame nanotech helmet partially retracted open around Matthew's full face, precise gold plating and glowing blue visor vents on top."),
    ("rescue_matthew", "Matthew Rescue: metallic royal-purple and silver sleek Iron Armor helmet raised above forehead, glowing cyan-blue tech details and refined brushed titanium finish."),
    ("thor_ragnarok_matthew", "Matthew Thor Ragnarok: shorter cropped blond hair, short dark beard, silver-and-blue Sakaar gladiator helmet with articulated side crest and bold red gladiator war paint across cheek."),
    ("endgame_cap_matthew", "Matthew Endgame Captain America: deep navy-blue battle-worn tactical cowl on head, weathered white star on forehead, realistic combat scratches, chin strap, and heavy fabric creases."),
    ("red_hulk_matthew", "Matthew Red Hulk: deep crimson-red skin across Matthew's face and head, short dark crew hair, thick dark eyebrows, heavy muscular jaw, intense fiery angry expression."),
    # Epic 31-40
    ("scarlet_witch_matthew", "Matthew Scarlet Witch: dark auburn-red hair, iconic jagged crimson-red Scarlet Witch metallic crown headpiece, subtle glowing red chaos magic wisps around head."),
    ("moon_knight_matthew", "Matthew Moon Knight: layered wrapped white mummy hood and gleaming silver crescent moon crest on forehead, eerie glowing white eyes, textured wrinkled ivory cloth."),
    ("vision_matthew", "Matthew Vision: deep magenta-red synthetic android skin with intricate silver circuit lines, glowing golden Mind Stone gem embedded in forehead, green-and-gold head cowl framing face."),
    ("ultron_matthew", "Matthew Ultron: sleek silver-titanium robotic Ultron faceplate/helmet with angular sculpted metal plates, glowing crimson-red eyes and mouth vents, maintaining Matthew's head shape."),
    ("thanos_matthew", "Matthew Thanos: royal purple titan skin, vertical textured purple chin ridges, ornate gold-and-blue Chitauri armored war helmet on head, stern commanding expression."),
    ("dr_strange_supreme_matthew", "Matthew Doctor Strange Supreme: dark hair with crisp silver-gray side streaks, pale arcane features, glowing golden-orange eldritch mandala runes floating subtly beside head (head only, no cloak collar)."),
    ("zombie_iron_man_matthew", "Matthew Zombie Iron Man: battle-damaged cracked red-and-gold Iron Man helmet open over eerie pale undead glowing eyes, exposed sparking wires and scratched scorched metal plates."),
    ("zombie_cap_matthew", "Matthew Zombie Captain America: torn shredded blue cowl, cracked weathered white star emblem, eerie pale decaying skin texture on Matthew's face, tattered fabric."),
    ("kang_matthew", "Matthew Kang the Conqueror: futuristic metallic cobalt-blue and purple helmet with glowing translucent blue visor faceplate lifted/transparent over Matthew's blue-tinted face, angular tech forehead lines."),
    ("loki_god_of_stories_matthew", "Matthew Loki God of Stories: majestic ornate curved golden horns on a deep emerald-green and gold crown, subtle glowing emerald eyes, timeless cosmic magic shimmer."),
    # Legendary 41-48
    ("phoenix_force_matthew", "Matthew Phoenix Force Jean Grey: vibrant fiery-red hair, gleaming golden Phoenix wing crown on forehead, radiant glowing orange-gold eyes and ethereal flame wisps."),
    ("cosmic_spider_matthew", "Matthew Cosmic Spider-Man: classic Spider-Man mask pulled up over forehead infused with deep black cosmic starfield nebula texture, glowing white starlight specks and Captain Universe blue-white forehead aura."),
    ("knull_matthew", "Matthew Knull: pale ashen skin, long jagged jet-black hair, jagged dark obsidian-and-crimson symbiote crown on forehead, dark creeping tendrils, sinister glowing red gaze."),
    ("world_breaker_hulk_matthew", "Matthew World Breaker Hulk: massive green-skinned Hulk head with blazing glowing emerald-green eyes, wild dark messy hair, glowing green gamma cracks across skin and battle scars."),
    ("rune_king_thor_matthew", "Matthew Rune King Thor: long flowing golden-blond hair, short beard, ancient Norse Odinforce runes glowing bright gold across forehead, ornate gold Asgardian king crown."),
    ("god_emperor_doom_matthew", "Matthew God Emperor Doom: crisp white-and-emerald Battleworld hood worn over a gleaming silver-metal Doctor Doom half-mask/crown raised on brow with golden trim, Matthew's eyes/face recognizable."),
    ("beyonder_matthew", "Matthew The Beyonder: voluminous retro dark wavy hair, dramatic black-and-white cosmic geometric energy pattern across temples, luminous white eyes, subtle white reality-warping aura."),
    ("one_above_all_matthew", "Matthew The One Above All: radiant pure white-and-gold celestial cosmic headpiece, luminous golden eyes, intricate sacred geometric halo patterns, serene divine golden glow."),
    # Mythic 49-50
    ("infinity_thanos_matthew", "Matthew Infinity Thanos: purple Titan face with ridged chin, crowned with an ornate gold Infinity Gauntlet-inspired war helmet embedding all six brightly glowing Infinity Stones (blue, yellow, red, purple, green, orange) radiating cosmic energy around the head."),
    ("infinity_ultron_matthew", "Matthew Infinity Ultron: Ultron's gleaming silver robotic head crowned with a regal gold forehead crest housing all six glowing Infinity Stones in the center, blazing cosmic aura and intricate mechanical plating."),
]

CUSTOM_CURSORS = [
    ("web_shooter_cursor", "3D game cursor icon: sleek Spider-Man red-and-black mechanical web-shooter wrist pointer shooting a crisp white web strand tip toward top-left corner, angled like a mouse cursor. " + NO_REF_RULE),
    ("repulsor_cursor", "3D game cursor icon: Iron Man red-and-gold armored gauntlet hand pointing top-left with a bright glowing cyan-blue Arc Reactor repulsor beam core in the palm. " + NO_REF_RULE),
    ("vibranium_shield_cursor", "3D game cursor icon: glossy Captain America circular red-white-and-blue Vibranium shield with silver center star, tilted slightly in crisp 3D like a collectible pointer icon. " + NO_REF_RULE),
    ("mjolnir_cursor", "3D game cursor icon: Thor's heavy silver enchanted hammer Mjolnir with leather-wrapped handle, Norse engravings, and crackling bright cyan lightning arcs, angled top-left. " + NO_REF_RULE),
    ("sling_ring_cursor", "3D game cursor icon: Doctor Strange ornate golden brass twin-loop mystic Sling Ring radiating spinning orange-gold eldritch spark runes. " + NO_REF_RULE),
    ("chaos_hex_cursor", "3D game cursor icon: Scarlet Witch glowing crimson-red chaos magic hex orb surrounded by jagged scarlet crown energy shards, angled as a sharp magical pointer. " + NO_REF_RULE),
    ("stormbreaker_cursor", "3D game cursor icon: cosmic Uru metal battle axe Stormbreaker with Groot wood-branch handle and glowing Bifrost rainbow-blue lightning edge, angled top-left. " + NO_REF_RULE),
    ("infinity_gauntlet_cursor", "3D game cursor icon: Nano Iron-Gold and Crimson Infinity Gauntlet pointing index finger toward top-left with all six colorful glowing Infinity Stones set on the knuckles. " + NO_REF_RULE),
]

CRATES = [
    ("normal_crate", "3D stylized loot crate box icon: sturdy navy-blue and silver Avengers tactical supply crate with a subtle white star emblem on the front and clean metal latches. " + NO_REF_RULE),
    ("stark_crate", "3D stylized loot crate box icon: high-tech crimson-red and brushed-gold Stark Industries armored tech chest with a glowing cyan Arc Reactor lock in the center. " + NO_REF_RULE),
    ("wakanda_crate", "3D stylized loot crate box icon: sleek matte-black obsidian and shimmering purple Wakandan Vibranium vault crate etched with glowing violet tribal lines. " + NO_REF_RULE),
    ("infinity_crate", "3D stylized loot crate box icon: cosmic obsidian-and-gold celestial Infinity Vault chest glowing with purple nebula seams and six colorful gem sockets across the lid. " + NO_REF_RULE),
]

GAUNTLET_ASSETS = [
    ("infinity_gauntlet", "3D stylized game artifact icon: massive gleaming brushed-gold Thanos Infinity Gauntlet held upright with open fingers showing the six distinct recessed stone sockets across the knuckles and thumb. " + NO_REF_RULE),
    ("stone_space", "3D game gem icon: luminous cobalt-blue crystalline Space Infinity Stone jewel, faceted glowing cosmic tesseract gem on pure white background. " + NO_REF_RULE),
    ("stone_mind", "3D game gem icon: luminous golden-yellow crystalline Mind Infinity Stone jewel, faceted glowing radiant gem on pure white background. " + NO_REF_RULE),
    ("stone_reality", "3D game gem icon: luminous crimson-red crystalline Reality Infinity Stone jewel, faceted glowing aether gem on pure white background. " + NO_REF_RULE),
    ("stone_power", "3D game gem icon: luminous vibrant violet-purple crystalline Power Infinity Stone jewel, faceted glowing cosmic gem on pure white background. " + NO_REF_RULE),
    ("stone_time", "3D game gem icon: luminous emerald-green crystalline Time Infinity Stone jewel, faceted glowing agamotto gem on pure white background. " + NO_REF_RULE),
    ("stone_soul", "3D game gem icon: luminous fiery amber-orange crystalline Soul Infinity Stone jewel, faceted glowing celestial gem on pure white background. " + NO_REF_RULE),
]


def main():
    print("Loading BiRefNet-General session...")
    sess = new_session("birefnet-general")

    jobs = []
    for i, (skin_id, desc) in enumerate(MARVEL_SKINS, start=1):
        out_path = os.path.join(SKINS_DIR, f"{skin_id}.png")
        prompt = f"{desc} {CONSISTENT_RULE}"
        jobs.append((skin_id, prompt, NEGATIVE_SKIN_DEFAULT, "Main Mathew.png", 640, 20, 512, 300000 + i, out_path))

    for i, (cid, prompt) in enumerate(CUSTOM_CURSORS, start=1):
        out_path = os.path.join(CURSORS_DIR, f"{cid}.png")
        jobs.append((cid, prompt, NEGATIVE_OBJECT_DEFAULT, None, 512, 18, 256, 400000 + i, out_path))

    for i, (cr_id, prompt) in enumerate(CRATES, start=1):
        out_path = os.path.join(CRATES_DIR, f"{cr_id}.png")
        jobs.append((cr_id, prompt, NEGATIVE_OBJECT_DEFAULT, None, 640, 20, 512, 500000 + i, out_path))

    for i, (g_id, prompt) in enumerate(GAUNTLET_ASSETS, start=1):
        out_path = os.path.join(GAUNTLET_DIR, f"{g_id}.png")
        tsize = 512 if g_id == "infinity_gauntlet" else 256
        jobs.append((g_id, prompt, NEGATIVE_OBJECT_DEFAULT, None, 512, 18, tsize, 600000 + i, out_path))

    total = len(jobs)
    done_count = 0
    for idx, (asset_id, prompt, neg, ref_img, res, steps, tsize, seed, out_path) in enumerate(jobs, start=1):
        if os.path.exists(out_path) and os.path.getsize(out_path) > 4000:
            done_count += 1
            print(f"[{idx}/{total}] SKIP (exists): {asset_id}")
            continue

        t0 = time.time()
        wf = build_qwen_workflow(
            prompt=prompt,
            negative_prompt=neg,
            filename_prefix=f"s3_{asset_id}",
            seed=seed,
            ref_image=ref_img,
            resolution=res,
            steps=steps,
        )
        raw_out = run_comfy_job(wf)
        remove_bg_high_quality(raw_out, out_path, sess, target_size=tsize)
        done_count += 1
        dt = time.time() - t0
        print(f"[{idx}/{total}] OK ({dt:.1f}s): {asset_id} -> {out_path}", flush=True)

    print(f"ALL DONE: {done_count}/{total} assets ready!")


if __name__ == "__main__":
    main()
