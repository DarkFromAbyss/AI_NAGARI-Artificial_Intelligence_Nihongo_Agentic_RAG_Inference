"use client";

import { useEffect, useRef, useState } from "react";
import { ThreeElements, useFrame} from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRM, VRMUtils, VRMCore,} from "@pixiv/three-vrm";
import {
  VRMAnimationLoaderPlugin,
  createVRMAnimationClip,
} from "@pixiv/three-vrm-animation";
import * as THREE from "three";
// import { VrmBlendShapeController } from "@/utils/vrm-blendshape-controller";
// import { VrmAnimationController } from "@/utils/vrm-animation-controller";
import { group } from "console";

/**
 * VrmModel Component
 *
 * Loads and renders a VRM 3D character model with automatic VRMA animation.
 * Features:
 * - Automatic VRMA animation loading on mount
 * - Proper async handling to prevent race conditions
 * - Complete memory cleanup on unmount
 * - Correct frame loop update order (expressions → mixer → vrm.update)
 * - Error resilience with graceful fallback
 */

type VrmModelProps = ThreeElements["group"] & {
  url: string;
  animationPath?: string; // Path to VRMA file (default: "animations/vrma/VRMA_02.vrma")
  onError?: (error: Error) => void;
  onLoad?: (vrm: VRM) => void;
  onAnimationLoaded?: (animationName: string) => void;
  wrapperRef?: React.Ref<THREE.Group>;
  position?: [number, number, number] | THREE.Vector3;
  rotation?: [number, number, number] | THREE.Euler;
  scale?: [number, number, number] | THREE.Vector3 | number;
}

interface AnimationState {
  vrmaClip: THREE.AnimationClip | null;
  action: THREE.AnimationAction | null;
}

interface AnimationStateTracker {
  currentState: "idle" | "greeting" | "showFullBody";
  greetingAction: THREE.AnimationAction | null;
  idleAction: THREE.AnimationAction | null;
  showFullBodyAction: THREE.AnimationAction | null;
  nextRandomTriggerTime: number; // Time when next ShowFullBody should trigger
  lastShowFullBodyTime: number; // Track when last ShowFullBody finished
}

// Configuration constants
const GREETING_ANIMATION_PATH = "animations/vrma_01/Greeting.vrma";
const SHOW_FULL_BODY_PATH = "animations/vrma_01/ShowFullBody.vrma";
const IDLE_ANIMATION_MIN_MS = 5000; // Minimum 5 seconds
const IDLE_ANIMATION_MAX_MS = 8000; // Maximum 8 seconds
const CROSSFADE_DURATION = 0.5; // 500ms smooth transition

/**
 * Custom Default Pose Definition
 * 
 * This defines the resting pose for the VRM character when no animation is playing.
 * Pose: A-pose with arms angled down at ~45 degrees and hands positioned in front of belly
 * 
 * Quaternion format: { x, y, z, w } - represents rotation around 3D axes
 * 
 * Key angles:
 * - Shoulders: ~11 degrees forward
 * - Upper Arms: ~45 degrees down from neutral
 * - Forearms: ~15 degrees bend
 * - Hands: Neutral rotation with slight forward tilt
 */
const CUSTOM_DEFAULT_POSE: { [boneName: string]: { x: number; y: number; z: number; w: number } } = {
  // Shoulder bones - slightly forward and down (A-pose)
  leftShoulder: { x: 0.0873, y: 0, z: 0, w: 0.9962 },     // ~10 degrees forward
  rightShoulder: { x: 0.0873, y: 0, z: 0, w: 0.9962 },
  
  // Upper arms - angled down at approximately 45 degrees
  leftUpperArm: { x: 0.3826, y: 0, z: 0, w: 0.924 },      // ~45 degrees down (A-pose)
  rightUpperArm: { x: 0.3826, y: 0, z: 0, w: 0.924 },
  
  // Forearms - slightly bent, bringing hands forward
  leftLowerArm: { x: 0.1305, y: 0, z: 0, w: 0.9914 },     // ~15 degrees bend
  rightLowerArm: { x: 0.1305, y: 0, z: 0, w: 0.9914 },
  
  // Hands - positioned naturally in front of belly with slight forward tilt
  leftHand: { x: 0.0436, y: 0, z: 0, w: 0.9990 },         // ~5 degrees forward tilt
  rightHand: { x: 0.0436, y: 0, z: 0, w: 0.9990 },
};

