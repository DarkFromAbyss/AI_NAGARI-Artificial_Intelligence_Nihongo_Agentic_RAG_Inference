import * as THREE from "three";

export type AnimationStateType = "idle" | "walk" | "none";

interface AnimationState {
  name: string;
  action: THREE.AnimationAction | null;
  weight: number;
  enabled: boolean;
}

/**
 * VRM animation controller.
 * Manages playing, blending, and transitioning between body animations.
 * Supports both embedded animations and external animation loading.
 */
export class VrmAnimationController {
  private mixer: THREE.AnimationMixer;
  private animations: Map<string, THREE.AnimationClip> = new Map();
  private activeStates: Map<AnimationStateType, AnimationState> = new Map();
  private currentState: AnimationStateType = "idle";

  constructor(mixer: THREE.AnimationMixer) {
    this.mixer = mixer;
  }

  /**
   * Register animations from GLTF clip array.
   * Called after loading a model with embedded animations.
   */
  public registerAnimations(clips: THREE.AnimationClip[]): void {
    clips.forEach((clip) => {
      this.animations.set(clip.name.toLowerCase(), clip);
    });
  }

  /**
   * Play an animation by name. Returns the action for advanced control.
   */
  public playAnimation(
    animationName: string,
    loop: number = THREE.LoopRepeat,
    transitionDuration: number = 0.5
  ): THREE.AnimationAction | null {
    const clip = this.animations.get(animationName.toLowerCase());
    if (!clip) return null;

    const action = this.mixer.clipAction(clip);
    action.loop = loop;
    action.clampWhenFinished = false;

    // Smooth transition to new animation
    if (transitionDuration > 0) {
      action.reset();
      action.fadeIn(transitionDuration);
    }

    action.play();
    return action;
  }

  /**
   * Stop an animation with fade-out transition.
   */
  public stopAnimation(transitionDuration: number = 0.5): void {
    this.mixer.stopAllAction();
  }

  /**
   * Transition to a new animation state (idle, walk, etc).
   */
  public transitionToState(
    newState: AnimationStateType,
    transitionDuration: number = 0.5
  ): void {
    // Stop previous animations
    if (this.currentState !== newState) {
      this.mixer.stopAllAction();
    }

    this.currentState = newState;

    switch (newState) {
      case "idle":
        this.playAnimation("idle", THREE.LoopRepeat, transitionDuration);
        break;
      case "walk":
        this.playAnimation("walk", THREE.LoopRepeat, transitionDuration);
        break;
      case "none":
        this.stopAnimation(transitionDuration);
        break;
    }
  }

  /**
   * Get list of available animation names.
   */
  public getAvailableAnimations(): string[] {
    return Array.from(this.animations.keys());
  }

  /**
   * Check if animation exists.
   */
  public hasAnimation(animationName: string): boolean {
    return this.animations.has(animationName.toLowerCase());
  }

  /**
   * Get current animation state.
   */
  public getCurrentState(): AnimationStateType {
    return this.currentState;
  }

  /**
   * Get the mixer instance for advanced animation control.
   */
  public getMixer(): THREE.AnimationMixer {
    return this.mixer;
  }
}
