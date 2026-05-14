/**
 * VRM Eye-Blinking Animation Controller
 * 
 * Handles natural eye-blinking animations for VRM 0.0 and VRM 1.0 models
 * with configurable blink speed and randomized inter-blink delays.
 */

import { VRM } from "@pixiv/three-vrm";

export interface BlinkConfig {
  /**
   * Time in seconds for blink transition (closed/open)
   * Typical range: 0.1 - 0.3 seconds for natural blink
   */
  blinkDuration: number;

  /**
   * Minimum seconds to wait between blinks
   * Typical range: 2 - 4 seconds
   */
  minDelaySeconds: number;

  /**
   * Maximum seconds to wait between blinks
   * Typical range: 4 - 8 seconds
   * Randomized delay = Math.random() * (max - min) + min
   */
  maxDelaySeconds: number;
}

export interface BlinkState {
  /**
   * Elapsed time in current blink cycle phase
   */
  elapsedTime: number;

  /**
   * Current blend shape weight (0.0 = open, 1.0 = closed)
   */
  currentWeight: number;

  /**
   * True if currently in blink motion, False if resting
   */
  isBlinking: boolean;

  /**
   * Next scheduled blink time (in absolute seconds)
   */
  nextBlinkTime: number;
}

export class VRMBlinkController {
  private config: BlinkConfig;
  private state: BlinkState;
  private lastUpdateTime: number = 0;

  constructor(config: Partial<BlinkConfig> = {}) {
    this.config = {
      blinkDuration: config.blinkDuration ?? 0.15,
      minDelaySeconds: config.minDelaySeconds ?? 2,
      maxDelaySeconds: config.maxDelaySeconds ?? 6,
    };

    this.state = {
      elapsedTime: 0,
      currentWeight: 0,
      isBlinking: false,
      nextBlinkTime: this.getRandomDelaySeconds(),
    };
  }

  /**
   * Update blink state based on elapsed delta time
   * Call this from requestAnimationFrame or useFrame hook
   */
  update(deltaSeconds: number, currentTimeSeconds: number): void {
    this.state.elapsedTime += deltaSeconds;

    // Check if it's time to start a new blink
    if (!this.state.isBlinking && currentTimeSeconds >= this.state.nextBlinkTime) {
      this.state.isBlinking = true;
      this.state.elapsedTime = 0;
    }

    if (this.state.isBlinking) {
      // Calculate blink progress (0 to 1 and back to 0)
      // First half: closing (0 to 0.5), Second half: opening (0.5 to 1.0)
      const blinkProgress = Math.min(
        this.state.elapsedTime / this.config.blinkDuration,
        1.0
      );

      // Smooth closing and opening using cosine for natural easing
      if (blinkProgress < 0.5) {
        // Closing phase: 0 -> 1
        this.state.currentWeight = Math.sin(blinkProgress * Math.PI);
      } else {
        // Opening phase: 1 -> 0
        this.state.currentWeight = Math.sin(blinkProgress * Math.PI);
      }

      // Blink complete
      if (blinkProgress >= 1.0) {
        this.state.isBlinking = false;
        this.state.currentWeight = 0;
        this.state.elapsedTime = 0;
        this.state.nextBlinkTime =
          currentTimeSeconds + this.getRandomDelaySeconds();
      }
    }
  }

  /**
   * Apply current blink weight to VRM expression
   * Handles both VRM 0.0 (BlendShapeProxy) and VRM 1.0 (VRMExpressionManager)
   */
  applyToVRM(vrm: VRM): void {
    if (!vrm) return;

    try {
      // VRM 1.0: Use VRMExpressionManager
      if (vrm.expressionManager) {
        const blinkExpression = vrm.expressionManager.getExpression("blink");
        if (blinkExpression) {
          blinkExpression.weight = this.state.currentWeight;
        }
      }

      // VRM 0.0: Use BlendShapeProxy fallback
      if (
        !vrm.expressionManager &&
        (vrm as any).blendShapeProxy
      ) {
        const proxy = (vrm as any).blendShapeProxy;
        proxy.setValue("Blink", this.state.currentWeight);
      }
    } catch (error) {
      // Silently handle missing blink expressions
      // Some VRM models may not have blink support
    }
  }

  /**
   * Get current blink weight (0.0 - 1.0)
   */
  getWeight(): number {
    return this.state.currentWeight;
  }

  /**
   * Check if currently blinking
   */
  getIsBlinking(): boolean {
    return this.state.isBlinking;
  }

  /**
   * Get current blink configuration
   */
  getConfig(): Readonly<BlinkConfig> {
    return { ...this.config };
  }

  /**
   * Update blink configuration at runtime
   */
  setConfig(newConfig: Partial<BlinkConfig>): void {
    this.config = {
      blinkDuration: newConfig.blinkDuration ?? this.config.blinkDuration,
      minDelaySeconds:
        newConfig.minDelaySeconds ?? this.config.minDelaySeconds,
      maxDelaySeconds:
        newConfig.maxDelaySeconds ?? this.config.maxDelaySeconds,
    };
  }

  /**
   * Force immediate blink (useful for reactions)
   */
  triggerBlink(): void {
    this.state.isBlinking = true;
    this.state.elapsedTime = 0;
  }

  /**
   * Reset blink controller to initial state
   */
  reset(): void {
    this.state.elapsedTime = 0;
    this.state.currentWeight = 0;
    this.state.isBlinking = false;
    this.state.nextBlinkTime = this.getRandomDelaySeconds();
  }

  /**
   * Generate randomized delay between blinks
   */
  private getRandomDelaySeconds(): number {
    const delayRange = this.config.maxDelaySeconds - this.config.minDelaySeconds;
    return Math.random() * delayRange + this.config.minDelaySeconds;
  }
}
