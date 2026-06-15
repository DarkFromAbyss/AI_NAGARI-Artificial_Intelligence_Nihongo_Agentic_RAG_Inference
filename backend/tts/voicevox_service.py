"""Voicevox engine integration for real-time Japanese TTS synthesis with auto-play.

Manages subprocess lifecycle, synthesizes audio, and plays it directly in-memory
using sounddevice for zero-latency playback without temporary files.
"""

import subprocess
import requests
import io
import os
import time
import json
import struct
import threading
import stat
from typing import Optional, Tuple, Callable
from pathlib import Path
from dataclasses import dataclass
from core.logger import get_logger

try:
    import sounddevice as sd
    import numpy as np
    SOUNDDEVICE_AVAILABLE = True
except ImportError:
    SOUNDDEVICE_AVAILABLE = False

logger = get_logger(__name__)

# Configuration defaults (used if config_loader not provided)
DEFAULT_VOICEVOX_HOST = "127.0.0.1"
DEFAULT_VOICEVOX_PORT = 50021
DEFAULT_VOICEVOX_TIMEOUT = 10
DEFAULT_VOICEVOX_SPEAKER_ID = 1
DEFAULT_ENGINE_STARTUP_MAX_RETRIES = 30
DEFAULT_ENGINE_INITIAL_WAIT = 2.0


