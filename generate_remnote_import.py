#!/usr/bin/env python3
"""
Generate a RemNote-importable markdown file from vocabulary .txt files.

Usage: python3 generate_remnote_import.py > remnote_vocab_import.md

Flashcard format: Front >> Back
RemNote imports nested structure from tab-indented markdown.
"""

import os
import re
from pathlib import Path

VOCAB_DIR = Path(__file__).parent / "vocabulary"

# Map folder names to display names and their file ordering
LANGUAGES = {
    "Japanese": {
        "display": "Japanese 🇯🇵",
        "files": [
            ("japanese_essentials.txt", "Essentials"),
            ("japanese_introductions.txt", "Introductions"),
            ("japanese_occupations.txt", "Occupations"),
            ("hiragana_vowels.txt", "Hiragana — Vowels (a i u e o)"),
            ("hiragana_ka_ki_ku_ke_ko.txt", "Hiragana — ka ki ku ke ko"),
            ("japanese_numbers_0_10.txt", "Numbers 0–10"),
            ("japanese_numbers_11_100.txt", "Numbers 11–100"),
            ("japanese_numbers_100_10000.txt", "Numbers 100–10,000"),
        ],
    },
    "Spanish": {
        "display": "Spanish 🇪🇸",
        "files": [
            ("spanish_greetings.txt", "Greetings"),
            ("spanish_introductions.txt", "Introductions"),
            ("spanish_pronouns.txt", "Pronouns"),
            ("spanish_location.txt", "Location"),
            ("spanish_family.txt", "Family"),
            ("spanish_appearance.txt", "Appearance"),
            ("spanish_vocabulary.txt", "Everyday Vocabulary"),
            ("spanish_numbers_0_10.txt", "Numbers 0–10"),
            ("spanish_numbers_11_30.txt", "Numbers 11–30"),
            ("spanish_numbers_30_1000.txt", "Numbers 30–1,000"),
        ],
    },
    "German": {
        "display": "German 🇩🇪",
        "files": [
            ("german_vocabulary.txt", "Core Vocabulary"),
            ("german_numbers_0_10.txt", "Numbers 0–10"),
            ("german_numbers_11_20.txt", "Numbers 11–20"),
            ("german_numbers_20_100.txt", "Numbers 20–100"),
            ("german_numbers_100_1000.txt", "Numbers 100–1,000"),
        ],
    },
    "Chinese": {
        "display": "Chinese 🇨🇳",
        "files": [
            ("chinese_vocabulary.txt", "Core Vocabulary"),
            ("chinese_numbers_0_10.txt", "Numbers 0–10"),
            ("chinese_numbers_11_100.txt", "Numbers 11–100"),
            ("chinese_numbers_100_10000.txt", "Numbers 100–10,000"),
        ],
    },
    "Icelandic": {
        "display": "Icelandic 🇮🇸",
        "files": [
            ("icelandic_vocabulary.txt", "Core Vocabulary"),
            ("icelandic_numbers_0_10.txt", "Numbers 0–10"),
            ("icelandic_numbers_11_20.txt", "Numbers 11–20"),
            ("icelandic_numbers_20_1000.txt", "Numbers 20–1,000"),
        ],
    },
}


def strip_line_number(text: str) -> str:
    """Remove leading numeric tab prefix used by Spanish files: '1\tword'"""
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
    return front, back, word_type


def format_flashcard(front: str, back: str, word_type: str) -> str:
    """Format as RemNote basic forward flashcard with optional type hint."""
    if word_type:
        return f"{front} >> {back} ({word_type})"
    return f"{front} >> {back}"


def generate_import() -> str:
    lines = ["Language Study", ""]

    for lang_key, lang_info in LANGUAGES.items():
        lang_dir = VOCAB_DIR / lang_key
        if not lang_dir.exists():
            continue

        lines.append(f"\t{lang_info['display']}")

        for filename, unit_name in lang_info["files"]:
            filepath = lang_dir / filename
            if not filepath.exists():
                continue

            entries = []
            for raw_line in filepath.read_text(encoding="utf-8").splitlines():
                parsed = parse_entry(raw_line)
                if parsed:
                    entries.append(parsed)

            if not entries:
                continue

            lines.append(f"\t\t{unit_name}")
            for front, back, word_type in entries:
                card = format_flashcard(front, back, word_type)
                lines.append(f"\t\t\t{card}")

        lines.append("")

    return "\n".join(lines)


if __name__ == "__main__":
    print(generate_import())
