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
const KEY_ROOT_ID = 'rootRemId';
const KEY_LANG_IDS = 'langRemIds';
const KEY_UNIT_IDS = 'unitRemIds';
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
      { filename: 'hiragana_sa_si_su_se_so.txt', display: 'Hiragana — sa shi su se so' },
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

function richTextToString(rt: RichTextInterface | undefined): string {
  if (!rt) return '';
  return rt
    .map((el) => (typeof el === 'string' ? el : 'text' in el ? (el as any).text ?? '' : ''))
    .join('');
}

function stripLineNumber(line: string): string {
  return line.replace(/^\d+\t/, '');
}

interface ParsedCard {
  front: string;
  back: string;
}

function parseLine(raw: string): ParsedCard | null {
  const line = stripLineNumber(raw.trim());
  if (!line) return null;
  const parts = line.split('|');
  if (parts.length < 2) return null;
  const front = parts[0].trim();
  const back = parts[1].trim();
  const type = parts[2]?.trim();
  if (!front || !back) return null;
  return { front, back: type ? `${back} (${type})` : back };
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

async function makeText(text: string): Promise<RichTextInterface> {
  return [{ i: 'm', text }];
}

async function getOrCreateRem(
  plugin: ReactRNPlugin,
  cachedId: string | undefined,
  name: string,
  parentId?: string
): Promise<RemObject | undefined> {
  // Try cached ID first
  if (cachedId) {
    const existing = await plugin.rem.findOne(cachedId);
    if (existing) return existing;
  }

  // Create fresh
  const rem = await plugin.rem.createRem();
  if (!rem) return undefined;
  await rem.setText(await makeText(name));
  if (parentId) await rem.setParent(parentId);
  return rem;
}

async function syncVocabulary(plugin: ReactRNPlugin): Promise<void> {
  try {
    await ping('sync_started');
    await plugin.app.toast('Vocab sync: starting…');

    const storedHashes = (await plugin.storage.getLocal<Record<string, string>>(KEY_HASHES)) ?? {};
    const langIds = (await plugin.storage.getLocal<Record<string, string>>(KEY_LANG_IDS)) ?? {};
    const unitIds = (await plugin.storage.getLocal<Record<string, string>>(KEY_UNIT_IDS)) ?? {};
    const updatedHashes: Record<string, string> = { ...storedHashes };
    const updatedLangIds: Record<string, string> = { ...langIds };
    const updatedUnitIds: Record<string, string> = { ...unitIds };

    // Root rem
    const cachedRootId = await plugin.storage.getLocal<string>(KEY_ROOT_ID);
    const rootRem = await getOrCreateRem(plugin, cachedRootId ?? undefined, ROOT_REM_NAME);
    if (!rootRem) {
      await plugin.app.toast('Vocab sync ERROR: could not create root rem');
      return;
    }
    await rootRem.setIsDocument(true);
    await plugin.storage.setLocal(KEY_ROOT_ID, rootRem._id);
    await ping('root_rem_ok_' + rootRem._id);

    let newCards = 0;
    let updatedUnits = 0;

    for (const [langKey, langConfig] of Object.entries(LANGUAGES)) {
      const langRem = await getOrCreateRem(
        plugin,
        updatedLangIds[langKey],
        langConfig.display,
        rootRem._id
      );
      if (!langRem) continue;
      await langRem.setIsDocument(true);
      updatedLangIds[langKey] = langRem._id;

      for (const unit of langConfig.units) {
        const cacheKey = `${langKey}/${unit.filename}`;
        const url = `${GITHUB_BASE}/${langKey}/${unit.filename}`;
        const content = await fetchText(url);
        if (content === null) continue;

        const hash = simpleHash(content);
        if (storedHashes[cacheKey] === hash && updatedUnitIds[cacheKey]) {
          continue;
        }

        const cards = content
          .split('\n')
          .map(parseLine)
          .filter((c): c is ParsedCard => c !== null);

        if (cards.length === 0) continue;

        // Remove old unit rem if content changed
        const oldUnitId = updatedUnitIds[cacheKey];
        if (oldUnitId && storedHashes[cacheKey] !== hash) {
          const oldUnit = await plugin.rem.findOne(oldUnitId);
          if (oldUnit) await oldUnit.remove();
          updatedUnits++;
        }

        // Create unit document
        const unitRem = await plugin.rem.createRem();
        if (!unitRem) continue;
        await unitRem.setText(await makeText(unit.display));
        await unitRem.setIsDocument(true);
        await unitRem.setParent(langRem._id);
        updatedUnitIds[cacheKey] = unitRem._id;

        // Create flashcards: front text + back text, tagged by language and unit
        for (const card of cards) {
          const cardRem = await plugin.rem.createRem();
          if (!cardRem) continue;
          await cardRem.setText(await makeText(card.front));
          await cardRem.setBackText(await makeText(card.back));
          await cardRem.setParent(unitRem._id);
          await cardRem.addTag(langRem._id);
          await cardRem.addTag(unitRem._id);
          newCards++;
        }

        updatedHashes[cacheKey] = hash;
      }
    }

    await plugin.storage.setLocal(KEY_HASHES, updatedHashes);
    await plugin.storage.setLocal(KEY_LANG_IDS, updatedLangIds);
    await plugin.storage.setLocal(KEY_UNIT_IDS, updatedUnitIds);
    await plugin.storage.setLocal(KEY_LAST_SYNC, Date.now().toString());

    await plugin.app.toast(
      newCards > 0
        ? `Vocab sync done: ${newCards} cards added.`
        : 'Vocab sync: already up to date.'
    );
  } catch (e: any) {
    await plugin.app.toast('Vocab sync ERROR: ' + (e?.message ?? String(e)));
  }
}

async function ping(msg: string): Promise<void> {
  try { await fetch(`http://localhost:9001/debug?msg=${encodeURIComponent(msg)}`); } catch {}
}

async function onActivate(plugin: ReactRNPlugin): Promise<void> {
  await ping('onActivate_called');

  await plugin.app.registerCommand({
    id: 'sync-language-vocab',
    name: 'Sync Language Vocabulary from GitHub',
    action: async () => syncVocabulary(plugin),
  });

  await plugin.app.registerCommand({
    id: 'reset-vocab-sync',
    name: 'Reset Vocabulary Sync (force full rebuild)',
    action: async () => {
      await plugin.storage.setLocal(KEY_HASHES, {});
      await plugin.storage.setLocal(KEY_LANG_IDS, {});
      await plugin.storage.setLocal(KEY_UNIT_IDS, {});
      await plugin.storage.setLocal(KEY_ROOT_ID, null);
      await plugin.storage.setLocal(KEY_LAST_SYNC, null);
      await plugin.app.toast('Vocab sync reset — run Sync command to rebuild.');
    },
  });

  await ping('registerCommand_done');

  const lastSync = await plugin.storage.getLocal<string>(KEY_LAST_SYNC);
  const elapsed = lastSync ? Date.now() - Number(lastSync) : Infinity;
  if (elapsed > SYNC_INTERVAL_MS) {
    setTimeout(() => syncVocabulary(plugin), 3000);
  }
}

async function onDeactivate(_plugin: ReactRNPlugin): Promise<void> {}

declareIndexPlugin(onActivate, onDeactivate);
