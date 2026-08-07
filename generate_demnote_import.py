#!/usr/bin/env python3
"""
Generate the demnotes-importable markdown file from vocabulary .txt files.

Usage: python3 generate_demnote_import.py > demnote_vocab_import.md

Flashcard format: Front >> Back
demnotes builds its doc/unit/card tree from the tab indentation.

Languages and unit files are DISCOVERED from vocabulary/<Language>/*.txt.
CURATED_ORDER below only controls ordering and pretty unit names; any file
not listed there is still included, sorted after the curated ones. This
means a new language or unit file is picked up automatically.
"""

import re
from pathlib import Path

VOCAB_DIR = Path(__file__).parent / "vocabulary"

# Directories under vocabulary/ that are not languages.
SKIP_DIRS = {"Media Test"}

# Pretty names for languages. Anything discovered but not listed here just
# uses its directory name.
LANG_DISPLAY = {
    "Japanese": "Japanese 🇯🇵",
    "Spanish": "Spanish 🇪🇸",
    "German": "German 🇩🇪",
    "Chinese": "Chinese 🇨🇳",
    "Icelandic": "Icelandic 🇮🇸",
    "Arabic": "Arabic 🇸🇦",
}

# Preferred ordering + display names. Files omitted here are appended
# alphabetically with a name derived from the filename.
CURATED_ORDER = {
    "Japanese": [
        ("japanese_greetings.txt", "Greetings"),
        ("japanese_essentials.txt", "Essentials"),
        ("japanese_introductions.txt", "Introductions"),
        ("japanese_countries.txt", "Countries & Locations"),
        ("japanese_occupations.txt", "Occupations"),
        ("japanese_adjectives.txt", "Adjectives"),
        ("hiragana_vowels.txt", "Hiragana — Vowels (a i u e o)"),
        ("hiragana_ka_ki_ku_ke_ko.txt", "Hiragana — ka ki ku ke ko"),
        ("hiragana_ga_gi_gu_ge_go.txt", "Hiragana — ga gi gu ge go"),
        ("hiragana_sa_si_su_se_so.txt", "Hiragana — sa shi su se so"),
        ("hiragana_za_ji_zu_ze_zo.txt", "Hiragana — za ji zu ze zo"),
        ("hiragana_ta_chi_tsu_te_to.txt", "Hiragana — ta chi tsu te to"),
        ("hiragana_da_ji_zu_de_do.txt", "Hiragana — da ji zu de do"),
        ("hiragana_na_ni_nu_ne_no.txt", "Hiragana — na ni nu ne no"),
        ("katakana_vowels.txt", "Katakana — Vowels"),
        ("japanese_numbers_0_10.txt", "Numbers 0–10"),
        ("japanese_numbers_11_100.txt", "Numbers 11–100"),
        ("japanese_numbers_100_10000.txt", "Numbers 100–10,000"),
    ],
    "Spanish": [
        ("spanish_greetings.txt", "Greetings"),
        ("spanish_introductions.txt", "Introductions"),
        ("spanish_pronouns.txt", "Pronouns"),
        ("spanish_location.txt", "Location"),
        ("spanish_family.txt", "Family"),
        ("spanish_appearance.txt", "Appearance"),
        ("spanish_physical_descriptions.txt", "Physical Descriptions"),
        ("spanish_vocabulary.txt", "Everyday Vocabulary"),
        ("spanish_tener.txt", "Verb — tener (to have)"),
        ("spanish_estar_gerund_pronouns.txt", "Estar + Gerund & Pronouns"),
        ("spanish_possessives.txt", "Possessives"),
        ("spanish_numbers_0_10.txt", "Numbers 0–10"),
        ("spanish_numbers_11_30.txt", "Numbers 11–30"),
        ("spanish_numbers_30_1000.txt", "Numbers 30–1,000"),
    ],
    "German": [
        ("german_vocabulary.txt", "Core Vocabulary"),
        ("german_numbers_0_10.txt", "Numbers 0–10"),
        ("german_numbers_11_20.txt", "Numbers 11–20"),
        ("german_numbers_20_100.txt", "Numbers 20–100"),
        ("german_numbers_100_1000.txt", "Numbers 100–1,000"),
    ],
    "Chinese": [
        ("chinese_vocabulary.txt", "Core Vocabulary"),
        ("chinese_numbers_0_10.txt", "Numbers 0–10"),
        ("chinese_numbers_11_100.txt", "Numbers 11–100"),
        ("chinese_numbers_100_10000.txt", "Numbers 100–10,000"),
    ],
    "Icelandic": [
        ("icelandic_vocabulary.txt", "Core Vocabulary"),
        ("icelandic_numbers_0_10.txt", "Numbers 0–10"),
        ("icelandic_numbers_11_20.txt", "Numbers 11–20"),
        ("icelandic_numbers_20_1000.txt", "Numbers 20–1,000"),
    ],
    "Arabic": [
        ("arabic_greetings.txt", "Greetings"),
    ],
}


