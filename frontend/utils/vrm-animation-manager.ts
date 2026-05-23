import * as THREE from "three";

/**
 * VRM Animation Management Utilities
 *
 * Helper functions for:
 * - Animation metadata and enumeration
 * - Smooth blending calculations
 * - Animation lifecycle management
 * - Performance monitoring
 */

/**
 * VRMA Animation metadata.
 * Maps animation file names to human-readable descriptions.
 */
export const VRMA_ANIMATIONS = {
  VRMA_01: {
    file: "VRMA_01.vrma",
    name: "Show full body",
    duration: 0,
    loop: true,
  },
  VRMA_02: {
    file: "VRMA_02.vrma",
    name: "Greeting",
    duration: 0,
    loop: true,
  },
  VRMA_03: {
    file: "VRMA_03.vrma",
    name: "Peace sign",
    duration: 0,
    loop: true,
  },
  VRMA_04: {
    file: "VRMA_04.vrma",
    name: "Shoot",
    duration: 0,
    loop: true,
  },
  VRMA_05: {
    file: "VRMA_05.vrma",
    name: "Spin",
    duration: 0,
    loop: true,
  },
  VRMA_06: {
    file: "VRMA_06.vrma",
    name: "Model pose",
    duration: 0,
    loop: true,
  },
  VRMA_07: {
    file: "VRMA_07.vrma",
    name: "Squat",
    duration: 0,
    loop: true,
  },
} as const;

/**
 * Get animation file by name key.
 * Safe lookup with fallback to VRMA_02 (default).
 */
export function getAnimationFile(
  key: keyof typeof VRMA_ANIMATIONS | string
): string {
  const anim = VRMA_ANIMATIONS[key as keyof typeof VRMA_ANIMATIONS];
  return anim ? anim.file : VRMA_ANIMATIONS.VRMA_02.file;
}

/**
 * Get animation metadata by file name.
 * Returns null if animation not found.
 */
export function getAnimationMetadata(
  fileName: string
): (typeof VRMA_ANIMATIONS)[keyof typeof VRMA_ANIMATIONS] | null {
  for (const [_key, animation] of Object.entries(VRMA_ANIMATIONS)) {
    if (animation.file === fileName) {
      return animation;
    }
  }
  return null;
}

/**
 * Calculate optimal blend duration based on animation types.
 * Longer blends for drastic pose changes, shorter for similar poses.
 */
export function calculateOptimalBlendDuration(
  fromAnimation: string,
  toAnimation: string,
  baseBlendMs: number = 500
): number {
  // Fast blends for transitions between similar animations
  const fastBlend = 200; // ms
  const standardBlend = 500; // ms
  const slowBlend = 1000; // ms

  // One-shot animations benefit from longer blends
  if (toAnimation.includes("04") || toAnimation.includes("05")) {
    return slowBlend;
  }

  // Between greetings/poses: standard blend
  if (
    (fromAnimation.includes("02") && toAnimation.includes("02")) ||
    (fromAnimation.includes("03") && toAnimation.includes("03"))
  ) {
    return fastBlend;
  }

  return standardBlend;
}

/**
 * Smooth easing function for blend weight interpolation.
 * Provides natural-feeling animation transitions.
 *
 * @param t Progress from 0 to 1
 * @returns Eased value
 */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Monitor animation mixer performance.
 * Useful for debugging and optimization.
 */
export class AnimationMixerMonitor {
  private mixer: THREE.AnimationMixer;
  private frameCount = 0;
  private lastReportTime = Date.now();

  constructor(mixer: THREE.AnimationMixer) {
    this.mixer = mixer;
  }

  /**
   * Get current mixer statistics.
   */
  getStats() {
    const now = Date.now();
    const delta = now - this.lastReportTime;
    const fps = (this.frameCount / (delta / 1000)).toFixed(1);

    const stats = {
      fps,
      actionCount: this.mixer._actions.length,
      clipCount: this.mixer._clips.length,
      frameCount: this.frameCount,
    };

    if (delta > 5000) {
      // Reset every 5 seconds
      this.frameCount = 0;
      this.lastReportTime = now;
    } else {
      this.frameCount++;
    }

    return stats;
  }

  /**
   * Log mixer statistics to console.
   */
  logStats() {
    const stats = this.getStats();
    console.log(
      `[AnimationMixer] FPS: ${stats.fps}, Actions: ${stats.actionCount}, Clips: ${stats.clipCount}`
    );
  }
}

/**
 * Animation queue manager for sequential playback.
 * Useful for scripted animations or conversation flows.
 */
export class AnimationQueue {
  private queue: Array<{
    file: string;
    options?: any;
  }> = [];
  private isPlaying = false;

  /**
   * Enqueue an animation for sequential playback.
   */
  enqueue(file: string, options?: any) {
    this.queue.push({ file, options });
  }

  /**
   * Get next animation in queue without removing.
   */
  peek() {
    return this.queue[0] || null;
  }

  /**
   * Remove and return next animation.
   */
  dequeue() {
    return this.queue.shift() || null;
  }

  /**
   * Check if queue has pending animations.
   */
  hasPending(): boolean {
    return this.queue.length > 0;
  }

  /**
   * Clear all queued animations.
   */
  clear() {
    this.queue = [];
  }

  /**
   * Get queue length.
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Mark animation as playing/finished.
   */
  setIsPlaying(isPlaying: boolean) {
    this.isPlaying = isPlaying;
  }

  /**
   * Check if currently playing.
   */
  getIsPlaying(): boolean {
    return this.isPlaying;
  }
}
