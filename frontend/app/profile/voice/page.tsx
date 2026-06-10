'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from '@/components/sidebar';
import { useRouter } from 'next/navigation';
import styles from '@/styles/voice-profiles.module.css';

interface VoiceSample {
  name: string;
  path: string;
}

interface Character {
  folder: string;
  name: string;
  portrait: string;
  voiceSamples: VoiceSample[];
  description: string;
}

export default function VoiceProfilesPage() {
  const router = useRouter();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [voiceFeatureEnabled, setVoiceFeatureEnabled] = useState(true);
  const [selectedCharacterFolder, setSelectedCharacterFolder] = useState<string | null>(null);
  const [playingSample, setPlayingSample] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const loadCharacters = async () => {
      try {
        const response = await fetch('/api/voice-characters');
        const data = await response.json();
        setCharacters(data.characters || []);
        setSelectedCharacterFolder(data.characters?.[0]?.folder ?? null);
      } catch (error) {
        console.error('Failed to load character data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCharacters();

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const selectedCharacter = characters.find((character) => character.folder === selectedCharacterFolder) ?? characters[0] ?? null;

  const handleVoiceToggle = () => {
    setVoiceFeatureEnabled(!voiceFeatureEnabled);
  };

  const handleCharacterSelect = (folder: string) => {
    setSelectedCharacterFolder(folder);
  };

  const handleVoiceClick = () => {
    // Already on the voice profiles page.
  };

  const handleLogoClick = () => {
    router.push('/');
  };

  const stopPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setPlayingSample(null);
  };

  const handlePlaySample = async (sample: VoiceSample) => {
    if (!voiceFeatureEnabled) {
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const audio = new Audio(sample.path);
    audioRef.current = audio;

    audio.onended = () => {
      setPlayingSample(null);
      audioRef.current = null;
    };

    audio.onerror = (error) => {
      console.error('Failed to play voice sample:', error);
      setPlayingSample(null);
    };

    try {
      await audio.play();
      setPlayingSample(sample.name);
    } catch (error) {
      console.error('Audio playback error:', error);
      setPlayingSample(null);
    }
  };

  return (
    <div className={styles.voiceProfilesContainer}>
      <Sidebar
        isVoiceActive={true}
        onVoiceClick={handleVoiceClick}
        onLogoClick={handleLogoClick}
      />

      <main className={styles.contentArea}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Voice Profiles</h1>
            <p className={styles.subtitle}>Craft a character-driven voice experience for AI Naragi.</p>
          </div>
          <div className={styles.voiceStatusCard}>
            <span className={styles.statusLabel}>Voice Engine</span>
            <span className={styles.statusBadge}>{voiceFeatureEnabled ? 'Active' : 'Disabled'}</span>
          </div>
        </div>

        <section className={styles.toggleSection}>
          <div className={styles.toggleHeader}>
            <span className={styles.toggleLabel}>Voice Feature</span>
            <div className={styles.toggleContainer}>
              <button
                onClick={handleVoiceToggle}
                className={`${styles.toggleSwitch} ${voiceFeatureEnabled ? styles.toggleActive : ''}`}
                aria-label="Toggle voice feature"
              >
                <span className={styles.toggleKnob} />
              </button>
              <span className={styles.toggleStatus}>{voiceFeatureEnabled ? 'ON' : 'OFF'}</span>
            </div>
          </div>
        </section>

        <section className={styles.mainPanel}>
          <div className={styles.characterPanel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.sectionLabel}>Characters</p>
                <h2 className={styles.panelTitle}>Available Voice Profiles</h2>
              </div>
              <span className={styles.countBadge}>{characters.length} characters</span>
            </div>

            <div className={styles.characterGrid}>
              {loading ? (
                <div className={styles.loadingCard}>Loading voice characters...</div>
              ) : (
                characters.map((character) => {
                  const isSelected = character.folder === selectedCharacterFolder;
                  return (
                    <button
                      key={character.folder}
                      className={`${styles.characterCard} ${isSelected ? styles.characterCardActive : ''}`}
                      onClick={() => handleCharacterSelect(character.folder)}
                    >
                      <div className={styles.avatarThumb}>
                        <img src={character.portrait} alt={`${character.name} portrait`} />
                      </div>
                      <div className={styles.characterMeta}>
                        <div className={styles.characterNameSmall}>{character.name}</div>
                        <p className={styles.characterDetails}>{character.description}</p>
                      </div>
                      <span className={styles.voiceCountBadge}>{character.voiceSamples.length} samples</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <aside className={styles.voiceDetailPanel}>
            <div className={styles.detailHeader}>
              <div className={styles.heroPortrait}>
                {selectedCharacter ? (
                  <img src={selectedCharacter.portrait} alt={`${selectedCharacter.name} portrait`} />
                ) : (
                  <div className={styles.emptyPortrait}>No character selected</div>
                )}
                <div className={styles.voiceBadge}>{voiceFeatureEnabled ? 'Voice ON' : 'Voice OFF'}</div>
              </div>

              <div className={styles.characterInfo}>
                <span className={styles.characterLabel}>Selected voice</span>
                <h2 className={styles.characterName}>{selectedCharacter?.name ?? 'No selection'}</h2>
                <p className={styles.characterDescription}>
                  {selectedCharacter?.description ?? 'Choose a character on the left to preview their voice samples.'}
                </p>
              </div>
            </div>

            <div className={styles.detailActions}>
              <button
                className={`${styles.actionButton} ${styles.primaryAction}`}
                onClick={() => selectedCharacter?.voiceSamples[0] && handlePlaySample(selectedCharacter.voiceSamples[0])}
                disabled={!selectedCharacter || !voiceFeatureEnabled || !selectedCharacter?.voiceSamples.length}
              >
                Play first sample
              </button>
              <button
                className={`${styles.actionButton} ${styles.secondaryAction}`}
                onClick={stopPlayback}
                disabled={!playingSample}
              >
                Stop playback
              </button>
            </div>

            <div className={styles.samplePanel}>
              <div className={styles.samplePanelHeader}>
                <h3>Voice Sample Library</h3>
                <span className={styles.sampleHint}>Tap a sample to hear the character.</span>
              </div>

              <div className={styles.sampleList}>
                {selectedCharacter?.voiceSamples.length ? (
                  selectedCharacter.voiceSamples.map((sample) => (
                    <div
                      key={sample.name}
                      className={`${styles.sampleItem} ${playingSample === sample.name ? styles.sampleItemActive : ''}`}
                    >
                      <div>
                        <p className={styles.sampleItemName}>{sample.name}</p>
                        <p className={styles.sampleMeta}>Voice sample file</p>
                      </div>
                      <button
                        className={styles.playSampleButton}
                        type="button"
                        onClick={() => handlePlaySample(sample)}
                      >
                        {playingSample === sample.name ? 'Playing' : 'Play'}
                      </button>
                    </div>
                  ))
                ) : (
                  <div className={styles.emptySampleState}>
                    No voice samples found for this character.
                  </div>
                )}
              </div>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
