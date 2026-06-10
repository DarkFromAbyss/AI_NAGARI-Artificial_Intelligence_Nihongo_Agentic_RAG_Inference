'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sidebar } from '@/components/sidebar';
import { useRouter } from 'next/navigation';
import styles from '@/styles/voice-profiles.module.css';

interface VoiceSample {
  name: string;
  path: string;
}

interface VoiceStyle {
  voiceId: number;
  portraitUrl: string;
  styleName: string;
  characterName: string;
}

interface Character {
  folder: string;
  name: string;
  portrait: string;
  voiceSamples: VoiceSample[];
  description: string;
  styles: VoiceStyle[];
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000';

export default function VoiceProfilesPage() {
  const router = useRouter();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [voiceFeatureEnabled, setVoiceFeatureEnabled] = useState(true);
  const [selectedCharacterFolder, setSelectedCharacterFolder] = useState<string | null>(null);
  const [playingSample, setPlayingSample] = useState<string | null>(null);

  /** The voice_id the user has actively selected (persisted to backend). */
  const [selectedVoiceId, setSelectedVoiceId] = useState<number | null>(null);
  /** Which voice_id button is currently mid-save (shows a spinner). */
  const [savingVoiceId, setSavingVoiceId] = useState<number | null>(null);

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

  const selectedCharacter =
    characters.find((c) => c.folder === selectedCharacterFolder) ?? characters[0] ?? null;

  const handleVoiceToggle = () => setVoiceFeatureEnabled((v) => !v);

  const handleCharacterSelect = (folder: string) => setSelectedCharacterFolder(folder);

  const handleVoiceClick = () => { /* already on the voice profiles page */ };

  const handleLogoClick = () => router.push('/');

  const stopPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setPlayingSample(null);
  };

  const handlePlaySample = async (sample: VoiceSample) => {
    if (!voiceFeatureEnabled) return;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    const audio = new Audio(sample.path);
    audioRef.current = audio;
    audio.onended = () => { setPlayingSample(null); audioRef.current = null; };
    audio.onerror = () => { setPlayingSample(null); };
    try {
      await audio.play();
      setPlayingSample(sample.name);
    } catch {
      setPlayingSample(null);
    }
  };

  /**
   * Sends the user's style choice to the backend.
   * Uses an optimistic UI update — the button highlights immediately,
   * and if the request fails the selection is rolled back.
   */
  const handleStyleSelect = useCallback(async (voiceId: number) => {
    const previous = selectedVoiceId;
    setSelectedVoiceId(voiceId);
    setSavingVoiceId(voiceId);
    try {
      const token =
        localStorage.getItem('session_token') ??
        sessionStorage.getItem('session_token') ?? '';
      const res = await fetch(`${BACKEND_URL}/api/tts/voice-preference`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ voice_id: voiceId }),
      });
      if (!res.ok) {
        console.error('[voice-preference] request failed:', res.status, await res.text());
        // Roll back optimistic update on failure
        setSelectedVoiceId(previous);
      }
    } catch (err) {
      console.error('[voice-preference] network error:', err);
      setSelectedVoiceId(previous);
    } finally {
      setSavingVoiceId(null);
    }
  }, [selectedVoiceId]);


  return (
    <div className={styles.voiceProfilesContainer}>
      <Sidebar
        isVoiceActive={true}
        onVoiceClick={handleVoiceClick}
        onLogoClick={handleLogoClick}
      />

      <main className={styles.contentArea}>
        {/* ── Header ── */}
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

        {/* ── Voice toggle ── */}
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

        {/* ── Main two-column panel ── */}
        <section className={styles.mainPanel}>

          {/* Left: character list */}
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
                <div className={styles.loadingCard}>Loading voice characters…</div>
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

          {/* Right: voice detail panel */}
          <aside className={styles.voiceDetailPanel}>
            <div className={styles.detailHeader}>
              {/* Hero portrait */}
              <div className={styles.heroPortrait}>
                {selectedCharacter ? (
                  <img src={selectedCharacter.portrait} alt={`${selectedCharacter.name} portrait`} />
                ) : (
                  <div className={styles.emptyPortrait}>No character selected</div>
                )}
                <div className={styles.voiceBadge}>{voiceFeatureEnabled ? 'Voice ON' : 'Voice OFF'}</div>
              </div>

              {/* Character info */}
              <div className={styles.characterInfo}>
                <span className={styles.characterLabel}>Selected voice</span>
                <h2 className={styles.characterName}>{selectedCharacter?.name ?? 'No selection'}</h2>
                <p className={styles.characterDescription}>
                  {selectedCharacter?.description ?? 'Choose a character on the left to preview their voice samples.'}
                </p>
              </div>
            </div>
            
              {/* ── Style selector buttons ── */}
            {selectedCharacter && selectedCharacter.styles.length > 0 && (
              <div className={styles.stylesSection}>
                <div className={styles.stylesSectionHeader}>
                  <span className={styles.stylesSectionTitle}>Voice Styles</span>
                  <span className={styles.stylesSectionHint}>
                    {selectedVoiceId != null
                      ? `ID ${selectedVoiceId} selected`
                      : 'Pick a style to activate it'}
                  </span>
                </div>
                <div className={styles.stylesGrid}>
                  {selectedCharacter.styles.map((style) => {
                    const isActive = style.voiceId === selectedVoiceId;
                    const isSaving = style.voiceId === savingVoiceId;
                    return (
                      <button
                        key={style.voiceId}
                        id={`style-btn-${style.voiceId}`}
                        className={[
                          styles.styleButton,
                          isActive ? styles.styleButtonActive : '',
                          isSaving ? styles.styleButtonSaving : '',
                        ].join(' ')}
                        onClick={() => handleStyleSelect(style.voiceId)}
                        disabled={isSaving}
                        aria-label={`Select style ${style.styleName} (ID ${style.voiceId})`}
                        aria-pressed={isActive}
                        title={`${style.characterName} — ${style.styleName} (ID: ${style.voiceId})`}
                      >
                        <div className={styles.styleThumb}>
                          <img
                            src={style.portraitUrl}
                            alt={`${style.characterName} ${style.styleName}`}
                            loading="lazy"
                          />
                          {isSaving && <div className={styles.styleSavingOverlay}><span className={styles.spinnerRing} /></div>}
                        </div>
                        <span className={styles.styleLabel}>
                          {isActive ? '✓ ' : ''}{style.styleName}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}


            {/* ── Playback controls ── */}
            <div className={styles.detailActions}>
              <button
                className={`${styles.actionButton} ${styles.primaryAction}`}
                onClick={() =>
                  selectedCharacter?.voiceSamples[0] && handlePlaySample(selectedCharacter.voiceSamples[0])
                }
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

            {/* ── Sample library ── */}
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
