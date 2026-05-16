# AI NAGARI System Component Registry

This document serves as the **central, authoritative registry** for all system components, algorithms, and significant features. Every component must have a corresponding entry below. Any update to component logic MUST be accompanied by an update to this registry.

---

## Frontend Components

### GridFloor
**File:** `frontend/components/grid-floor.tsx`
**Internal Dependencies:** `three`, `react`

**Purpose:** Renders a perspective grid floor plane to establish spatial depth and ground reference in the 3D scene. Provides visual grounding for the VRM character model.

**Process Flow:**
1. Accepts configuration props: `size`, `divisions`, `opacity`
2. Creates a Three.js GridHelper with primary and secondary grid lines
3. Sets initial position at y=0 (ground plane)
4. Applies transparency and opacity settings
5. Exposes the grid as a Three.js primitive to the React Three Fiber scene
6. Updates material opacity on mount to ensure visual depth effect

**Key Features:**
- Grid lines fade with distance for visual depth
- Configurable grid density and size
- Transparent rendering for seamless background integration

---

### Scene3D
**File:** `frontend/components/scene-3d.tsx`
**Internal Dependencies:** `@react-three/drei`, `@react-three/fiber`, `react`, GridFloor, VrmModel

**Purpose:** Orchestrates the complete 3D scene including camera positioning, lighting, controls, and grid floor. Manages viewport framing to keep the character model centered and in-view at all times.

**Process Flow:**
1. Sets up PerspectiveCamera at position [0, 1.2, 3] with FOV=40 for full-body visibility
2. Initializes OrbitControls with:
   - Pan enabled for free movement
   - Zoom enabled with distance constraints (2-6 units)
   - Target focused at [0, 0.8, 0] (character eye level)
   - No rotation angle restrictions for unrestricted free movement
3. Applies four-light anime-friendly lighting setup:
   - Ambient light: base visibility (0.7 intensity)
   - Key light: front-right directional (0.9 intensity, warm tone)
   - Fill light: left side directional (0.5 intensity, cool tone)
   - Rim light: back directional (0.4 intensity) + bottom fill (0.2 intensity)
4. Renders GridFloor component at ground level
5. Renders VrmModel with callbacks for load/error states

**Key Features:**
- Adaptive camera framing maintains model in center of viewport
- Unrestricted rotation allows full 360° viewing
- Balanced multi-light setup prevents harsh shadows
- Separates scene orchestration from individual component concerns

---

### VrmModel
**File:** `frontend/components/vrm-model.tsx`
**Internal Dependencies:** `@react-three/fiber`, `three`, `@pixiv/three-vrm`, VrmBlendShapeController, VrmAnimationController

**Purpose:** Loads and renders a VRM 3D character model with animations and facial expressions. Orchestrates animation mixer, blinking, and body animations within the render loop.

**Process Flow:**
1. Initialize GLTFLoader with VRMLoaderPlugin on component mount
2. Load VRM file from provided URL
3. Extract VRM data from gltf.userData and initialize animation mixer
4. Register embedded animations with VrmAnimationController
5. Initialize VrmBlendShapeController for blinking
6. **Animation Loop (useFrame):**
   - Call vrm.update(delta) to apply bone transformations
   - Update blinking via VrmBlendShapeController.update(currentTime)
   - Update body animations via mixer.update(delta)
   - Apply subtle chest breathing for natural idle movement
7. **Cleanup (useEffect return):** Dispose all geometry/materials and stop all animations

**Key Features:**
- Automatic idle animation on model load
- Natural blinking with randomized intervals (2-5 seconds)
- Chest breathing animation for liveliness
- Full animation mixer support for body movements
- Robust resource cleanup prevents memory leaks

**Character Positioning:**
- Scale: 1.0 (no artificial scaling)
- Position: [0, 0, 0] (centered at origin)
- Y-position remains stable (no vertical bobbing)

---

## Animation & Facial Expression Utilities

