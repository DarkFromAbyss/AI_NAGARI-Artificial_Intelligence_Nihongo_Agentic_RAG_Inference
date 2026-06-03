'use client';

import React, { useState } from 'react';
import { Sidebar } from '@/components/sidebar';
import { useRouter } from 'next/navigation';
import styles from '@/styles/voice-profiles.module.css';

interface Character {
  id: number;
  name: string;
}

export default function VoiceProfilesPage() {
  const router = useRouter();
  
  // Mock character data (from Voicevox voice IDs)
  const characters: Character[] = [
    { id: 110, name: 'Aqua' },
    { id: 111, name: 'Aura' },
    { id: 3055, name: 'Akari' },
    { id: 3056, name: 'Ayaka' },
    { id: 3057, name: 'Anzu' },
    { id: 55, name: 'Amane' },
    { id: 56, name: 'Arisa' },
    { id: 57, name: 'Asuna' },
  ];

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
                    <th>ID</th>
                    <th>Name</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {characters.map((character) => (
                    <tr
                      key={character.id}
                      className={`${styles.tableRow} ${
                        selectedCharacterId === character.id ? styles.rowActive : ''
                      }`}
                      onClick={() => handleCharacterSelect(character.id)}
                    >
                      <td className={styles.tableCell}>{character.id}</td>
                      <td className={styles.tableCell}>{character.name}</td>
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
                  ))}
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
