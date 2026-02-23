# Vocabulary Processing

## How to use

When you have new PNG screenshots from Busuu:

1. Save them anywhere in the `Busuu/` folder
2. Open Claude Code in this directory
3. Type: **"process new vocabulary"**

Claude will automatically:

- Find new PNG files
- Extract vocabulary entries
- Add them to the appropriate vocabulary files
- Update entry numbering

## File structure

- `Busuu/{Language}/*.png` - Screenshots from Busuu app
- `vocabulary/{Language}/{language}_vocabulary.txt` - Processed vocabulary entries

Entry format: `{number}→{foreign text} / {romanization}|{english}|{category}`