def derive_unit_name(filename: str, lang_key: str) -> str:
    """Turn 'japanese_body_parts.txt' into 'Body Parts'."""
    stem = filename[:-4] if filename.endswith(".txt") else filename
    prefix = lang_key.lower() + "_"
    if stem.lower().startswith(prefix):
        stem = stem[len(prefix):]
    return stem.replace("_", " ").strip().title() or filename


def units_for(lang_key: str, lang_dir: Path) -> list[tuple[Path, str]]:
    """Curated files first (in order), then any others alphabetically."""
    curated = CURATED_ORDER.get(lang_key, [])
    curated_names = {name for name, _ in curated}
    units: list[tuple[Path, str]] = []

    for filename, unit_name in curated:
        path = lang_dir / filename
        if path.is_file():
            units.append((path, unit_name))

    for path in sorted(lang_dir.glob("*.txt")):
        if path.name not in curated_names:
            units.append((path, derive_unit_name(path.name, lang_key)))

    return units


def strip_line_number(text: str) -> str:
    """Remove leading numeric tab prefix used by some files: '1\tword'"""
    return re.sub(r"^\d+\t", "", text)


def parse_entry(line: str) -> tuple[str, str, str] | None:
    """Parse pipe-delimited vocab entry into (front, back, word_type)."""
    line = strip_line_number(line.strip())
    if not line:
        return None
    parts = line.split("|")
    if len(parts) < 2:
        return None
    front = parts[0].strip()
    back = parts[1].strip()
    word_type = parts[2].strip() if len(parts) > 2 else ""
    if not front or not back:
        return None
    return front, back, word_type


def format_flashcard(front: str, back: str, word_type: str) -> str:
    """Format as a basic forward flashcard with optional type hint."""
    if word_type:
        return f"{front} >> {back} ({word_type})"
    return f"{front} >> {back}"


def discover_languages() -> list[str]:
    """Language dirs under vocabulary/, curated ones first, then the rest."""
    if not VOCAB_DIR.is_dir():
        return []
    found = {
        d.name
        for d in VOCAB_DIR.iterdir()
        if d.is_dir() and d.name not in SKIP_DIRS and any(d.glob("*.txt"))
    }
    ordered = [k for k in CURATED_ORDER if k in found]
    ordered += sorted(found - set(ordered))
    return ordered


def generate_import() -> str:
    lines = ["Language Study", ""]

    for lang_key in discover_languages():
        lang_dir = VOCAB_DIR / lang_key
        lines.append(f"\t{LANG_DISPLAY.get(lang_key, lang_key)}")

        for path, unit_name in units_for(lang_key, lang_dir):
            entries = [
                parsed
                for raw_line in path.read_text(encoding="utf-8").splitlines()
                if (parsed := parse_entry(raw_line))
            ]
            if not entries:
                continue

            lines.append(f"\t\t{unit_name}")
            for front, back, word_type in entries:
                lines.append(f"\t\t\t{format_flashcard(front, back, word_type)}")

        lines.append("")

    return "\n".join(lines)


if __name__ == "__main__":
    print(generate_import())
