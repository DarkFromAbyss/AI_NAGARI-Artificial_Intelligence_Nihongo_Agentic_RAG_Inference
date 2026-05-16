import { VRM, VRMExpressionPresetName } from "@pixiv/three-vrm";

interface BlinkConfig {
  minInterval: number;
  maxInterval: number;
  blinkDuration: number;
}

const DEFAULT_BLINK_CONFIG: BlinkConfig = {
  minInterval: 2,      // Minimum seconds between blinks
  maxInterval: 5,      // Maximum seconds between blinks
  blinkDuration: 0.15, // Blink animation duration in seconds
};

/**
 * VRM BlendShape (facial expression) controller.
 * Manages natural blinking and other facial expressions via VRM's BlendShapeProxy.
 */
export class VrmBlendShapeController {
  private vrm: VRM;
  private blinkConfig: BlinkConfig;
  private nextBlinkTime: number = 0;
  private isBlinking: boolean = false;
  private blinkStartTime: number = 0;

  constructor(vrm: VRM, config: Partial<BlinkConfig> = {}) {
    this.vrm = vrm;
    this.blinkConfig = { ...DEFAULT_BLINK_CONFIG, ...config };
    this.scheduleNextBlink();
  }

  /**
   * Schedule next blink at randomized interval.
   */
  private scheduleNextBlink(): void {
    const randomInterval =
      Math.random() * (this.blinkConfig.maxInterval - this.blinkConfig.minInterval) +
      this.blinkConfig.minInterval;
    this.nextBlinkTime = Date.now() + randomInterval * 1000;
  }

  /**
   * Update blink state. Call this every frame.
   * Returns true if currently blinking.
   */
  public update(currentTime: number): boolean {
    const expressionController = this.vrm.expressionManager;
    if (!expressionController) return false;

    // Trigger blink if interval elapsed
    if (!this.isBlinking && currentTime >= this.nextBlinkTime) {
      this.isBlinking = true;
      this.blinkStartTime = currentTime;
    }

    // Update blink weight based on elapsed time
    if (this.isBlinking) {
      const elapsedBlink = currentTime - this.blinkStartTime;
      const blinkProgress = Math.min(
        elapsedBlink / this.blinkConfig.blinkDuration,
        1
      );

      // Bell curve for natural blink (rise and fall)
      const blinkWeight = Math.sin(blinkProgress * Math.PI);
      expressionController.setValue("blink", blinkWeight);

      // End blink
      if (blinkProgress >= 1) {
        this.isBlinking = false;
        expressionController.setValue("blink", 0);
        this.scheduleNextBlink();
      }
    }

    return this.isBlinking;
  }

  /**
   * Set a specific expression value (0-1).
   */
  public setExpression(
    expressionName: VRMExpressionPresetName,
    value: number
  ): void {
    const expressionController = this.vrm.expressionManager;
    if (expressionController) {
      expressionController.setValue(expressionName, Math.max(0, Math.min(1, value)));
    }
  }

  /**
   * Get current expression value.
   */
  public getExpression(expressionName: VRMExpressionPresetName): number {
    const expressionController = this.vrm.expressionManager;
    return expressionController?.getValue(expressionName) ?? 0;
  }

  /**
   * Reset all expressions to zero.
   */
  public resetExpressions(): void {
    const expressionController = this.vrm.expressionManager;
    if (expressionController) {
      // Reset common VRM expression presets
      const presets: VRMExpressionPresetName[] = [
        "blink",
        "blinkLeft",
        "blinkRight",
        "lookUp",
        "lookDown",
        "lookLeft",
        "lookRight",
        "happy",
        "sad",
        "angry",
        "surprised",
        "relaxed",
        "neutral",
      ];
      presets.forEach((preset) => {
        expressionController.setValue(preset, 0);
      });
    }
  }
}
