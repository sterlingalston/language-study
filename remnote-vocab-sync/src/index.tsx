import {
  declareIndexPlugin,
  ReactRNPlugin,
  RichTextInterface,
  PluginRem as RemObject,
} from '@remnote/plugin-sdk';

const GITHUB_BASE =
  'https://raw.githubusercontent.com/sterlingalston/language-study/refs/heads/master/vocabulary';

const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;
const ROOT_REM_NAME = 'Language Study';
const KEY_LAST_SYNC = 'lastSync';
const KEY_HASHES = 'fileHashes';

interface UnitConfig {
  filename: string;
  display: string;
}

interface LangConfig {
  display: string;
  units: UnitConfig[];
}

const LANGUAGES: Record<string, LangConfig> = {
  Japanese: {
    display: 'Japanese',
    units: [
      { filename: 'japanese_essentials.txt', display: 'Essentials' },
      { filename: 'japanese_introductions.txt', display: 'Introductions' },
      { filename: 'japanese_occupations.txt', display: 'Occupations' },
      { filename: 'hiragana_vowels.txt', display: 'Hiragana — Vowels' },
      { filename: 'hiragana_ka_ki_ku_ke_ko.txt', display: 'Hiragana — ka ki ku ke ko' },
      { filename: 'japanese_numbers_0_10.txt', display: 'Numbers 0–10' },
      { filename: 'japanese_numbers_11_100.txt', display: 'Numbers 11–100' },
      { filename: 'japanese_numbers_100_10000.txt', display: 'Numbers 100–10,000' },
    ],
  },
  Spanish: {
    display: 'Spanish',
    units: [
      { filename: 'spanish_greetings.txt', display: 'Greetings' },
      { filename: 'spanish_introductions.txt', display: 'Introductions' },
      { filename: 'spanish_pronouns.txt', display: 'Pronouns' },
      { filename: 'spanish_location.txt', display: 'Location' },
      { filename: 'spanish_family.txt', display: 'Family' },
      { filename: 'spanish_appearance.txt', display: 'Appearance' },
      { filename: 'spanish_vocabulary.txt', display: 'Everyday Vocabulary' },
      { filename: 'spanish_numbers_0_10.txt', display: 'Numbers 0–10' },
      { filename: 'spanish_numbers_11_30.txt', display: 'Numbers 11–30' },
      { filename: 'spanish_numbers_30_1000.txt', display: 'Numbers 30–1,000' },
    ],
  },
  German: {
    display: 'German',
    units: [
      { filename: 'german_vocabulary.txt', display: 'Core Vocabulary' },
      { filename: 'german_numbers_0_10.txt', display: 'Numbers 0–10' },
      { filename: 'german_numbers_11_20.txt', display: 'Numbers 11–20' },
      { filename: 'german_numbers_20_100.txt', display: 'Numbers 20–100' },
      { filename: 'german_numbers_100_1000.txt', display: 'Numbers 100–1,000' },
    ],
  },
  Chinese: {
    display: 'Chinese',
    units: [
      { filename: 'chinese_vocabulary.txt', display: 'Core Vocabulary' },
      { filename: 'chinese_numbers_0_10.txt', display: 'Numbers 0–10' },
      { filename: 'chinese_numbers_11_100.txt', display: 'Numbers 11–100' },
      { filename: 'chinese_numbers_100_10000.txt', display: 'Numbers 100–10,000' },
    ],
  },
  Icelandic: {
    display: 'Icelandic',
    units: [
      { filename: 'icelandic_vocabulary.txt', display: 'Core Vocabulary' },
      { filename: 'icelandic_numbers_0_10.txt', display: 'Numbers 0–10' },
      { filename: 'icelandic_numbers_11_20.txt', display: 'Numbers 11–20' },
      { filename: 'icelandic_numbers_20_1000.txt', display: 'Numbers 20–1,000' },
    ],
  },
};

// Extract plain string from RemNote's RichText format
function richTextToString(rt: RichTextInterface | undefined): string {
  if (!rt) return '';
  return rt
    .map((el) => (typeof el === 'string' ? el : 'text' in el ? (el as any).text ?? '' : ''))
    .join('');
}

// Strip leading `N\t` line numbers (used by Spanish files)
function stripLineNumber(line: string): string {
  return line.replace(/^\d+\t/, '');
}

// Parse pipe-delimited entry into a RemNote flashcard string `front >> back (type)`
function parseLine(raw: string): string | null {
  const line = stripLineNumber(raw.trim());
  if (!line) return null;
  const parts = line.split('|');
  if (parts.length < 2) return null;
  const front = parts[0].trim();
  const back = parts[1].trim();
  const type = parts[2]?.trim();
  if (!front || !back) return null;
  return type ? `${front} >> ${back} (${type})` : `${front} >> ${back}`;
}

