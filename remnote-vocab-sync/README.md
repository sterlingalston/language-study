# Language Vocabulary Sync — RemNote Plugin

Auto-syncs vocabulary flashcards from the [language-study GitHub repo](https://github.com/sterlingalston/language-study) into your RemNote knowledge base.

## What it does

- Creates a **"Language Study"** root Rem in your knowledge base on first run
- Under it: one Rem per language → one Rem per vocabulary unit → flashcard children
- Flashcard format: `Front >> Back (type)` (basic forward flashcard, quizzed by RemNote's SRS)
- Runs automatically once per day when RemNote opens; also available via Command Palette (`Ctrl+P` → "Sync Language Vocabulary")
- Skips units that haven't changed since the last sync (hash-based)

## Quick start — import file (no plugin needed)

If you just want to import once manually:

1. Copy the contents of `../remnote_vocab_import.md`
2. In RemNote: open a document → paste the text → RemNote auto-creates the hierarchy and flashcards

## Full setup — automated plugin

### Prerequisites

- Node.js 18+
- A RemNote account (free tier works)

### Steps

**1. Build the plugin**

```bash
cd remnote-vocab-sync
npm install
npm run build
```

This compiles `src/index.tsx` into `public/index.js`.

**2. Serve locally**

```bash
npx webpack serve --mode development
# Plugin now runs at http://localhost:9001
```

Or for production (one-time build, no server needed):

```bash
npm run build
# Serve the public/ directory from any static file server
npx serve public -p 9001
```

**3. Load into RemNote**

1. Open [remnote.com](https://www.remnote.com) (or the desktop app)
2. Go to **Settings → Plugins → Enable Developer Mode**
3. Click **Load Local Plugin** and enter: `http://localhost:9001`
4. The plugin appears in your plugin list as "Language Vocabulary Sync"

**4. First sync**

- The plugin auto-syncs ~3 seconds after RemNote loads (if more than 24 hours since last sync)
- Or: press `Ctrl+P` → type "Sync Language Vocabulary" → press Enter
- Watch for the toast notification: "added N new unit(s)"

## Structure created in RemNote

```
Language Study
├── Japanese
│   ├── Essentials          (30 flashcards)
│   ├── Introductions       (11 flashcards)
│   ├── Occupations         (7 flashcards)
│   ├── Hiragana — Vowels   (5 flashcards)
│   ├── Hiragana — ka ki... (5 flashcards)
│   ├── Numbers 0–10        (12 flashcards)
│   ├── Numbers 11–100      (19 flashcards)
│   └── Numbers 100–10,000  (14 flashcards)
├── Spanish  (10 units)
├── German   (5 units)
├── Chinese  (4 units)
└── Icelandic (4 units)
```

## Studying

- Click any unit Rem → click **Practice** to start an SRS quiz on that unit
- Click "Language Study" → **Practice** to quiz across all languages at once
- RemNote tracks your performance and schedules reviews automatically

## How updates work

Each time the plugin runs it fetches the vocabulary files from GitHub.  
Units whose content hash hasn't changed are skipped.  
Changed units have their flashcards replaced with the new content.
