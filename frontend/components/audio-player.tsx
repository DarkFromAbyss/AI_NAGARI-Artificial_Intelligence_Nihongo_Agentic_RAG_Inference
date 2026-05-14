/**
 * Audio Player Component
 *
 * Reusable audio playback UI component with controls using Web Audio API.
 * Supports play, pause, stop, and volume control with visual feedback.
 */

"use client";

import React, { useState, useEffect } from "react";
import { useAudioPlayer } from "@/hooks/use-audio-player";
import {
  Play,
  Pause,
  StopCircle,
  Volume2,
  AlertCircle,
  Loader,
} from "lucide-react";

interface AudioPlayerProps {
  audioBlob?: Blob;
  isLoading?: boolean;
  onPlay?: () => void;
  onStop?: () => void;
  showTime?: boolean;
  size?: "sm" | "md" | "lg";
}

/**
 * Reusable audio player component with Web Audio API integration.
 */
export function AudioPlayer({
  audioBlob,
  isLoading = false,
  onPlay,
  onStop,
  showTime = true,
  size = "md",
}: AudioPlayerProps) {
  const {
    state,
    isPlaying,
    currentTime,
    duration,
    error,
    play,
    pause,
    resume,
    stop,
    setVolume,
    volume,
  } = useAudioPlayer();

  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (error) {
      setHasError(true);
      const timeout = setTimeout(() => setHasError(false), 3000);
      return () => clearTimeout(timeout);
    }
  }, [error]);

  const handlePlay = async () => {
    if (audioBlob) {
      try {
        await play(audioBlob);
        onPlay?.();
      } catch (err) {
        setHasError(true);
      }
    }
  };

  const handleStop = () => {
    stop();
    onStop?.();
  };

  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const buttonClasses = {
    sm: "w-8 h-8 p-1.5",
    md: "w-10 h-10 p-2",
    lg: "w-12 h-12 p-2.5",
  };

  const iconSize = {
    sm: 16,
    md: 20,
    lg: 24,
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Main Control Row */}
      <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-800 rounded-lg p-3">
        {/* Play/Pause Button */}
        <button
          onClick={() => {
            if (state === "idle" || state === "paused") {
              if (state === "paused") resume();
              else handlePlay();
            } else if (isPlaying) {
              pause();
            }
          }}
          disabled={!audioBlob || isLoading || state === "error"}
          className={`${buttonClasses[size]} flex items-center justify-center rounded-full
            bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed
            text-white transition-colors duration-200`}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {state === "loading" ? (
            <Loader size={iconSize[size]} className="animate-spin" />
          ) : isPlaying ? (
            <Pause size={iconSize[size]} fill="currentColor" />
          ) : (
            <Play size={iconSize[size]} fill="currentColor" />
          )}
        </button>

        {/* Stop Button */}
        <button
          onClick={handleStop}
          disabled={state === "idle" || !audioBlob}
          className={`${buttonClasses[size]} flex items-center justify-center rounded-full
            bg-red-500 hover:bg-red-600 disabled:bg-gray-400 disabled:cursor-not-allowed
            text-white transition-colors duration-200`}
          aria-label="Stop"
        >
          <StopCircle size={iconSize[size]} fill="currentColor" />
        </button>

        {/* Time Display */}
        {showTime && (
          <div className="text-xs font-mono text-slate-600 dark:text-slate-400 min-w-24">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        )}

        {/* Volume Control */}
        <div className="flex items-center gap-2 ml-auto">
          <Volume2 size={16} className="text-slate-600 dark:text-slate-400" />
          <input
            type="range"
            min="0"
            max="100"
            value={volume * 100}
            onChange={(e) => setVolume(Number(e.target.value) / 100)}
            className="w-20 h-2 bg-slate-300 dark:bg-slate-600 rounded-lg cursor-pointer"
            aria-label="Volume control"
          />
        </div>
      </div>

      {/* Progress Bar */}
      {duration > 0 && (
        <div
          className="h-1 bg-slate-300 dark:bg-slate-600 rounded-full overflow-hidden cursor-pointer"
          onClick={(e) => {
            if (!audioBlob) return;
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            // Note: Seeking in the middle of playback requires special handling
            // This is a simplified version - full seek implementation would be more complex
          }}
        >
          <div
            className="h-full bg-blue-500 transition-all duration-100"
            style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
          />
        </div>
      )}

      {/* Error Message */}
      {hasError && error && (
        <div className="flex items-center gap-2 p-2 bg-red-100 dark:bg-red-900 rounded text-red-700 dark:text-red-200 text-sm">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
