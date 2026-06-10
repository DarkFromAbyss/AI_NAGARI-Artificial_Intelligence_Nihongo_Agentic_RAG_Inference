import { existsSync, readdirSync } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

interface VoiceSample {
  name: string;
  path: string;
}

interface CharacterMeta {
  folder: string;
  name: string;
  portrait: string;
  voiceSamples: VoiceSample[];
  description: string;
}

export async function GET() {
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

    return {
      folder: folderName,
      name: folderName,
      portrait,
      voiceSamples,
      description: `${voiceSamples.length} sample${voiceSamples.length === 1 ? '' : 's'} available`,
    };
  });

  return NextResponse.json({ characters });
}