### VrmBlendShapeController
**File:** `frontend/utils/vrm-blendshape-controller.ts`
**Internal Dependencies:** `@pixiv/three-vrm`, `three`

**Purpose:** Manages VRM BlendShapes (facial expressions) including automated natural blinking at realistic intervals.

**Process Flow:**
1. Accept VRM instance and optional blink configuration (minInterval, maxInterval, blinkDuration)
2. **Blink Scheduling:**
   - Calculate random interval between minInterval and maxInterval (default: 2-5 seconds)
   - Store next blink trigger time
3. **Blink Update (call every frame):**
   - Check if current time exceeds nextBlinkTime
   - If yes, start blink animation
   - Calculate progress (0→1) across blinkDuration
   - Apply bell-curve weight: `sin(progress * π)` for smooth eye closing/opening
   - Reset expression and reschedule when complete
4. **Expression API:**
   - `setExpression(name, value)`: Set specific expression (e.g., "happy", "sad")
   - `getExpression(name)`: Query current expression value
   - `resetExpressions()`: Zero all active expressions

**Configuration:**
```typescript
{
  minInterval: 2,      // Minimum seconds between blinks
  maxInterval: 5,      // Maximum seconds between blinks
  blinkDuration: 0.15, // Blink animation duration in seconds
}
```

**Key Features:**
- Natural blinking with randomized intervals
- Bell-curve animation for realistic eye motion
- Support for all VRM expression presets
- Thread-safe state management

---

### VrmAnimationController
**File:** `frontend/utils/vrm-animation-controller.ts`
**Internal Dependencies:** `three`, `@react-three/fiber`

**Purpose:** Manages playing, blending, and transitioning between body animations (idle, walk, custom). Supports both embedded animations from GLTF and external animation loading.

**Process Flow:**
1. Initialize with THREE.AnimationMixer instance
2. **Animation Registration:**
   - Register all GLTF animation clips via `registerAnimations(clips)`
   - Store clips in internal map for quick lookup
3. **Animation Playback:**
   - `playAnimation(name, loop, transitionDuration)` creates action, applies fade-in
   - `transitionToState(state, duration)` switches between predefined states (idle, walk, none)
   - Automatically stops previous animations on state change
4. **State Management:**
   - Track current animation state (idle, walk, none)
   - Support smooth crossfading between animations
   - Prevent animation conflicts via `mixer.stopAllAction()`
5. **API Methods:**
   - `getAvailableAnimations()`: List all registered animation names
   - `hasAnimation(name)`: Check if animation exists
   - `getCurrentState()`: Get active animation state
   - `getMixer()`: Access mixer for advanced control

**Supported States:**
- `"idle"`: Default looping animation with breathing
- `"walk"`: Locomotion animation (if available)
- `"none"`: Stop all animations

**Key Features:**
- Smooth animation transitions with configurable crossfading
- Support for both embedded and external animations
- Flexible state system for future gesture/expression animations
- Safe mixer cleanup integration

---

### CharacterShowcase
**File:** `frontend/components/character-showcase.tsx`
**Internal Dependencies:** `@react-three/fiber`, `react`, Scene3D, ModelLoader

**Purpose:** Provides the main display container for the 3D character model. Manages canvas rendering, loading states, error handling, and placeholder UI.

**Process Flow:**
1. Initialize modelStatus state: "loading" → "loaded" or "error"
2. **On Load:**
   - Set status to "loaded"
   - Render fully functional Canvas with Scene3D
   - Display status badge: "NARAGI • 3D Model Active"
3. **On Error:**
   - Set status to "error"
   - Render PlaceholderCharacter silhouette
   - Show instructions for VRM file placement
4. **During Loading:**
   - Display ModelLoader spinner
   - Show status badge: "NARAGI • Stage Ready"