function simpleHash(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
  }
  return `${text.length}:${h >>> 0}`;
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

// Find a direct child rem by its plain-text name, or create one
async function findOrCreateChild(
  plugin: ReactRNPlugin,
  name: string,
  parentId: string
): Promise<RemObject | undefined> {
  const parent = await plugin.rem.findOne(parentId);
  if (!parent) return undefined;

  const children = await parent.getChildrenRem();
  for (const child of children) {
    if (richTextToString(child.text) === name) return child;
  }

  const newRem = await plugin.rem.createRem();
  if (!newRem) return undefined;
  await newRem.setText([{ i: 'm', text: name }]);
  await newRem.setParent(parentId);
  return newRem;
}

async function syncVocabulary(plugin: ReactRNPlugin): Promise<void> {
  await plugin.app.toast('Language Vocab Sync: starting…');

  const storedHashes = (await plugin.storage.getLocal<Record<string, string>>(KEY_HASHES)) ?? {};
  const updatedHashes: Record<string, string> = { ...storedHashes };

  // Find or create the root "Language Study" Rem (top-level document)
  let rootRem: RemObject | undefined;
  const allRem = await plugin.rem.getAll();
  for (const r of allRem) {
    if (richTextToString(r.text) === ROOT_REM_NAME && !(await r.getParentRem())) {
      rootRem = r;
      break;
    }
  }
  if (!rootRem) {
    rootRem = await plugin.rem.createRem();
    if (!rootRem) {
      await plugin.app.toast('Language Vocab Sync: failed to create root Rem.');
      return;
    }
    await rootRem.setText([{ i: 'm', text: ROOT_REM_NAME }]);
  }

  let newCount = 0;
  let updatedCount = 0;

  for (const [langKey, langConfig] of Object.entries(LANGUAGES)) {
    const langRem = await findOrCreateChild(plugin, langConfig.display, rootRem._id);
    if (!langRem) continue;

    for (const unit of langConfig.units) {
      const url = `${GITHUB_BASE}/${langKey}/${unit.filename}`;
      const content = await fetchText(url);
      if (!content) continue;

      const hash = simpleHash(content);
      const cacheKey = `${langKey}/${unit.filename}`;
      const isNew = !storedHashes[cacheKey];
      const isChanged = storedHashes[cacheKey] !== hash;

      if (!isNew && !isChanged) continue;

      const flashcards = content
        .split('\n')
        .map(parseLine)
        .filter((l): l is string => l !== null)
        .join('\n');

      if (!flashcards) continue;

      if (isNew) {
        // Create unit rem + flashcards in one tree call:
        //   "<unit name>\n\t<card1>\n\t<card2>..."
        const unitMarkdown = `${unit.display}\n${flashcards.split('\n').map((c) => `\t${c}`).join('\n')}`;
        await plugin.rem.createTreeWithMarkdown(unitMarkdown, langRem._id);
        newCount++;
      } else {
        // Replace flashcards under the existing unit rem
        const unitRem = await findOrCreateChild(plugin, unit.display, langRem._id);
        if (!unitRem) continue;
        const oldChildren = await unitRem.getChildrenRem();
        for (const child of oldChildren) await child.remove();
        await plugin.rem.createTreeWithMarkdown(flashcards, unitRem._id);
        updatedCount++;
      }

      updatedHashes[cacheKey] = hash;
    }
  }

  await plugin.storage.setLocal(KEY_HASHES, updatedHashes);
  await plugin.storage.setLocal(KEY_LAST_SYNC, Date.now().toString());

  const msg =
    newCount + updatedCount === 0
      ? 'Language Vocab Sync: already up to date.'
      : `Language Vocab Sync: +${newCount} new unit(s), ~${updatedCount} updated.`;
  await plugin.app.toast(msg);
}

async function onActivate(plugin: ReactRNPlugin): Promise<void> {
  await plugin.app.registerCommand({
    id: 'sync-language-vocab',
    name: 'Sync Language Vocabulary from GitHub',
    description: 'Fetch latest vocabulary and create/update flashcard Rem',
    action: async () => syncVocabulary(plugin),
  });

  // Auto-sync once per day on load
  const lastSync = await plugin.storage.getLocal<string>(KEY_LAST_SYNC);
  const elapsed = lastSync ? Date.now() - Number(lastSync) : Infinity;
  if (elapsed > SYNC_INTERVAL_MS) {
    setTimeout(() => syncVocabulary(plugin), 3000);
  }
}

async function onDeactivate(_plugin: ReactRNPlugin): Promise<void> {}

declareIndexPlugin(onActivate, onDeactivate);
