/**
 * Web Audio API Hook for Low-Latency Audio Playback
 *
 * Provides React hook for playing audio with controls using Web Audio API.
 * Ensures smooth, real-time playback with buffer management.
 * Automatically registers with global audio manager to prevent overlapping audio
 * when switching between interface states.
 */

"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useAudioManager } from "@/hooks/use-audio-manager";

export type AudioPlaybackState = "idle" | "loading" | "playing" | "paused" | "error";

interface UseAudioPlayerReturn {
  state: AudioPlaybackState;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  error: string | null;
  play: (audioBlob: Blob) => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  setVolume: (volume: number) => void;
  volume: number;
}

/**
 * React hook for Web Audio API playback with state management.
 * Automatically registers with global audio manager to prevent overlapping audio.
 *
 * @returns Object with playback control methods and state
 */
export function useAudioPlayer(): UseAudioPlayerReturn {
  const [state, setState] = useState<AudioPlaybackState>("idle");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1.0);
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const startTimeRef = useRef(0);
  const pausedTimeRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);

  // Register with global audio manager to prevent overlapping audio
  const { registerAudioPlayer, unregisterAudioPlayer } = useAudioManager();
  const playerIdRef = useRef<string | null>(null);

  // Initialize Web Audio API context
  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();

      // Create gain node for volume control
      const gainNode = audioContext.createGain();
      gainNode.gain.value = volume;
      gainNode.connect(audioContext.destination);

      audioContextRef.current = audioContext;
      gainNodeRef.current = gainNode;
    }
    return audioContextRef.current;
  }, [volume]);

  // Update time tracking during playback
  const updateTime = useCallback(() => {
    if (state === "playing" && audioContextRef.current) {
      const elapsed =
        (audioContextRef.current.currentTime - startTimeRef.current) * 1000;
      setCurrentTime(Math.min(elapsed, duration));

      if (elapsed < duration) {
        animationFrameRef.current = requestAnimationFrame(updateTime);
      } else {
        setState("idle");
        setCurrentTime(0);
      }
    }
  }, [state, duration]);

  // Cleanup animation frame on unmount and unregister from audio manager
  useEffect(() => {
    // Register stop function with global audio manager
    if (!playerIdRef.current) {
      playerIdRef.current = registerAudioPlayer(() => {
        // Stop function that will be called when interface state changes
        if (sourceRef.current) {
          try {
            sourceRef.current.stop();
            sourceRef.current.disconnect();
          } catch {
            // Already stopped
          }
          sourceRef.current = null;
        }

        setState("idle");
        setCurrentTime(0);
        pausedTimeRef.current = 0;

        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      });
    }

    return () => {
      // Cleanup on unmount
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      // Unregister from audio manager
      if (playerIdRef.current) {
        unregisterAudioPlayer(playerIdRef.current);
        playerIdRef.current = null;
      }
    };
  }, [registerAudioPlayer, unregisterAudioPlayer]);

  const play = useCallback(
    async (audioBlob: Blob) => {
      try {
        setState("loading");
        setError(null);

        const audioContext = initAudioContext();

        // Decode audio data
        const arrayBuffer = await audioBlob.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        setDuration(audioBuffer.duration * 1000);

        // Stop any existing playback
        if (sourceRef.current) {
          sourceRef.current.stop();
          sourceRef.current.disconnect();
        }

        // Create and configure source node
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(gainNodeRef.current!);

        // Set up playback end handler
        source.onended = () => {
          setState("idle");
          setCurrentTime(0);
          pausedTimeRef.current = 0;
        };

        // Start playback
        startTimeRef.current = audioContext.currentTime;
        pausedTimeRef.current = 0;
        source.start(0);
        sourceRef.current = source;

        setState("playing");
        animationFrameRef.current = requestAnimationFrame(updateTime);
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Unknown audio error";
        setError(errorMsg);
        setState("error");
      }
    },
    [initAudioContext, updateTime]
  );

  const pause = useCallback(() => {
    if (state === "playing" && sourceRef.current && audioContextRef.current) {
      sourceRef.current.stop();
      pausedTimeRef.current = currentTime;
      setState("paused");

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }
  }, [state, currentTime]);

  const resume = useCallback(async () => {
    if (state === "paused") {
      try {
        setState("loading");
        const audioContext = audioContextRef.current;

        if (!sourceRef.current || !audioContext) {
          throw new Error("Audio context not initialized");
        }

        // Re-create source for resuming
        const source = audioContext.createBufferSource();
        source.buffer = sourceRef.current.buffer;
        source.connect(gainNodeRef.current!);

        source.onended = () => {
          setState("idle");
          setCurrentTime(0);
          pausedTimeRef.current = 0;
        };

        const offset = pausedTimeRef.current / 1000;
        startTimeRef.current = audioContext.currentTime - offset;
        source.start(0, offset);
        sourceRef.current = source;

        setState("playing");
        animationFrameRef.current = requestAnimationFrame(updateTime);
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Resume playback failed";
        setError(errorMsg);
        setState("error");
      }
    }
  }, [state, updateTime]);

  const stop = useCallback(() => {
    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
        sourceRef.current.disconnect();
      } catch {
        // Already stopped
      }
      sourceRef.current = null;
    }

    setState("idle");
    setCurrentTime(0);
    pausedTimeRef.current = 0;

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  }, []);

  const setVolume = useCallback((newVolume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    setVolumeState(clampedVolume);

    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = clampedVolume;
    }
  }, []);

  return {
    state,
    isPlaying: state === "playing",
    currentTime,
    duration,
    error,
    play,
    pause,
    resume,
    stop,
    setVolume,
    volume,
  };
}