**Layout Structure:**
- Main container: `flex-1` (fills available center space)
- Background: `#FCFCFC` with padding
- Canvas container: Full height/width with rounded corners and shadow
- Radial gradient backdrop for depth perception
- Status badge: Centered at bottom with backdrop blur

**Key Features:**
- Seamless loading state transitions
- Graceful error handling with user-friendly placeholder
- Canvas expands to fill available center viewport space
- Maintains consistent visual hierarchy with sidebar and chat panel

---

## Camera & Viewport Management

### Camera Configuration
- **Position:** [0, 1.2, 3] (slightly elevated, 3 units back)
- **FOV:** 40° (wide enough for full-body character at reasonable distance)
- **Near Plane:** 0.1 (close objects visible)
- **Far Plane:** 100 (distant background visible)
- **Aspect Ratio:** Auto-calculated by Three.js

### Control Constraints
- **Pan:** Enabled - allows free movement through scene
- **Zoom:** Limited to 2-6 units distance (prevents clipping/too-far viewing)
- **Rotation:** Unrestricted (full 360° rotation around target)
- **Target:** [0, 0.8, 0] (character eye level, provides natural framing)

### Viewport Containment Strategy
1. **Camera Framing:** FOV and distance settings keep character centered
2. **Control Limits:** Min/max distance prevents model from leaving visible area
3. **Grid Reference:** Floor at y=0 establishes spatial bounds
4. **Natural Boundaries:** Subtle visual depth from lighting prevents model from feeling "lost"

---

## Styling & Visual Design

### Container Styling
- **Background:** White (`bg-white`) with soft shadow
- **Border Radius:** `rounded-2xl` (modern, less severe than previous `rounded-[32px]`)
- **Shadow:** Dual-layer shadow with purple tint for depth
- **Overflow:** Hidden (clips content to rounded container)

