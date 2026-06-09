'use client';

import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/components/sidebar';
import { useRouter } from 'next/navigation';
import styles from '@/styles/voice-profiles.module.css';

interface Character {
  id: number;
  name: string;
  uuid: string;
  iconPath: string;
  sampleVoicePath: string;
  description: string;
}

export default function VoiceProfilesPage() {
  const router = useRouter();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Load character data from JSON
  useEffect(() => {
    const loadCharacters = async () => {
      try {
        const response = await fetch('/data/voice-characters.json');
        const data = await response.json();
        setCharacters(data.characters);
        setLoading(false);
      } catch (error) {
        console.error('Failed to load character data:', error);
        setLoading(false);
      }
    };
    
    loadCharacters();
  }, []);

  // State Management
  const [voiceFeatureEnabled, setVoiceFeatureEnabled] = useState(true);
  const [selectedCharacterId, setSelectedCharacterId] = useState<number | null>(110);

  const handleVoiceToggle = () => {
    setVoiceFeatureEnabled(!voiceFeatureEnabled);
  };

  const handleCharacterSelect = (characterId: number) => {
    setSelectedCharacterId(characterId);
  };

  const handleVoiceClick = () => {
    // Already on the voice profiles page, so do nothing or refresh
    // This is mainly for when navigating from other pages
  };

  const handleLogoClick = () => {
    router.push('/');
  };

  return (
    <div className={styles.voiceProfilesContainer}>
      {/* Left Sidebar */}
      <Sidebar 
        isVoiceActive={true}
        onVoiceClick={handleVoiceClick}
        onLogoClick={handleLogoClick}
      />

      {/* Right Content Area */}
      <main className={styles.contentArea}>
        {/* Header */}
        <div className={styles.header}>
          <h1 className={styles.title}>Voice Profiles</h1>
          <p className={styles.subtitle}>Manage your voice settings and select a character voice</p>
        </div>

        {/* Voice Feature Toggle */}
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
              <span className={styles.toggleStatus}>
                {voiceFeatureEnabled ? 'ON' : 'OFF'}
              </span>
            </div>
          </div>
        </section>

        {/* Character Selection Table */}
        <section className={styles.characterSection}>
          <h2 className={styles.sectionTitle}>Select a Character Voice</h2>
          
          {voiceFeatureEnabled ? (
            <div className={styles.tableContainer}>
              <table className={styles.characterTable}>
                <thead>
                  <tr>
                    <th>Icon</th>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Description</th>
                    <th>Sample</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className={styles.loadingCell}>
                        Loading character data...
                      </td>
                    </tr>
                  ) : characters.length > 0 ? (
                    characters.map((character) => (
                      <tr
                        key={character.id}
                        className={`${styles.tableRow} ${
                          selectedCharacterId === character.id ? styles.rowActive : ''
                        }`}
                        onClick={() => handleCharacterSelect(character.id)}
                      >
                        <td className={styles.tableCell}>
                          <div className={styles.iconContainer}>
                            <img
                              src={character.iconPath}
                              alt={character.name}
                              className={styles.characterIcon}
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          </div>
                        </td>
                        <td className={styles.tableCell}>{character.id}</td>
                        <td className={styles.tableCell}>
                          <strong>{character.name}</strong>
                        </td>
                        <td className={styles.tableCell}>
                          <span className={styles.description}>{character.description}</span>
                        </td>
                        <td className={styles.tableCell}>
                          <button
                            className={styles.playButton}
                            onClick={(e) => {
                              e.stopPropagation();
                              // Use backend API to stream voice sample
                              const sampleUrl = `/api/tts/voice-sample/${character.uuid}/${character.id}/1`;
                              const audio = new Audio();
                              
                              // Set up event listeners before setting src
                              audio.oncanplay = () => {
                                console.log(`Playing voice sample for ${character.name} (ID: ${character.id})`);
                              };
                              
                              audio.onplaying = () => {
                                console.log(`Now playing: ${character.name}`);
                              };
                              
                              audio.onerror = (error) => {
                                const errorMsg = audio.error ? audio.error.message : String(error);
                                console.error(`Failed to play voice sample for ${character.name}:`, errorMsg);
                                console.error('URL attempted:', sampleUrl);
                                console.error('Audio error code:', audio.error?.code);
                                alert(`Failed to play voice sample: ${errorMsg}`);
                              };
                              
                              audio.onended = () => {
                                console.log(`Finished playing: ${character.name}`);
                              };
                              
                              // Set the source and attempt to play
                              audio.src = sampleUrl;
                              audio.type = "audio/wav";
                              
                              audio.play().catch((error) => {
                                console.error(`Error playing audio for ${character.name}:`, error.message);
                                alert(`Error playing audio: ${error.message}`);
                              });
                            }}
                            title="Play voice sample"
                          >
                            ▶ Play
                          </button>
                        </td>
                        <td className={styles.tableCell}>
                          <button
                            className={`${styles.selectButton} ${
                              selectedCharacterId === character.id ? styles.selectButtonActive : ''
                            }`}
                            onClick={() => handleCharacterSelect(character.id)}
                          >
                            {selectedCharacterId === character.id ? 'Selected' : 'Select'}
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className={styles.loadingCell}>
                        No characters available
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.disabledMessage}>
              <p>Voice feature is currently disabled. Enable it above to select a character.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
