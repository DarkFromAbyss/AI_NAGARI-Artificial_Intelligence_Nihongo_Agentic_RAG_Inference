/**
 * Global Audio Manager Hook
 *
 * Centralized audio playback management for preventing overlapping audio
 * when switching between different interface states (Model ON/OFF).
 *
 * Key Features:
 * - Single registry of all active audio players
 * - Stop all audio on demand
 * - Automatic cleanup on component unmount
 * - Thread-safe tracking of audio instances
 */

"use client";

import { useCallback, useEffect, useRef } from "react";

type AudioPlayerController = {
  id: string;
  stop: () => void;
};

/**
 * Global audio registry - persists across component re-renders
 * Maps audio player IDs to their stop functions
 */
const audioRegistry = new Map<string, () => void>();

let registryCounter = 0;

interface UseAudioManagerReturn {
  registerAudioPlayer: (stopFunction: () => void) => string;
  unregisterAudioPlayer: (id: string) => void;
  stopAllAudio: () => void;
}

/**
 * Hook for managing a single audio player instance with global registry.
 * Automatically cleans up when component unmounts.
 *
 * @returns Object with audio registration/cleanup functions
 *
 * @example
 * const { registerAudioPlayer } = useAudioManager();
 *
 * useEffect(() => {
 *   const playerId = registerAudioPlayer(() => {
 *     // Custom stop logic here
 *     stop();
 *   });
 *
 *   return () => unregisterAudioPlayer(playerId);
 * }, []);
 */
export function useAudioManager(): UseAudioManagerReturn {
  const playerIdRef = useRef<string | null>(null);

  const registerAudioPlayer = useCallback((stopFunction: () => void): string => {
    // Generate unique ID for this audio player
    const playerId = `audio-player-${Date.now()}-${registryCounter++}`;

    // Register stop function in global registry
    audioRegistry.set(playerId, stopFunction);

    return playerId;
  }, []);

  const unregisterAudioPlayer = useCallback((id: string) => {
    audioRegistry.delete(id);
  }, []);

  const stopAllAudio = useCallback(() => {
    // Iterate through all registered audio players and call their stop functions
    audioRegistry.forEach((stopFunction) => {
      try {
        stopFunction();
      } catch (error) {
        console.error("Error stopping audio:", error);
      }
    });

    // Clear the entire registry
    audioRegistry.clear();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (playerIdRef.current) {
        unregisterAudioPlayer(playerIdRef.current);
      }
    };
  }, [unregisterAudioPlayer]);

  return {
    registerAudioPlayer,
    unregisterAudioPlayer,
    stopAllAudio,
  };
}

/**
 * Stop all active audio playback globally.
 * Called when switching between interface states.
 *
 * @example
 * import { stopAllActiveAudio } from "@/hooks/use-audio-manager";
 *
 * // In AppLayout when toggling model state:
 * const handleModelToggle = (newState: boolean) => {
 *   stopAllActiveAudio();
 *   setIsModelActive(newState);
 * };
 */
export function stopAllActiveAudio() {
  audioRegistry.forEach((stopFunction) => {
    try {
      stopFunction();
    } catch (error) {
      console.error("Error stopping audio:", error);
    }
  });

  audioRegistry.clear();
}

/**
 * Get count of currently active audio players.
 * Useful for debugging and monitoring audio state.
 *
 * @returns Number of active audio player instances
 */
export function getActiveAudioCount(): number {
  return audioRegistry.size;
}

/**
 * Safely clear all audio without triggering stop functions.
 * Used as fallback cleanup mechanism.
 */
export function clearAudioRegistry() {
  audioRegistry.clear();
}