### Grid Styling
- **Primary Lines:** `#888888` (medium gray)
- **Secondary Lines:** `#cccccc` (light gray)
- **Opacity:** 0.35 (subtle, doesn't dominate scene)
- **Size:** 12 units × 12 units
- **Divisions:** 24 (provides fine-grain reference grid)

### Lighting & Atmosphere
- **Ambient:** `#ffffff` at 0.7 intensity (soft base illumination)
- **Key Light:** `#fff5f0` (warm tone, natural skin tones)
- **Fill Light:** `#f0f5ff` (cool tone, balances shadows)
- **Rim Light:** `#e8e0ff` (purple tint for character edge definition)
- **Bottom Fill:** `#ffffff` (reduces harsh shadows under chin)

---

## Integration Points

### Frontend Data Flow
```
AppLayout
  ├── Sidebar (Navigation)
  ├── CharacterShowcase (3D Viewport)
  │   └── Canvas
  │       └── Scene3D (Orchestrator)
  │           ├── PerspectiveCamera
  │           ├── OrbitControls
  │           ├── Lighting (4 DirectionalLights + AmbientLight)
  │           ├── GridFloor (Ground Plane)
  │           └── VrmModel (Character)
  └── ChatPanel (Conversation Interface)
```

### Props & Callbacks
- `CharacterShowcase`: Manages model load/error states internally
- `Scene3D`: Receives `modelUrl`, `onModelLoad`, `onModelError` callbacks
- `VrmModel`: Receives `url`, `onLoad`, `onError` callbacks
- `GridFloor`: Receives configuration props with sensible defaults

---

## Performance Considerations

### Optimization Strategies
1. **Geometry Caching:** VRM geometry loaded once, reused across frames
2. **Animation Optimization:** Idle animation uses low-frequency sine waves (1.5Hz breathing)
3. **Material Reuse:** Grid uses single material instance
4. **Framebuffer:** Canvas preserves drawing buffer for screenshot capability

### Resource Management
- **Texture Disposal:** All VRM textures disposed on unmount
- **Geometry Disposal:** All mesh geometries freed on component cleanup
- **Animation Mixer:** Cleaned up with component lifecycle
- **Event Listeners:** OrbitControls automatically unbind on Canvas dispose

---

## Animation Integration & Loading Strategies

### Embedded Animations (Recommended)
If your VRM model includes embedded animations (e.g., from Mixamo or VRoid Studio):

```typescript
// Automatically registered in VrmModel on load
// Animations appear in gltf.animations array
const animationController = new VrmAnimationController(mixer);
animationController.registerAnimations(gltf.animations);
animationController.transitionToState("idle", 0.5); // Play idle immediately
```

### External Animation Loading (Advanced)
For loading animations from external `.glb` files:

```typescript
// Load animation file separately
const animLoader = new GLTFLoader();
animLoader.load("/animations/walk.glb", (gltf) => {
  const animationController = new VrmAnimationController(mixer);
  animationController.registerAnimations(gltf.animations);
  animationController.playAnimation("walk", THREE.LoopRepeat, 0.5);
});
```

### Animation Naming Convention
- Animations should be named in lowercase: `idle`, `walk`, `run`, `jump`
- VrmAnimationController automatically normalizes names to lowercase
- Common VRM animation names from Mixamo: `Idle`, `Walk`, `Run`, `Jump`

---

## Blending & Expression System

### Natural Blinking Setup
Blinking is automatically managed but can be customized:

```typescript
// Custom blink intervals (in VrmModel initialization)
const blinkController = new VrmBlendShapeController(vrm, {
  minInterval: 1.5,      // More frequent blinking
  maxInterval: 4,
  blinkDuration: 0.2,    // Slightly slower blink
});
```

### Expression Presets (VRM Standard)
Common VRM expression presets:
- `"blink"`: Eye closing (automated)
- `"blinkLeft"`, `"blinkRight"`: Individual eye blinks
- `"lookUp"`, `"lookDown"`, `"lookLeft"`, `"lookRight"`: Eye gaze
- `"happy"`, `"sad"`, `"angry"`, `"surprised"`: Emotions
- `"relaxed"`, `"neutral"`: Neutral expressions

Usage:
```typescript
blendShapeController.setExpression("happy", 0.8); // 80% happy
blendShapeController.setExpression("happy", 0);   // Reset to neutral
```

---

## Render Loop Integration

The animation system is fully integrated into React Three Fiber's render loop via `useFrame`:

```typescript
useFrame((state, delta) => {
  // 1. Update VRM bone structure
  vrm.update(delta);

  // 2. Update blinking (blendshapes)
  blendShapeController?.update(Date.now() / 1000);

  // 3. Update body animations (mixer)
  mixer?.update(delta);

  // 4. Apply supplementary effects (breathing, head tilt)
  // ... subtle animations ...
});
```

**Timing Notes:**
- `delta`: Frame delta time in seconds (passed by React Three Fiber)
- `Date.now() / 1000`: Absolute time in seconds for blinking scheduler
- All three updates must occur in sequence for correct animation layering

---

## Future Enhancement Points

1. ✅ **Animation System:** VrmAnimationController supports idle/walk playback and state transitions
2. ✅ **Facial Expressions:** VrmBlendShapeController enables natural blinking and emotion presets
3. **Gesture Triggering:** Can bind UI events to trigger animations (e.g., button click → wave gesture)
4. **Emotion System:** Can drive expressions from LLM sentiment analysis (happy on positive message, confused on question)
5. **Head Tracking:** Can add head gaze animations based on mouse/camera position
6. **Lip Sync:** Can sync facial animation to speech synthesis output
7. **Scene Background:** Can swap transparent background for environment map/360° scene
8. **Post-Processing:** Can integrate EffectComposer for glow, bloom, or depth-of-field effects
9. **Mobile Responsiveness:** Touch controls for orbit/zoom can be easily added via OrbitControls

---

**Last Updated:** May 15, 2026  
**Maintainer:** AI NAGARI Development Team  
**Compliance:** Adheres to rules.md - Senior Development Standards
