# Vocabulary Processing & Flashcard App

## Flashcard Web App

Open `index.html` in your browser to use the interactive flashcard app.

### Loading Vocabulary

**Method 1: Upload Local Files**
- Click "Load Files" and select `.txt` files from your computer
- Files are saved to browser localStorage

**Method 2: Paste Content from GitHub**
1. Go to your GitHub raw vocabulary file (e.g., `https://raw.githubusercontent.com/user/repo/main/vocab.txt`)
2. Copy all the content (Ctrl+A, Ctrl+C)
3. Paste into the textarea on the app
4. Enter a language name (e.g., "Japanese")
5. Click "Load Pasted Content"

**Method 3: Drag and Drop Files**
- Simply drag `.txt` files onto the file input

### Vocabulary Format

Each line should follow this format:
```
word/phrase | translation | notes (optional)
```

Examples:
```
hello | hola | greeting
こんにちは / konnichiwa | hello | greeting
buenos días | good morning | used until noon
```

### Study Modes

- **Flashcard Mode**: Click through cards, flip to see translations
- **Quiz Mode**: Type answers and get instant feedback with scoring

---

## Processing Busuu Screenshots

When you have new PNG screenshots from Busuu:

1. Save them anywhere in the `Busuu/` folder
2. Open Claude Code in this directory
3. Type: **"process new vocabulary"**

Claude will automatically:

- Find new PNG files
- Extract vocabulary entries
- Add them to the appropriate vocabulary files
- Update entry numbering

## File Structure

- `Busuu/{Language}/*.png` - Screenshots from Busuu app
- `vocabulary/{Language}/{language}_vocabulary.txt` - Processed vocabulary entries
- `index.html` - Flashcard web app
- `app.js` - Flashcard app logic

Entry format: `{number}→{foreign text} / {romanization}|{english}|{category}`