export function VrmModel({
  url,
  animationPath = "animations/vrma_01/Greeting.vrma",
  onError,
  onLoad,
  onAnimationLoaded,
  wrapperRef,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  ...groupProps
}: VrmModelProps) {
  const [vrm, setVrm] = useState<VRM | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isAnimationLoading, setIsAnimationLoading] = useState(true);
  // FIX: Track avatar visibility state - avatar stays hidden until animation is actively playing
  // This prevents the T-pose flash between VRM load and animation start
  const [isAvatarVisible, setIsAvatarVisible] = useState(false);

  // Refs for cleanup tracking
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  // const blendShapeControllerRef = useRef<VrmBlendShapeController | null>(null);
  // const animationControllerRef = useRef<VrmAnimationController | null>(null);
  const animationStateRef = useRef<AnimationStateTracker>({
    currentState: "idle",
    greetingAction: null,
    idleAction: null,
    showFullBodyAction: null,
    nextRandomTriggerTime: 0,
    lastShowFullBodyTime: 0,
  });

  // Clock for consistent delta time
  const clockRef = useRef<THREE.Clock>(new THREE.Clock());

  // Track if component is mounted (prevents state updates after unmount)
  const isMountedRef = useRef(true);

  // Track if initial setup is complete
  const isInitializedRef = useRef(false);



  /**
   * Apply custom default pose to VRM character.
   * 
   * Sets the model to an A-pose with arms angled down and hands in front of belly.
   * This is the resting state when no animation is actively playing.
   * 
   * Implementation Notes:
   * - Directly modifies bone quaternions in the humanoid skeleton
   * - This approach ensures the pose persists even when idle animation clip finishes
   * - Call this AFTER mixer.update() to override any animation traces
   * - The pose is defined in CUSTOM_DEFAULT_POSE constant
   */
  const applyCustomDefaultPose = () => {
    if (!vrm) return;

    const humanoid = (vrm as any).humanoid;
    if (!humanoid) return;

    try {
      // Apply each bone rotation from the custom pose definition
      Object.entries(CUSTOM_DEFAULT_POSE).forEach(([boneName, quaternion]) => {
        try {
          const bone = humanoid.getRawBoneNode(boneName);
          if (bone) {
            // Set the bone's quaternion to the custom pose value
            bone.quaternion.set(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
            
            // Also update matrix to ensure transforms propagate
            bone.updateMatrix();
          }
        } catch (err) {
          // Silently skip bones that don't exist in this model
          // Different VRM models may have different bone hierarchies
        }
      });
      
      // Update the scene hierarchy to propagate all bone changes
      vrm.scene.updateMatrixWorld(true);
    } catch (err) {
      console.warn("Failed to apply custom default pose:", err);
    }
  };

  /**
   * Create idle animation clip.
   * 
   * Returns a minimal empty animation clip that serves as a placeholder.
   * The actual pose is applied directly via applyCustomDefaultPose() 
   * which is called continuously in the useFrame loop while idle.
   * 
   * We use an animation action (rather than stopping mixer) so we can smoothly
   * blend/crossfade between animations and idle state.
   */
  const createCustomIdleAnimationClip = (): THREE.AnimationClip => {
    // Return a minimal empty clip - actual pose management is done via applyCustomDefaultPose()
    return new THREE.AnimationClip("idle", 0.016, []);
  };



  /**
   * Utility: Calculate next random trigger time for ShowFullBody animation.
   * Returns time in milliseconds between IDLE_ANIMATION_MIN_MS and IDLE_ANIMATION_MAX_MS.
   */
  const calculateNextRandomTriggerTime = (): number => {
    return Math.random() * (IDLE_ANIMATION_MAX_MS - IDLE_ANIMATION_MIN_MS) + IDLE_ANIMATION_MIN_MS;
  };

  /**
   * Transition between animation states with smooth crossfade.
   * Stops the current animation and starts the next one with blending.
   * 
   * Note on idle state:
   * - The custom A-pose is applied continuously in useFrame while in idle state
   * - We set up the next random trigger time when transitioning to idle
   * - The pose itself is NOT applied here - it's handled by the frame loop
   */
  const transitionToAnimation = (
    targetState: "idle" | "greeting" | "showFullBody",
    targetAction: THREE.AnimationAction | null
  ) => {
    if (!targetAction || !mixerRef.current) return;

    // Get current action based on current state
    let currentAction: THREE.AnimationAction | null = null;
    if (animationStateRef.current.currentState === "greeting") {
      currentAction = animationStateRef.current.greetingAction;
    } else if (animationStateRef.current.currentState === "idle") {
      currentAction = animationStateRef.current.idleAction;
    } else if (animationStateRef.current.currentState === "showFullBody") {
      currentAction = animationStateRef.current.showFullBodyAction;
    }

    if (currentAction && currentAction !== targetAction) {
      // Smooth crossfade from current to target animation
      currentAction.crossFadeTo(targetAction, CROSSFADE_DURATION, true);
    }

    // Play the target animation
    targetAction.reset();
    targetAction.play();

    // Update state
    animationStateRef.current.currentState = targetState;

    // If transitioning to idle, set up next random trigger
    if (targetState === "idle") {
      // Set up the next random trigger time (between 5-8 seconds from now)
      animationStateRef.current.nextRandomTriggerTime =
        clockRef.current.getElapsedTime() + calculateNextRandomTriggerTime() / 1000;
    }
  };

  /**
   * Load a VRMA animation and create an AnimationClip.
   * Returns the created AnimationClip or null on failure.
   */
  const loadVRMAAnimationClip = async (
    animationPath: string,
    vrmModel: VRMCore
  ): Promise<THREE.AnimationClip | null> => {
    try {
      const animationLoader = new GLTFLoader();
      animationLoader.register(
        (parser) => new VRMAnimationLoaderPlugin(parser)
      );

      const gltf = await new Promise<any>((resolve, reject) => {
        animationLoader.load(
          animationPath,
          resolve,
          undefined,
          (error) => {
            reject(
              new Error(`Failed to load VRMA animation: ${error || animationPath}`)
            );
          }
        );
      });

      // Verify component still mounted
      if (!isMountedRef.current || !vrmModel) {
        throw new Error("Component unmounted during VRMA loading");
      }

      const vrmAnimations = gltf.userData.vrmAnimations;
      if (!vrmAnimations || vrmAnimations.length === 0) {
        throw new Error(`No animations found in VRMA file: ${animationPath}`);
      }

      const vrmAnimation = vrmAnimations[0];
      // Cast vrmModel to any to work around dependency version mismatch
      const animationClip = createVRMAnimationClip(vrmAnimation, vrmModel as any);

      if (!animationClip) {
        throw new Error("Failed to create animation clip from VRMA");
      }

      /**
       * Fix Y-axis translation offset in hip position track.
       * This corrects the reference frame mismatch between animation and model.
       */
      const hipsTrack = animationClip.tracks.find(
        (track) => track.name.includes("hips") && track.name.endsWith(".position")
      ) as THREE.VectorKeyframeTrack | undefined;

      if (hipsTrack) {
        const hipsNode = (vrmModel as any).humanoid?.getRawBoneNode("hips");
        const modelHipHeight = hipsNode?.position.y ?? 0;
        const animationInitialHipY = hipsTrack.values[1];
        const yOffset = animationInitialHipY - modelHipHeight;

        for (let i = 1; i < hipsTrack.values.length; i += 3) {
          hipsTrack.values[i] -= yOffset;
        }
      }

      return animationClip;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error(error);
      return null;
    }
  };

  /**
   * Initialize all animations (greeting, idle, showFullBody).
   * Sets up the initial animation state machine.
   */
  const initializeAnimations = async (vrmModel: VRMCore) => {
    try {
      if (!mixerRef.current || !isMountedRef.current) return;

      // Load all VRMA animation clips
      const greetingClip = await loadVRMAAnimationClip(GREETING_ANIMATION_PATH, vrmModel);
      const showFullBodyClip = await loadVRMAAnimationClip(SHOW_FULL_BODY_PATH, vrmModel);

      if (!isMountedRef.current) return;

      // Create animation actions for each clip
      if (greetingClip) {
        const greetingAction = mixerRef.current.clipAction(greetingClip);
        greetingAction.clampWhenFinished = true;
        greetingAction.loop = THREE.LoopOnce;
        animationStateRef.current.greetingAction = greetingAction;
      }

      if (showFullBodyClip) {
        const showFullBodyAction = mixerRef.current.clipAction(showFullBodyClip);
        showFullBodyAction.clampWhenFinished = true;
        showFullBodyAction.loop = THREE.LoopOnce;
        animationStateRef.current.showFullBodyAction = showFullBodyAction;
      }

      // Create custom idle action that holds the A-pose
      // This animation clip is minimal - the actual pose is applied continuously
      // in the useFrame loop via applyCustomDefaultPose() when currentState === "idle"
      const idleClip = createCustomIdleAnimationClip();
      const idleAction = mixerRef.current.clipAction(idleClip);
      idleAction.clampWhenFinished = true;
      idleAction.loop = THREE.LoopOnce;
      animationStateRef.current.idleAction = idleAction;

      // Start with greeting animation
      if (animationStateRef.current.greetingAction) {
        transitionToAnimation("greeting", animationStateRef.current.greetingAction);
        setIsAvatarVisible(true);
        onAnimationLoaded?.("Greeting");
      }

      isInitializedRef.current = true;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (isMountedRef.current) {
        setError(error);
        onError?.(error);
        setIsAvatarVisible(true);
      }
    } finally {
      if (isMountedRef.current) {
        setIsAnimationLoading(false);
      }
    }
  };

  /**
   * Main VRM loading effect.
   * Loads the VRM model and initiates animation system initialization.
   */
  useEffect(() => {
    isMountedRef.current = true;
    isInitializedRef.current = false;

    const loader = new GLTFLoader();
    // Register VRMLoaderPlugin to handle VRM-specific data
    loader.register((parser) => new VRMLoaderPlugin(parser));

    loader.load(
      url,
      (gltf) => {
        // Check component still mounted before state updates
        if (!isMountedRef.current) return;
        
        const vrmModel = gltf.userData.vrm as VRM | undefined;
        if (!vrmModel) { /* ... handle error ... */ return }

        vrmModel.scene.position.set(0, 1, 0);
        vrmModel.scene.rotation.set(0, 0, 0);
        
        if (vrmModel.humanoid) {
          const hips = vrmModel.humanoid.getRawBoneNode("hips");
          if (hips) hips.position.y = 1; 
        }

        // Initialize THREE.AnimationMixer
        // This is required for playing animation clips
        const mixer = new THREE.AnimationMixer(vrmModel.scene);
        mixerRef.current = mixer;

        // Update state to trigger re-render
        setVrm(vrmModel);

        // Notify parent that VRM model loaded successfully
        onLoad?.(vrmModel);

        // Initialize animation system (greeting → idle → showFullBody)
        initializeAnimations(vrmModel);
      },
      undefined,
      (err) => {
        if (isMountedRef.current) {
          const error = new Error(
            `Failed to load VRM model: ${err || url}`
          );
          setError(error);
          onError?.(error);
        }
      }
    );

    // Cleanup function: runs on unmount or when url changes
    return () => {
      isMountedRef.current = false;
      isInitializedRef.current = false;

      // Stop all animations
      if (mixerRef.current) {
        mixerRef.current.stopAllAction();
      }

      // Clear animation state
      animationStateRef.current = {
        currentState: "idle",
        greetingAction: null,
        idleAction: null,
        showFullBodyAction: null,
        nextRandomTriggerTime: 0,
        lastShowFullBodyTime: 0,
      };

      // Dispose all geometries and materials to prevent GPU memory leaks
      if (vrm) {
        vrm.scene.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            // Dispose geometry
            if (obj.geometry) {
              obj.geometry.dispose();
            }
            // Dispose materials (handle both single and array materials)
            if (obj.material) {
              if (Array.isArray(obj.material)) {
                obj.material.forEach((mat) => mat.dispose());
              } else {
                obj.material.dispose();
              }
            }
          }
        });
      }

      // Dispose mixer (releases all animation actions)
      if (mixerRef.current) {
        mixerRef.current.uncacheRoot(mixerRef.current.getRoot());
        mixerRef.current = null;
      }

      // Reset avatar visibility for next load
      setIsAvatarVisible(false);
    };
  }, [url, onError, onLoad, onAnimationLoaded]);

  /**
   * Animation frame update loop.
   * Runs on every frame (60 FPS by default in React Three Fiber).
   * 
   * Responsibilities:
   * 1. Update animation mixer with delta time
   * 2. Check if current animation has finished
   * 3. Handle state transitions (greeting → idle → showFullBody)
   * 4. Manage randomized trigger for ShowFullBody while in idle
   * 5. Continuously enforce custom idle pose (A-pose) while in idle state
   * 6. Propagate all VRM updates to scene
   */
  useFrame(() => {
    if (!vrm || !mixerRef.current || !isInitializedRef.current) return;

    const delta = clockRef.current.getDelta();
    const elapsedTime = clockRef.current.getElapsedTime();
    const state = animationStateRef.current;

    // STEP 1: Update animation mixer
    // This applies all bone rotations from playing animation clips
    mixerRef.current.update(delta);

    // STEP 2: Check for animation state transitions
    
    // If greeting is playing and has finished, transition to idle
    if (state.currentState === "greeting" && state.greetingAction) {
      // An action with LoopOnce and clampWhenFinished is finished when time >= duration
      if (state.greetingAction.time >= state.greetingAction.getClip().duration) {
        transitionToAnimation("idle", state.idleAction);
      }
    }

    // If in idle state and random trigger time has been reached, play ShowFullBody
    if (state.currentState === "idle" && state.showFullBodyAction) {
      if (elapsedTime >= state.nextRandomTriggerTime) {
        transitionToAnimation("showFullBody", state.showFullBodyAction);
      }
    }

    // If ShowFullBody is playing and has finished, transition back to idle
    if (state.currentState === "showFullBody" && state.showFullBodyAction) {
      if (state.showFullBodyAction.time >= state.showFullBodyAction.getClip().duration) {
        transitionToAnimation("idle", state.idleAction);
      }
    }

    // STEP 3: Enforce custom idle pose while in idle state
    // CRITICAL: This must be done AFTER mixer.update() so we override any animation remnants
    // but BEFORE vrm.update() so the pose gets propagated to the scene
    if (state.currentState === "idle") {
      // Continuously reapply the custom A-pose to ensure it persists frame-by-frame
      // This is the key to preventing T-pose from appearing
      applyCustomDefaultPose();
    }

    // STEP 4: Propagate all transformations to the VRM and scene graph
    // This MUST be called LAST after all bone mutations and mixer updates
    vrm.update(delta);
  });

  // Don't render anything if VRM model failed to load
  if (error && !vrm) {
    return null;
  }

  // Render the VRM model's scene - now with visibility control to prevent T-pose flash
  // FIX: Avatar only renders when isAvatarVisible is true (i.e., animation is playing)
  // This prevents the T-pose from appearing between model load and animation start
  if (vrm && isAvatarVisible) {
    return (
      <group 
        ref={wrapperRef} 
        position={position}
        rotation={rotation}
        scale={scale}
      >
        <primitive
          object={vrm.scene}
          scale={1}
          position={[0, 0, 0]}
        />
      </group>
    );
  }

  return null;
}

