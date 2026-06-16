import { declareIndexPlugin, ReactRNPlugin, WidgetLocation } from '@remnote/plugin-sdk';

const GITHUB_BASE =
  'https://raw.githubusercontent.com/sterlingalston/language-study/refs/heads/master/vocabulary';

const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // once per day
const ROOT_REM_NAME = 'Language Study';
const SETTING_LAST_SYNC = 'lastSyncTimestamp';
const SETTING_FILE_HASHES = 'fileHashes';

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

// Strip leading `N\t` line numbers used by Spanish files
function stripLineNumber(line: string): string {
  return line.replace(/^\d+\t/, '');
}

// Parse `front|back|type` or `N\tfront|back|type` into a flashcard string
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

// Build the tab-indented markdown for one unit (unit name + its flashcards as children)
function buildUnitMarkdown(unitName: string, lines: string[]): string {
  const cards = lines.map(parseLine).filter((l): l is string => l !== null);
  if (cards.length === 0) return '';
  return [unitName, ...cards.map((c) => `\t${c}`)].join('\n');
}

// Simple hash for change detection — just a content length + checksum
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
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function findOrCreateChildByName(
  plugin: ReactRNPlugin,
  name: string,
  parentId: string
): Promise<string | null> {
  const parent = await plugin.rem.findOne(parentId);
  if (!parent) return null;

  const children = await parent.getChildrenRem();
  for (const child of children ?? []) {
    const text = await child.text;
    if (Array.isArray(text) && text[0]?.text === name) return child._id;
    if (typeof text === 'string' && text === name) return child._id;
  }

  const newRem = await plugin.rem.createRem();
  if (!newRem) return null;
  await newRem.setText([{ i: 'q', text: name }] as any);
  await newRem.setParent(parentId);
  return newRem._id;
}

async function syncVocabulary(plugin: ReactRNPlugin): Promise<void> {
  await plugin.app.toast('Language Vocab Sync: starting…');

  const storedHashes: Record<string, string> =
    ((await plugin.settings.getSetting(SETTING_FILE_HASHES)) as Record<string, string>) ?? {};
  const updatedHashes: Record<string, string> = { ...storedHashes };

  // Find or create root "Language Study" Rem
  let rootRemId: string | null = null;
  const allRem = await plugin.rem.getAll();
  for (const r of allRem) {
    const t = await r.text;
    const text = Array.isArray(t) ? t[0]?.text : t;
    if (text === ROOT_REM_NAME && !(await r.getParentRem())) {
      rootRemId = r._id;
      break;
    }
  }
  if (!rootRemId) {
    const root = await plugin.rem.createRem();
    if (!root) {
      await plugin.app.toast('Language Vocab Sync: failed to create root Rem.');
      return;
    }
    await root.setText([{ i: 'q', text: ROOT_REM_NAME }] as any);
    rootRemId = root._id;
  }

  let newUnits = 0;
  let updatedUnits = 0;

  for (const [langKey, langConfig] of Object.entries(LANGUAGES)) {
    const langRemId = await findOrCreateChildByName(plugin, langConfig.display, rootRemId);
    if (!langRemId) continue;

    for (const unit of langConfig.units) {
      const url = `${GITHUB_BASE}/${langKey}/${unit.filename}`;
      const content = await fetchText(url);
      if (!content) continue;

      const hash = simpleHash(content);
      const cacheKey = `${langKey}/${unit.filename}`;
      const isNew = !storedHashes[cacheKey];
      const isChanged = storedHashes[cacheKey] !== hash;

      if (!isNew && !isChanged) continue; // already up to date

      const lines = content.split('\n');
      const markdown = buildUnitMarkdown(unit.display, lines);
      if (!markdown) continue;

      if (isNew) {
        // Create new unit rem + flashcards via markdown
        const unitRem = await plugin.rem.createRem();
        if (!unitRem) continue;
        await unitRem.setText([{ i: 'q', text: unit.display }] as any);
        await unitRem.setParent(langRemId);
        await plugin.rem.createTreeWithMarkdown(
          lines
            .map(parseLine)
            .filter((l): l is string => l !== null)
            .join('\n'),
          unitRem._id
        );
        newUnits++;
      } else {
        // Changed: replace children of existing unit rem
        const unitRemId = await findOrCreateChildByName(plugin, unit.display, langRemId);
        if (!unitRemId) continue;
        const unitRem = await plugin.rem.findOne(unitRemId);
        if (!unitRem) continue;
        // Remove old children
        const oldChildren = (await unitRem.getChildrenRem()) ?? [];
        for (const child of oldChildren) await child.remove();
        // Re-add from updated file
        await plugin.rem.createTreeWithMarkdown(
          lines
            .map(parseLine)
            .filter((l): l is string => l !== null)
            .join('\n'),
          unitRemId
        );
        updatedUnits++;
      }

      updatedHashes[cacheKey] = hash;
    }
  }

  await plugin.settings.setSetting(SETTING_FILE_HASHES, updatedHashes);
  await plugin.settings.setSetting(SETTING_LAST_SYNC, Date.now().toString());

  const msg =
    newUnits + updatedUnits === 0
      ? 'Language Vocab Sync: already up to date.'
      : `Language Vocab Sync: added ${newUnits} new unit(s), updated ${updatedUnits} unit(s).`;
  await plugin.app.toast(msg);
}

async function onActivate(plugin: ReactRNPlugin): Promise<void> {
  // Manual sync command accessible from RemNote's command palette (Ctrl+P)
  await plugin.app.registerCommand({
    id: 'sync-language-vocab',
    name: 'Sync Language Vocabulary from GitHub',
    description: 'Fetch latest vocabulary and create/update flashcard Rem',
    action: async () => syncVocabulary(plugin),
  });

  // Auto-sync once per day on load
  const lastSync = (await plugin.settings.getSetting(SETTING_LAST_SYNC)) as string | undefined;
  const elapsed = lastSync ? Date.now() - Number(lastSync) : Infinity;
  if (elapsed > SYNC_INTERVAL_MS) {
    // Defer slightly so RemNote finishes loading first
    setTimeout(() => syncVocabulary(plugin), 3000);
  }
}

async function onDeactivate(_plugin: ReactRNPlugin): Promise<void> {}

declareIndexPlugin(onActivate, onDeactivate);