def ensure_executable_permissions(exe_path: Path) -> bool:
    """Ensure the executable has proper permissions on Windows.
    
    Args:
        exe_path: Path to the executable file
    
    Returns:
        True if executable is accessible, False otherwise
    """
    try:
        if not exe_path.exists():
            logger.error("Executable not found: %s", exe_path)
            return False
        
        # Check read/execute permissions
        if not os.access(exe_path, os.X_OK):
            logger.warning("Execute permission missing for %s. Attempting to fix...", exe_path)
            try:
                # Add execute permission for owner
                current_perms = exe_path.stat().st_mode
                exe_path.chmod(current_perms | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
                logger.info("Execute permissions granted to %s", exe_path)
                return True
            except PermissionError as e:
                logger.error("Failed to modify permissions: %s", str(e))
                return False
        
        return True
    
    except Exception as e:
        logger.error("Permission check failed for %s: %s", exe_path, str(e))
        return False


@dataclass
class TTSAudioOutput:
    """Structured audio output from TTS synthesis."""
    
    audio_data: bytes
    audio_format: str  # "wav" or "mp3"
    duration_ms: float
    text_length: int
    synthesis_time_ms: float
    speaker_id: int
    sample_rate: int = 44100  # Default WAV sample rate
    channels: int = 1  # Mono


class VoicevoxTTSService:
    """Manages Voicevox engine lifecycle, TTS synthesis, and real-time audio playback.
    
    Features:
    - Automatic engine subprocess management
    - Polling-based readiness checking
    - In-memory audio synthesis
    - Real-time auto-play without temporary files
    - Thread-safe audio playback
    """
    
    def __init__(self, auto_play: bool = True, config_loader=None):
        """Initialize TTS service.
        
        Args:
            auto_play: Enable automatic playback after synthesis (requires sounddevice)
            config_loader: Optional ConfigLoader instance for configuration (uses defaults if None)
        """
        self.engine_process: Optional[subprocess.Popen] = None
        self.is_ready = False
        self.engine_start_time: Optional[float] = None
        self.logger = logger
        self.auto_play = auto_play and SOUNDDEVICE_AVAILABLE
        self._playback_thread: Optional[threading.Thread] = None
        
        # Load TTS configuration from ConfigLoader or use defaults
        if config_loader:
            try:
                self.voicevox_host = config_loader.get_parameter("tts.voicevox_host")
                self.voicevox_port = config_loader.get_parameter("tts.voicevox_port")
                self.voicevox_timeout = config_loader.get_parameter("tts.voicevox_timeout")
                self.voicevox_speaker_id = config_loader.get_parameter("tts.voicevox_speaker_id")
                self.engine_startup_max_retries = config_loader.get_parameter("tts.engine_startup_max_retries")
                self.engine_initial_wait = config_loader.get_parameter("tts.engine_initial_wait")
                
                # Resolve voicevox engine path from config
                engine_path_rel = config_loader.get_parameter("tts.voicevox_engine_path")
                self.voicevox_engine_path = config_loader.project_root / engine_path_rel
                
                self.logger.info("Voicevox TTS configuration loaded from config file")
            except KeyError as config_error:
                self.logger.warning(
                    "Failed to load TTS config from ConfigLoader, using defaults: %s",
                    config_error
                )
                self._set_defaults()
        else:
            self._set_defaults()
        
        if auto_play and not SOUNDDEVICE_AVAILABLE:
            self.logger.warning(
                "sounddevice not installed. Install with: pip install sounddevice numpy"
            )
            self.auto_play = False
    
    def _set_defaults(self) -> None:
        """Set TTS configuration to defaults (from environment or hardcoded)."""
        self.voicevox_host = os.getenv("VOICEVOX_HOST", DEFAULT_VOICEVOX_HOST)
        self.voicevox_port = int(os.getenv("VOICEVOX_PORT", str(DEFAULT_VOICEVOX_PORT)))
        self.voicevox_timeout = DEFAULT_VOICEVOX_TIMEOUT
        self.voicevox_speaker_id = DEFAULT_VOICEVOX_SPEAKER_ID
        self.engine_startup_max_retries = DEFAULT_ENGINE_STARTUP_MAX_RETRIES
        self.engine_initial_wait = DEFAULT_ENGINE_INITIAL_WAIT
        
        # Try to construct voicevox path from common location
        self.voicevox_engine_path = Path(
            r"C:\Users\PC\Desktop\AI_NAGARI-Artificial_Intelligence_Nihongo_Agentic_RAG_Inference\voicevox\windows-directml\run.exe"
        )
        self.logger.debug("Using default Voicevox TTS configuration")
    
    def start_engine(self, timeout: int = 60) -> bool:
        """Start the Voicevox engine subprocess with polling readiness check.
        
        Args:
            timeout: Maximum seconds to wait for engine startup
        
        Returns:
            True if engine started successfully
        """
        if self.is_ready:
            self.logger.debug("Voicevox engine already running")
            return True
        
        if not self.voicevox_engine_path.exists():
            self.logger.error(
                "Voicevox executable not found at %s", 
                self.voicevox_engine_path
            )
            return False
        
        # Step 1: Verify executable permissions
        if not ensure_executable_permissions(self.voicevox_engine_path):
            self.logger.error(
                "Cannot execute Voicevox binary at %s - permission denied",
                self.voicevox_engine_path
            )
            return False
        
        try:
            self.logger.info(
                "Starting Voicevox engine from %s", 
                self.voicevox_engine_path
            )
            # engine_dir = self.voicevox_engine_path.parent
            
            os.chmod(str(self.voicevox_engine_path), 0o755)
            
            self.engine_process = subprocess.Popen(
                [str(self.voicevox_engine_path)],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                # cwd=str(engine_dir),
                # creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
            )
            
            # Step 2: Verify process started successfully
            time.sleep(0.5)
            if self.engine_process.poll() is not None:
                # Process terminated immediately
                stdout, stderr = self.engine_process.communicate()
                error_msg = stderr.decode('utf-8', errors='ignore') if stderr else "No error output"
                self.logger.error(
                    "Voicevox engine process exited immediately. Error: %s",
                    error_msg
                )
                self.engine_process = None
                return False
            
            self.engine_start_time = time.time()
            
            # Step 3: Wait for engine to initialize (account for Windows startup overhead)
            self.logger.info(
                "Engine process started (PID: %d). Waiting %.1f seconds for initialization...",
                self.engine_process.pid,
                self.engine_initial_wait
            )
            time.sleep(self.engine_initial_wait)
            
            # Step 4: Poll for readiness
            self.logger.info(
                "Polling http://%s:%d/version for readiness...", 
                self.voicevox_host, 
                self.voicevox_port
            )
            
            if self._wait_for_readiness(timeout - int(self.engine_initial_wait)):
                self.is_ready = True
                startup_time = time.time() - self.engine_start_time
                self.logger.info(
                    "Voicevox engine started successfully (%.2f seconds)", 
                    startup_time
                )
                return True
            else:
                self.logger.error(
                    "Voicevox engine failed to start within %d seconds", 
                    timeout
                )
                self._stop_engine()
                return False
        
        except Exception as e:
            self.logger.error(
                "Error starting Voicevox engine: %s", 
                str(e), 
                exc_info=True
            )
            self._cleanup_process()
            return False
    
    def synthesize(
        self, 
        text: str, 
        speaker_id: Optional[int] = None,
        auto_play_override: Optional[bool] = None
    ) -> Tuple[Optional[TTSAudioOutput], Optional[str]]:
        """Synthesize text to speech using Voicevox engine and auto-play if enabled.
        
        Args:
            text: Japanese text to synthesize
            speaker_id: Voicevox speaker ID (default: from config)
            auto_play_override: Override the default auto_play setting for this call
        
        Returns:
            Tuple of (TTSAudioOutput, error_message). One will be None.
        """
        if speaker_id is None:
            speaker_id = self.voicevox_speaker_id
        
        if not text or not isinstance(text, str):
            error = "Invalid text input for TTS synthesis"
            self.logger.warning(error)
            return None, error
        
        if not self.is_ready:
            if not self.start_engine():
                error = "Voicevox engine not available"
                self.logger.error(error)
                return None, error
        
        try:
            start_time = time.time()
            
            # Step 1: Query for audio query
            self.logger.debug(
                "Requesting audio query for text: %d chars", 
                len(text)
            )
            
            query_response = requests.post(
                f"http://{self.voicevox_host}:{self.voicevox_port}/audio_query",
                params={"text": text, "speaker": speaker_id},
                timeout=self.voicevox_timeout
            )
            
            if query_response.status_code != 200:
                error = f"Audio query failed: {query_response.status_code}"
                self.logger.error(error)
                return None, error
            
            query_data = query_response.json()
            
            # Step 2: Synthesize audio
            self.logger.debug(
                "Synthesizing audio for speaker %d", 
                speaker_id
            )
            
            synthesis_response = requests.post(
                f"http://{self.voicevox_host}:{self.voicevox_port}/synthesis",
                params={"speaker": speaker_id},
                json=query_data,
                timeout=self.voicevox_timeout
            )
            
            if synthesis_response.status_code != 200:
                error = f"Synthesis failed: {synthesis_response.status_code}"
                self.logger.error(error)
                return None, error
            
            audio_data = synthesis_response.content
            synthesis_time_ms = (time.time() - start_time) * 1000
            
            # Parse WAV data to extract metadata
            sample_rate, channels, duration_ms = self._parse_wav_metadata(audio_data)
            
            audio_output = TTSAudioOutput(
                audio_data=audio_data,
                audio_format="wav",
                duration_ms=duration_ms,
                text_length=len(text),
                synthesis_time_ms=synthesis_time_ms,
                speaker_id=speaker_id,
                sample_rate=sample_rate,
                channels=channels
            )
            
            self.logger.info(
                "Audio synthesized successfully | "
                "Duration: %.2fms | Synthesis time: %.2fms | "
                "Sample rate: %dHz | Channels: %d",
                duration_ms,
                synthesis_time_ms,
                sample_rate,
                channels
            )
            
            # Step 3: Auto-play if enabled
            should_auto_play = (
                auto_play_override if auto_play_override is not None 
                else self.auto_play
            )
            
            if should_auto_play:
                self.play_audio_async(audio_output)
            
            return audio_output, None
        
        except requests.Timeout:
            error = "Voicevox engine timeout (>10s)"
            self.logger.error(error)
            return None, error
        
        except requests.ConnectionError:
            error = "Cannot connect to Voicevox engine"
            self.logger.error(error)
            self.is_ready = False
            return None, error
        
        except Exception as e:
            error = f"Unexpected TTS error: {str(e)}"
            self.logger.error(error, exc_info=True)
            return None, error
    
    def stop_engine(self) -> bool:
        """Stop the Voicevox engine subprocess.
        
        Returns:
            True if stopped successfully
        """
        return self._stop_engine()
    
    def wait_for_playback(self, timeout: Optional[float] = None) -> bool:
        """Wait for the current playback thread to complete.
        
        Args:
            timeout: Maximum seconds to wait (None = wait indefinitely)
        
        Returns:
            True if playback completed or no playback in progress
        """
        if self._playback_thread is None or not self._playback_thread.is_alive():
            return True
        
        self._playback_thread.join(timeout=timeout)
        return not self._playback_thread.is_alive()
    
    def play_audio_async(
        self, 
        audio_output: TTSAudioOutput,
        callback: Optional[Callable[[bool], None]] = None
    ) -> bool:
        """Play audio asynchronously in a background thread (in-memory, no temp files).
        
        Args:
            audio_output: TTSAudioOutput object with audio data
            callback: Optional callback(success: bool) called after playback completes
        
        Returns:
            True if playback started successfully
        """
        if not SOUNDDEVICE_AVAILABLE:
            self.logger.warning(
                "sounddevice not available - cannot play audio. "
                "Install with: pip install sounddevice numpy"
            )
            return False
        
        try:
            # Convert WAV bytes to numpy array
            audio_array = self._wav_to_numpy_array(audio_output.audio_data)
            
            if audio_array is None:
                self.logger.error("Failed to decode WAV audio data")
                if callback:
                    callback(False)
                return False
            
            # Start playback in background thread
            self._playback_thread = threading.Thread(
                target=self._playback_worker,
                args=(audio_array, audio_output.sample_rate, callback),
                daemon=True
            )
            self._playback_thread.start()
            
            self.logger.debug(
                "Audio playback started asynchronously (in-memory stream)"
            )
            return True
        
        except Exception as e:
            self.logger.error("Error starting audio playback: %s", str(e), exc_info=True)
            if callback:
                callback(False)
            return False
    
    def play_audio_sync(
        self,
        audio_output: TTSAudioOutput,
        timeout: Optional[float] = None
    ) -> bool:
        """Play audio synchronously (blocks until playback completes).
        
        Args:
            audio_output: TTSAudioOutput object with audio data
            timeout: Maximum seconds to wait for playback
        
        Returns:
            True if playback completed successfully
        """
        if not SOUNDDEVICE_AVAILABLE:
            self.logger.warning("sounddevice not available - cannot play audio")
            return False
        
        try:
            # Convert WAV bytes to numpy array
            audio_array = self._wav_to_numpy_array(audio_output.audio_data)
            
            if audio_array is None:
                self.logger.error("Failed to decode WAV audio data")
                return False
            
            # Play directly using sounddevice
            self.logger.debug("Starting synchronous audio playback")
            sd.play(audio_array, samplerate=audio_output.sample_rate)
            sd.wait(timeout=timeout)
            
            self.logger.debug("Audio playback completed")
            return True
        
        except Exception as e:
            self.logger.error("Error during audio playback: %s", str(e), exc_info=True)
            return False
    
    def _playback_worker(
        self,
        audio_array: 'np.ndarray',
        sample_rate: int,
        callback: Optional[Callable[[bool], None]]
    ) -> None:
        """Worker thread for asynchronous audio playback.
        
        Args:
            audio_array: Numpy array with audio samples
            sample_rate: Sample rate in Hz
            callback: Optional callback function
        """
        try:
            sd.play(audio_array, samplerate=sample_rate)
            sd.wait()
            self.logger.debug("Asynchronous audio playback completed")
            if callback:
                callback(True)
        except Exception as e:
            self.logger.error(
                "Error in playback worker thread: %s", 
                str(e), 
                exc_info=True
            )
            if callback:
                callback(False)
    
    def health_check(self) -> bool:
        """Check if Voicevox engine is healthy and responsive.
        
        Returns:
            True if engine is running and responsive
        """
        try:
            response = requests.get(
                f"http://{self.voicevox_host}:{self.voicevox_port}/version",
                timeout=1
            )
            return response.status_code == 200
        except Exception as e:
            self.logger.debug("Health check failed: %s", str(e))
            return False
    
    def _wait_for_readiness(self, timeout: int) -> bool:
        """Poll http://127.0.0.1:50021/version until engine is ready.
        
        Args:
            timeout: Maximum seconds to wait
        
        Returns:
            True if engine becomes ready within timeout
        """
        start_time = time.time()
        attempt = 0
        poll_interval = 0.5
        
        while time.time() - start_time < timeout:
            attempt += 1
            try:
                if self.health_check():
                    elapsed = time.time() - start_time
                    self.logger.debug(
                        "Engine ready after %d polling attempts (%.2f seconds)",
                        attempt,
                        elapsed
                    )
                    return True
            except Exception as e:
                self.logger.debug("Readiness check attempt %d failed: %s", attempt, str(e))
            
            time.sleep(poll_interval)
        
        elapsed = time.time() - start_time
        self.logger.warning(
            "Engine not ready after %d attempts and %.2f seconds",
            attempt,
            elapsed
        )
        
        # Check if process is still running
        if self.engine_process and self.engine_process.poll() is not None:
            self.logger.error("Engine process crashed during startup")
        
        return False
    
    def _stop_engine(self) -> bool:
        """Terminate the Voicevox engine subprocess.
        
        Returns:
            True if terminated successfully
        """
        if self.engine_process is None:
            return True
        
        try:
            if self.engine_process.poll() is None:
                # Process still running
                self.engine_process.terminate()
                try:
                    self.engine_process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    self.logger.warning("Force killing Voicevox engine after graceful termination timeout")
                    self.engine_process.kill()
                    self.engine_process.wait(timeout=2)
            
            self.is_ready = False
            self.logger.info("Voicevox engine stopped")
            return True
        except Exception as e:
            self.logger.error(
                "Error stopping Voicevox engine: %s", 
                str(e)
            )
            return False
    
    def _cleanup_process(self) -> None:
        """Clean up engine process resources on failure."""
        try:
            if self.engine_process is not None:
                self.engine_process.terminate()
        except Exception:
            pass
        finally:
            self.engine_process = None
            self.is_ready = False
    
    @staticmethod
    def _parse_wav_metadata(audio_data: bytes) -> Tuple[int, int, float]:
        """Extract metadata from WAV file binary data.
        
        Args:
            audio_data: WAV file bytes
        
        Returns:
            Tuple of (sample_rate, channels, duration_ms)
        """
        try:
            if len(audio_data) < 44:
                return 44100, 1, 0.0
            
            # WAV header structure (little-endian):
            # Bytes 0-3: "RIFF"
            # Bytes 4-7: File size
            # Bytes 8-11: "WAVE"
            # Bytes 12-15: "fmt "
            # Bytes 16-19: Format chunk size
            # Bytes 20-21: Audio format (1=PCM)
            # Bytes 22-23: Number of channels
            # Bytes 24-27: Sample rate
            # Bytes 28-31: Byte rate
            # Bytes 32-33: Block align
            # Bytes 34-35: Bits per sample
            # Bytes 36-39: "data"
            # Bytes 40-43: Data chunk size
            
            channels = int.from_bytes(audio_data[22:24], byteorder='little')
            sample_rate = int.from_bytes(audio_data[24:28], byteorder='little')
            bits_per_sample = int.from_bytes(audio_data[34:36], byteorder='little')
            
            # Find "data" chunk
            data_pos = audio_data.find(b'data')
            if data_pos == -1 or data_pos + 8 > len(audio_data):
                return sample_rate, channels, 0.0
            
            data_size = int.from_bytes(
                audio_data[data_pos+4:data_pos+8], 
                byteorder='little'
            )
            
            if sample_rate == 0:
                return 44100, channels, 0.0
            
            # Calculate duration
            bytes_per_sample = bits_per_sample // 8
            total_samples = data_size // (channels * bytes_per_sample) if bytes_per_sample > 0 else 0
            duration_ms = (total_samples / sample_rate) * 1000 if total_samples > 0 else 0.0
            
            return sample_rate, channels, duration_ms
        
        except Exception as e:
            logger.debug("Error parsing WAV metadata: %s", str(e))
            return 44100, 1, 0.0
    
    @staticmethod
    def _wav_to_numpy_array(wav_data: bytes) -> Optional['np.ndarray']:
        """Convert WAV binary data to numpy array for playback.
        
        Args:
            wav_data: WAV file bytes
        
        Returns:
            Numpy array with audio samples or None on error
        """
        if not SOUNDDEVICE_AVAILABLE:
            return None
        
        try:
            import io
            import wave
            
            # Read WAV data using Python's wave module
            with io.BytesIO(wav_data) as wav_file:
                with wave.open(wav_file, 'rb') as wav_reader:
                    n_channels = wav_reader.getnchannels()
                    sample_width = wav_reader.getsampwidth()
                    framerate = wav_reader.getframerate()
                    n_frames = wav_reader.getnframes()
                    
                    # Read audio frames
                    audio_bytes = wav_reader.readframes(n_frames)
                    
                    # Convert bytes to numpy array
                    audio_array = np.frombuffer(audio_bytes, dtype=np.int16)
                    
                    # Normalize to float32 (-1.0 to 1.0) for sounddevice
                    audio_array = audio_array.astype(np.float32) / 32768.0
                    
                    # Reshape for multichannel if needed
                    if n_channels > 1:
                        audio_array = audio_array.reshape(-1, n_channels)
                    
                    return audio_array
        
        except Exception as e:
            logger.debug("Error converting WAV to numpy array: %s", str(e))
            return None