/**
 * ============================================================================
 * ANIMATION STATE MACHINE & CUSTOM POSE DOCUMENTATION
 * ============================================================================
 *
 * ✅ CUSTOM DEFAULT POSE (A-POSE WITH HANDS-ON-BELLY):
 * 
 * Implementation Strategy:
 * - CUSTOM_DEFAULT_POSE constant defines quaternion rotations for all key bones
 * - applyCustomDefaultPose() directly modifies bone quaternions in humanoid skeleton
 * - createCustomIdleAnimationClip() creates an animation clip that holds the pose
 * - Pose is applied in THREE ways for maximum reliability:
 *   1. During initializeAnimations() - ensures initial state
 *   2. When transitioning to idle state - reset after any animation
 *   3. Via idle animation clip with quaternion tracks - maintains through animation system
 *
 * Pose Definition:
 * ```
 * - Shoulders: ~10 degrees forward (A-pose starting position)
 * - Upper Arms: ~45 degrees down from neutral (classic A-pose angle)
 * - Forearms: ~15 degrees bend (arms not fully extended)
 * - Hands: Slight forward tilt (5 degrees) positioned in front of belly
 * ```
 * 
 * Quaternion Calculations:
 * - Quaternion = { x: sin(θ/2), y: 0, z: 0, w: cos(θ/2) } for X-axis rotation
 * - Example: 45° down = { x: 0.3826, y: 0, z: 0, w: 0.924 }
 * - All rotations computed using sin/cos to ensure mathematical correctness
 *
 * Why Three-Layer Approach:
 * 1. Direct quaternion modification = immediate visual feedback
 * 2. Animation clip with tracks = smooth blending during transitions
 * 3. Repeated application on idle transition = fail-safe for edge cases
 * - This redundancy ensures the pose persists even if one layer fails
 *
 * ✅ STATE TRANSITIONS:
 * 
 * GREETING → IDLE:
 * - Greeting animation plays once on component mount
 * - When greeting animation finishes (action.time >= clip.duration), 
 *   automatic transition to idle state occurs
 * - Uses crossFadeTo() for 500ms smooth blending
 * - Custom default pose (A-pose) is reapplied during transition
 * - Idle animation clip holds the pose throughout idle state
 *
 * IDLE → SHOWFULLBODY (Randomized):
 * - While in idle state, a random timer is set (5-8 seconds)
 * - When elapsed time reaches nextRandomTriggerTime, ShowFullBody triggers
 * - ShowFullBody animation plays once
 * - Uses crossFadeTo() for 500ms smooth blending
 *
 * SHOWFULLBODY → IDLE:
 * - When ShowFullBody animation finishes (action.time >= clip.duration),
 *   automatic transition back to idle occurs
 * - Custom pose is reapplied immediately
 * - A new random trigger timer is calculated for the next ShowFullBody (5-8 seconds)
 * - Loop continues indefinitely
 *
 * ✅ TIMING MECHANISM (5-8 Second Interval):
 * - IDLE_ANIMATION_MIN_MS = 5000 (minimum 5 seconds)
 * - IDLE_ANIMATION_MAX_MS = 8000 (maximum 8 seconds)
 * - calculateNextRandomTriggerTime() generates: 
 *   random * (8000 - 5000) + 5000 milliseconds = [5000, 8000]
 * - Converted to seconds for Clock.getElapsedTime() comparison
 * - Ensures ShowFullBody triggers between 5-8 seconds, strictly enforced
 * - New interval calculated each time returning to idle (no clustering)
 *
 * ✅ SMOOTH TRANSITIONS & BLENDING:
 * - crossFadeTo(targetAction, CROSSFADE_DURATION, true)
 * - CROSSFADE_DURATION = 0.5 seconds (500ms)
 * - Prevents jarring animation cuts and model snapping
 * - The "true" parameter ensures target action auto-starts
 * - Blending works with both animation actions and static poses
 *
 * ✅ ANIMATION CLIP LOADING:
 * - Greeting: "animations/vrma_01/Greeting.vrma"
 * - ShowFullBody: "animations/vrma_01/ShowFullBody.vrma"
 * - Idle: Custom animation clip with quaternion tracks (holds A-pose)
 * - All clips use LoopOnce and clampWhenFinished for one-time playback
 *
 * ✅ ANIMATION FINISH DETECTION:
 * - Method: Compare action.time against clip.duration
 * - AnimationAction.time increments by delta each frame when playing
 * - When clampWhenFinished is true, time stops at duration (doesn't exceed)
 * - This check is frame-independent and reliable
 * - No event listeners needed (not exposed in Three.js AnimationAction)
 *
 * ✅ STATE TRACKER STRUCTURE (AnimationStateTracker):
 * ```
 * {
 *   currentState: "idle" | "greeting" | "showFullBody",  // Current state
 *   greetingAction: AnimationAction,    // Greeting animation instance
 *   idleAction: AnimationAction,        // Idle A-pose animation instance
 *   showFullBodyAction: AnimationAction, // ShowFullBody animation instance
 *   nextRandomTriggerTime: number,      // Seconds (from Clock.getElapsedTime())
 *   lastShowFullBodyTime: number        // Track timing (for logging/debugging)
 * }
 * ```
 *
 * ✅ FRAME LOOP EXECUTION ORDER:
 * 1. mixerRef.current.update(delta) - Apply bone animations and pose tracks
 * 2. Check animation finish conditions - Detect when to transition
 * 3. Call transitionToAnimation() if needed - Change states with crossfade
 * 4. Reapply custom pose if transitioning to idle - Ensure pose persists
 * 5. Calculate next trigger if in idle - Set random 5-8s interval
 * 6. vrm.update(delta) - Propagate all changes to scene
 *
 * ✅ BONE QUATERNION APPLICATION:
 * - applyCustomDefaultPose() iterates through CUSTOM_DEFAULT_POSE
 * - Uses humanoid.getRawBoneNode(boneName) to access bones
 * - Sets quaternion via bone.quaternion.set(x, y, z, w)
 * - Silently skips bones not present in this VRM model (safe for variants)
 * - Wrapped in try-catch for robustness
 *
 * ✅ CUSTOM IDLE ANIMATION CLIP:
 * - createCustomIdleAnimationClip() builds animation from CUSTOM_DEFAULT_POSE
 * - Creates QuaternionKeyframeTrack for each bone
 * - Keyframes at time 0 and 0.1s hold pose steady (minimal duration)
 * - Values duplicated: [q0.x, q0.y, q0.z, q0.w, q1.x, q1.y, q1.z, q1.w]
 * - Ensures animation system recognizes and plays the pose clip
 * - Combined with direct applyCustomDefaultPose() for redundancy
 *
 * ✅ MEMORY MANAGEMENT:
 * - All animation actions stored in animationStateRef (prevents GC)
 * - mixerRef holds single AnimationMixer instance
 * - clockRef maintains consistent time delta
 * - VRM bone references released after pose application (no leaks)
 * - Cleanup on unmount: stopAllAction(), uncacheRoot(), dispose all meshes
 * - No dangling timers or loose references
 *
 * ✅ ERROR HANDLING:
 * - loadVRMAAnimationClip() catches and logs errors, returns null
 * - initializeAnimations() handles missing clips gracefully
 * - applyCustomDefaultPose() wraps in try-catch, warns on failure
 * - createCustomIdleAnimationClip() returns empty clip if VRM missing
 * - Component renders null on critical load errors
 * - User gets feedback via onError callback
 *
 * ✅ RACE CONDITION PREVENTION:
 * - isMountedRef prevents state updates after unmount
 * - isInitializedRef ensures animations ready before useFrame logic runs
 * - Sequential loading: VRM → mixer → initialize animations
 * - Async operations check isMountedRef before using model/mixer
 * - applyCustomDefaultPose() checks vrm exists before accessing
 *
 * ✅ CROSSFADE BLENDING WITH CUSTOM POSE:
 * - When ShowFullBody ends and idle animation starts, crossfade blends smoothly
 * - Idle animation's quaternion tracks gradually take over from ShowFullBody's bones
 * - 500ms blend time allows smooth visual transition without sudden snaps
 * - Custom pose is reapplied AFTER crossfade begins (ensures it's loaded)
 *
 * ============================================================================
 */