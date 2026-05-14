/**
 * TTS (Text-to-Speech) Service
 *
 * Handles communication with backend TTS API and manages audio playback.
 * Provides a clean abstraction for text-to-speech synthesis.
 */

interface TTSResponse {
  audio: Blob;
  durationMs: number;
  synthesisTimeMs: number;
}

export class TTSService {
  private apiUrl: string;
  private sessionId: string;

  constructor(apiUrl: string = "http://localhost:8000", sessionId?: string) {
    this.apiUrl = apiUrl;
    this.sessionId = sessionId || `session_${Date.now()}`;
  }

  /**
   * Synthesize Japanese text to speech via backend API.
   *
   * @param text - Japanese text to synthesize
   * @param speakerId - Voicevox speaker ID (default: 1 for female voice)   * @returns Promise resolving to TTSResponse with audio blob
   */
  async synthesize(text: string, speakerId: number = 1): Promise<TTSResponse> {
    if (!text || text.trim().length === 0) {
      throw new Error("Text input cannot be empty");
    }

    if (text.length > 5000) {
      throw new Error("Text exceeds maximum length of 5000 characters");
    }

    try {
      const response = await fetch(`${this.apiUrl}/api/tts/synthesize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: text.trim(),
          speaker_id: speakerId,
          session_id: this.sessionId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.detail || `TTS synthesis failed: ${response.status}`
        );
      }

      const audio = await response.blob();
      const durationMs = parseFloat(
        response.headers.get("X-Audio-Duration") || "0"
      );
      const synthesisTimeMs = parseFloat(
        response.headers.get("X-Synthesis-Time") || "0"
      );

      return {
        audio,
        durationMs,
        synthesisTimeMs,
      };
    } catch (error) {
      throw new Error(
        `TTS synthesis error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Check if TTS service is available.
   *
   * @returns Promise resolving to boolean
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiUrl}/api/tts/health`, {
        method: "GET",
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Update session ID for tracking.
   *
   * @param newSessionId - New session ID
   */
  setSessionId(newSessionId: string): void {
    this.sessionId = newSessionId;
  }
}
