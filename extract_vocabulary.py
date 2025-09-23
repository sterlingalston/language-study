#!/usr/bin/env python3
"""
Vocabulary Extractor from PNG Images

This script processes PNG files in a language directory and extracts vocabulary
using OCR, then appends it to the appropriate vocabulary file.

Usage:
    python extract_vocabulary.py "C:\Users\sterl\Documents\Languages\Busuu\German"
    python extract_vocabulary.py "C:\Users\sterl\Documents\Languages\Busuu\Spanish"

Requirements:
    pip install pytesseract pillow

Note: You'll also need to install Tesseract OCR:
    - Windows: Download from https://github.com/UB-Mannheim/tesseract/wiki
    - macOS: brew install tesseract
    - Linux: sudo apt-get install tesseract-ocr
"""

import argparse
import os
import sys
from pathlib import Path
import re
from typing import List, Tuple, Optional

try:
    import pytesseract
    from PIL import Image
except ImportError as e:
    print(f"Error: Required packages not installed.")
    print("Please install with: pip install pytesseract pillow")
    print(f"Missing: {e}")
    sys.exit(1)


class VocabularyExtractor:
    def __init__(self, language_dir: str):
        self.language_dir = Path(language_dir)
        self.language_name = self.language_dir.name
        self.output_dir = self.language_dir.parent.parent / "vocabulary" / self.language_name
        self.output_file = self.output_dir / f"{self.language_name.lower()}_vocabulary.txt"

        # Create output directory if it doesn't exist
        self.output_dir.mkdir(parents=True, exist_ok=True)

        # Language-specific OCR configurations
        self.ocr_configs = {
            'German': '--oem 3 --psm 6 -l deu+eng',
            'Spanish': '--oem 3 --psm 6 -l spa+eng',
            'French': '--oem 3 --psm 6 -l fra+eng',
            'Italian': '--oem 3 --psm 6 -l ita+eng',
            'Portuguese': '--oem 3 --psm 6 -l por+eng',
            'Chinese': '--oem 3 --psm 6 -l chi_sim+eng',
            'Japanese': '--oem 3 --psm 6 -l jpn+eng',
            'Arabic': '--oem 3 --psm 6 -l ara+eng',
            'Russian': '--oem 3 --psm 6 -l rus+eng',
            'Korean': '--oem 3 --psm 6 -l kor+eng'
        }

    def extract_text_from_image(self, image_path: Path) -> str:
        """Extract text from PNG image using OCR."""
        try:
            image = Image.open(image_path)
            config = self.ocr_configs.get(self.language_name, '--oem 3 --psm 6')
            text = pytesseract.image_to_string(image, config=config)
            return text.strip()
        except Exception as e:
            print(f"Error processing {image_path}: {e}")
            return ""

    def parse_vocabulary_table(self, text: str) -> List[Tuple[str, str, str]]:
        """Parse vocabulary from structured table text."""
        vocabulary = []
        lines = text.split('\n')

        for line in lines:
            line = line.strip()
            if not line:
                continue

            # Skip headers
            if any(header in line.lower() for header in ['german', 'english', 'spanish', 'french', 'word strength', 'strength']):
                continue

            # Try to extract vocabulary pairs from structured format
            # Look for patterns like: "German word | English translation"
            if '|' in line:
                parts = [part.strip() for part in line.split('|')]
                if len(parts) >= 2 and parts[0] and parts[1]:
                    vocabulary.append((parts[0], parts[1], parts[2] if len(parts) > 2 else ""))
            else:
                # Try to detect word pairs separated by whitespace/tabs
                # This is more complex and may need refinement based on actual image formats
                words = re.split(r'\s{2,}|\t', line)  # Split on multiple spaces or tabs
                words = [w.strip() for w in words if w.strip()]

                if len(words) >= 2:
                    # Filter out non-vocabulary words (like "Weak", numbers, etc.)
                    if not any(skip in words[0].lower() for skip in ['weak', 'strong', 'new', 'learning']):
                        vocabulary.append((words[0], words[1], ""))

        return vocabulary

    def smart_parse_vocabulary(self, text: str) -> List[Tuple[str, str, str]]:
        """Intelligent parsing that handles different image formats."""
        vocabulary = []

        # First try table parsing
        table_vocab = self.parse_vocabulary_table(text)
        if table_vocab:
            vocabulary.extend(table_vocab)

        # Alternative: Look for common language learning app patterns
        lines = text.split('\n')
        for i, line in enumerate(lines):
            line = line.strip()

            # Skip empty lines and headers
            if not line or any(header in line.lower() for header in
                             ['german', 'english', 'spanish', 'french', 'translation', 'word strength']):
                continue

            # Look for next line as potential translation
            if i + 1 < len(lines):
                next_line = lines[i + 1].strip()

                # Check if this looks like a foreign word followed by English
                if (line and next_line and
                    not any(skip in line.lower() for skip in ['weak', 'strong', 'new']) and
                    not any(skip in next_line.lower() for skip in ['weak', 'strong', 'new'])):

                    # Simple heuristic: if the line contains non-ASCII characters, it's likely foreign
                    has_foreign_chars = any(ord(c) > 127 for c in line)
                    if has_foreign_chars or self.language_name in ['German', 'Spanish', 'French']:
                        vocabulary.append((line, next_line, ""))

        return vocabulary

    def load_existing_vocabulary(self) -> set:
        """Load existing vocabulary to avoid duplicates."""
        existing = set()
        if self.output_file.exists():
            try:
                with open(self.output_file, 'r', encoding='utf-8') as f:
                    for line in f:
                        line = line.strip()
                        if '|' in line:
                            foreign_word = line.split('|')[0].strip()
                            existing.add(foreign_word.lower())
            except Exception as e:
                print(f"Warning: Could not read existing vocabulary file: {e}")
        return existing

    def append_vocabulary(self, vocabulary: List[Tuple[str, str, str]]) -> int:
        """Append new vocabulary to the output file."""
        if not vocabulary:
            return 0

        existing = self.load_existing_vocabulary()
        new_entries = []

        for foreign, english, notes in vocabulary:
            if foreign.lower() not in existing:
                new_entries.append((foreign, english, notes or "from image"))
                existing.add(foreign.lower())

        if new_entries:
            with open(self.output_file, 'a', encoding='utf-8') as f:
                for foreign, english, notes in new_entries:
                    f.write(f"{foreign}|{english}|{notes}\n")

        return len(new_entries)

    def process_directory(self) -> dict:
        """Process all PNG files in the directory."""
        png_files = list(self.language_dir.glob("*.png"))

        if not png_files:
            return {"error": f"No PNG files found in {self.language_dir}"}

        total_new_entries = 0
        processed_files = []

        print(f"Processing {len(png_files)} PNG files for {self.language_name}...")

        for png_file in png_files:
            print(f"  Processing: {png_file.name}")

            # Extract text from image
            text = self.extract_text_from_image(png_file)
            if not text:
                print(f"    No text extracted from {png_file.name}")
                continue

            # Parse vocabulary
            vocabulary = self.smart_parse_vocabulary(text)
            if not vocabulary:
                print(f"    No vocabulary found in {png_file.name}")
                continue

            # Append to file
            new_entries = self.append_vocabulary(vocabulary)
            total_new_entries += new_entries
            processed_files.append(png_file.name)

            print(f"    Added {new_entries} new entries from {png_file.name}")

        return {
            "processed_files": processed_files,
            "total_new_entries": total_new_entries,
            "output_file": str(self.output_file)
        }


def main():
    parser = argparse.ArgumentParser(description="Extract vocabulary from PNG images")
    parser.add_argument("directory", help="Path to language directory containing PNG files")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")

    args = parser.parse_args()

    # Validate directory
    directory = Path(args.directory)
    if not directory.exists():
        print(f"Error: Directory does not exist: {directory}")
        sys.exit(1)

    if not directory.is_dir():
        print(f"Error: Path is not a directory: {directory}")
        sys.exit(1)

    # Process the directory
    extractor = VocabularyExtractor(str(directory))
    result = extractor.process_directory()

    if "error" in result:
        print(f"Error: {result['error']}")
        sys.exit(1)

    print(f"\n✅ Processing complete!")
    print(f"📁 Processed files: {', '.join(result['processed_files'])}")
    print(f"📝 New vocabulary entries added: {result['total_new_entries']}")
    print(f"💾 Output file: {result['output_file']}")

    if result['total_new_entries'] > 0:
        print(f"\n🎉 Ready to use in your flashcard app!")


if __name__ == "__main__":
    main()