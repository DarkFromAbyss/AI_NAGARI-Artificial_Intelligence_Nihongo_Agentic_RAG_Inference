
import { existsSync, readdirSync, readFileSync } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
interface VoiceSample {
  name: string;
  path: string;
}
/** A single voice style variant — one Voicevox speaker_id with its portrait. */
interface VoiceStyle {
  /** Voicevox speaker_id (derived from portrait filename, e.g. "3001.png" → 3001). */
  voiceId: number;
  /** URL path to the per-style portrait image. */
  portraitUrl: string;
  /** Style label from voicevox_unique_ids.csv (e.g. "Normal", "Amama"). */
  styleName: string;
  /** Japanese character name from voicevox_unique_ids.csv. */
  characterName: string;
}
interface CharacterMeta {
  folder: string;
  name: string;
  portrait: string;
  voiceSamples: VoiceSample[];
  description: string;
  /** Per-style variants — each entry maps one Voicevox speaker_id to a portrait. */
  styles: VoiceStyle[];
}
/** Parse voicevox_unique_ids.csv → Map<voice_id, { characterName, styleName }>. */
function loadVoiceIdMap(): Map<number, { characterName: string; styleName: string }> {
  const csvPath = path.join(process.cwd(), '..', 'database', 'voicevox_unique_ids.csv');
  const map = new Map<number, { characterName: string; styleName: string }>();
  try {
    const lines = readFileSync(csvPath, 'utf-8').split(/\r?\n/);
    // Skip header: voice_id,character_ja,character_en,style
    for (const line of lines.slice(1)) {
      const cols = line.trim().split(',');
      if (cols.length < 4) continue;
      const id = parseInt(cols[0], 10);
      if (isNaN(id)) continue;
      map.set(id, { characterName: cols[1], styleName: cols[3] });
    }
  } catch (err) {
    console.error('[voice-characters] failed to read voicevox_unique_ids.csv', err);
  }
  return map;
}
export async function GET() {
  const voiceIdMap = loadVoiceIdMap();
  const root = process.cwd();
  const characterDir = path.join(root, 'public', 'characters');
  let folders: string[] = [];
  try {
    folders = readdirSync(characterDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b, 'ja'));
  } catch (error) {
    console.error('[voice-characters] failed to read characters directory', error);
    return NextResponse.json({ characters: [] });
  }
  const characters: CharacterMeta[] = folders.map((folderName) => {
    const portraitFile = path.join(characterDir, folderName, 'portrait.png');
    const voiceSampleDir = path.join(characterDir, folderName, 'voice_samples');
    const portraitsDir = path.join(characterDir, folderName, 'portraits');
    const portrait = existsSync(portraitFile)
      ? `/characters/${encodeURIComponent(folderName)}/portrait.png`
      : '/placeholder.jpg';
    const voiceSamples = existsSync(voiceSampleDir)
      ? readdirSync(voiceSampleDir)
          .filter((file) => /\.(wav|mp3|ogg|m4a)$/i.test(file))
          .sort()
          .map((file) => ({
            name: file,
            path: `/characters/${encodeURIComponent(folderName)}/voice_samples/${encodeURIComponent(file)}`,
          }))
      : [];
    // Build styles array from portraits/ folder.
    // Each PNG filename (without extension) is a numeric Voicevox speaker_id.
    const styles: VoiceStyle[] = existsSync(portraitsDir)
      ? readdirSync(portraitsDir)
          .filter((file) => /\.png$/i.test(file))
          .map((file) => {
            const baseName = path.basename(file, path.extname(file));
            const voiceId = parseInt(baseName, 10);
            
            if (isNaN(voiceId)) return null;
            const meta = voiceIdMap.get(voiceId);
            return {
              voiceId,
              portraitUrl: `/characters/${encodeURIComponent(folderName)}/portraits/${encodeURIComponent(file)}`,
              styleName: meta?.styleName ?? String(voiceId),
              characterName: meta?.characterName ?? folderName,
            };
          })
          .filter((s): s is VoiceStyle => s !== null)
          .sort((a, b) => a.voiceId - b.voiceId)
      : [];
    return {
      folder: folderName,
      name: folderName,
      portrait,
      voiceSamples,
      description: `${voiceSamples.length} sample${voiceSamples.length === 1 ? '' : 's'} available`,
      styles,
    };
  });
  return NextResponse.json({ characters });
}