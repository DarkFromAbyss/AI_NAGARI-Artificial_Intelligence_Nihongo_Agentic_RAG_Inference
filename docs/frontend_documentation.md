# AI NARAGI Frontend Documentation

## Table of Contents
1. [Project Overview](#project-overview)
2. [Setup and Installation Guide](#setup-and-installation-guide)
3. [Directory Structure](#directory-structure)
4. [Component Breakdown & Functionality](#component-breakdown--functionality)
5. [Hooks & Utilities](#hooks--utilities)
6. [Styling & Theme System](#styling--theme-system)
7. [3D Rendering Architecture](#3d-rendering-architecture)

---

## Project Overview

### Introduction

AI NARAGI is a sophisticated, interactive Japanese language learning assistant featuring a modern web-based frontend built with **Next.js**, **React 19**, and **Three.js**. The frontend integrates 3D avatar rendering with real-time chat capabilities to create an immersive educational experience.

### Core Technology Stack

- **Framework:** Next.js 16.2.4 (React 19, TypeScript)
- **3D Rendering:** Three.js 0.184.0, @react-three/fiber 9.6.1, @react-three/drei 10.7.7
- **3D Avatar:** @pixiv/three-vrm 3.5.2 (VRM format support)
- **Styling:** Tailwind CSS 4.2.0, custom CSS animations
- **UI Components:** Radix UI (comprehensive primitive component library)
- **Form Management:** React Hook Form 7.54.1
- **Theming:** next-themes 0.4.6 with custom theme context
- **Animations:** Custom CSS animations with Tailwind CSS Animate plugin
- **Analytics:** Vercel Analytics (production only)

### Architecture Highlights

- **Client-Side Rendering:** "use client" directive throughout for interactive features
- **Responsive Layout:** Three-column layout (Sidebar | Character Showcase | Chat Panel)
- **Theme Support:** Dual theme system (Light mode & Soft Anime mode) with localStorage persistence
- **WebGL Canvas:** High-performance 3D rendering with optimized lighting and camera controls
- **Real-Time Chat:** Message-based interaction with simulated AI responses
- **Modular Components:** Reusable, composable React components with TypeScript support

---

## Setup and Installation Guide

### Prerequisites

Before setting up the AI NARAGI frontend, ensure you have the following installed:

- **Node.js:** Version 18.x or higher (LTS recommended)
- **Package Manager:** npm 9.x+ or pnpm 8.x+ (pnpm is used in this project as indicated by pnpm-lock.yaml)
- **Git:** For version control
- **Web Browser:** Modern browser with WebGL support (Chrome, Firefox, Safari, Edge)

### Installation Steps

#### 1. Clone or Navigate to the Frontend Directory

```bash
cd frontend
```

#### 2. Install Dependencies

Using pnpm (recommended):
```bash
pnpm install
```

Alternatively, using npm:
```bash
npm install
```

Or using yarn:
```bash
yarn install
```

#### 3. Asset Management

##### VRM Model Placement

The 3D avatar model must be placed in the `public` folder with the following structure:

```
frontend/
├── public/
│   ├── AvatarSample_A.vrm       ← Place your VRM model file here
│   ├── icon.svg
│   ├── icon-light-32x32.png
│   ├── icon-dark-32x32.png
│   └── apple-icon.png
└── ...
```

**Note:** The VRM model is critical for proper functionality. Ensure the file path in your code matches the asset location.

**Supported Format:** Virtual Reality Modeling (VRM 0.0 and later)

### Running the Application

#### Development Server

Start the local development server:

```bash
pnpm run dev
```

Or with npm:
```bash
npm run dev
```

The application will typically be available at:
```
http://localhost:3000
```

Open this URL in your web browser to view the AI NARAGI interface.

#### Production Build

To build for production:

```bash
pnpm run build
```

Start the production server:

```bash
pnpm start
```

#### Linting

To lint the codebase:

```bash
pnpm run lint
```

### Environment Configuration

Create a `.env.local` file in the `frontend` directory if needed:

```env
# Example environment variables (if applicable)
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Directory Structure

### Visual Tree

```
frontend/
│
├── app/                          # Next.js App Router directory
│   ├── layout.tsx                # Root layout with ThemeProvider setup
│   ├── page.tsx                  # Home page component
│   ├── globals.css               # Global styles and CSS custom properties
│   └── (other app files)
│
├── components/                   # React components directory
│   ├── app-layout.tsx            # Main application layout wrapper
│   ├── animated-greeting.tsx     # Animated greeting with language toggle
│   ├── character-showcase.tsx    # 3D canvas container with VRM rendering
│   ├── chat-panel.tsx            # Chat interface with message display
│   ├── model-loader.tsx          # Loading spinner for VRM model
│   ├── sidebar.tsx               # Navigation sidebar with theme toggle
│   ├── theme-provider.tsx        # Theme context provider wrapper
│   ├── vrm-model.tsx             # VRM model loader and animator
│   └── ui/                       # Radix UI component library
│       ├── button.tsx
│       ├── (other UI primitives)
│
├── hooks/                        # Custom React hooks
│   ├── use-theme.tsx             # Theme context hook and provider
│   ├── use-mobile.ts             # Mobile breakpoint detection hook
│   └── use-toast.ts              # Toast notification hook (Sonner)
│
├── lib/                          # Utility functions
│   └── utils.ts                  # Classname merging utility (cn)
│
├── styles/                       # Additional stylesheet directory
│   └── globals.css               # Global style imports
│
├── public/                       # Static assets
│   ├── AvatarSample_A.vrm        # VRM 3D avatar model
│   ├── icon.svg
│   ├── icon-light-32x32.png
│   ├── icon-dark-32x32.png
│   └── apple-icon.png
│
├── .next/                        # Next.js build output (auto-generated)
├── node_modules/                 # Dependencies (auto-generated)
│
├── next.config.mjs               # Next.js configuration
├── tsconfig.json                 # TypeScript configuration
├── tailwind.config.js            # Tailwind CSS configuration
├── postcss.config.mjs            # PostCSS configuration
├── components.json               # Shadcn/ui components configuration
│
├── package.json                  # Project dependencies and scripts
├── pnpm-lock.yaml                # pnpm lock file
│
└── README.md                     # Project readme

```

---

## Component Breakdown & Functionality

### Layout Components

#### `app/layout.tsx` - Root Layout

**Purpose:**
The root layout component wraps the entire application with critical metadata and context providers. It sets up the HTML document structure, applies metadata for SEO, configures icons, and initializes the theme system.

**Key Logic:**
- Imports Google fonts (Geist, Geist Mono) for typography
- Wraps application with `ThemeProvider` context
- Sets up metadata including title, description, and favicon configuration
- Conditionally loads Vercel Analytics in production
- Applies global background and text styling

**Dependencies:**
- `next/font/google` - Font imports
- `@vercel/analytics/next` - Analytics integration
- `ThemeProvider` - Custom theme context

**Code Structure:**
```typescript
- Metadata configuration with icon variants
- ThemeProvider wrapper for global theme state
- Conditional production analytics
```

---

#### `app/page.tsx` - Home Page

**Purpose:**
Minimal home page component that serves as the entry point for the application. It renders the main application layout.

**Key Logic:**
- Simple wrapper that delegates to `AppLayout` component
- Uses "use client" directive for client-side rendering

**Dependencies:**
- `AppLayout` component

---

#### `components/app-layout.tsx` - Main Application Layout

**Purpose:**
Core layout component that establishes the three-column structure of the AI NARAGI interface: navigation sidebar, 3D character showcase, and chat panel.

**Key Logic:**
- Uses flexbox layout with `flex h-screen w-full` for full viewport coverage
- Divides screen into three sections with specific roles
- "use client" directive enables client-side state management

**Layout Structure:**
1. **Left Column:** Sidebar (fixed width 250px)
2. **Center Column:** CharacterShowcase (flex-1, responsive)
3. **Right Column:** ChatPanel (fixed width with clamp)

**Dependencies:**
- `Sidebar` component
- `CharacterShowcase` component
- `ChatPanel` component

---

### Sidebar Component

#### `components/sidebar.tsx` - Navigation Sidebar

**Purpose:**
Left-side navigation panel featuring the application logo, main menu items, and settings controls. Provides access to different learning modes (Brain, Voice, Quiz, Vocab) and includes a theme toggle.

**Key Features:**
- Logo section with star icon and NARAGI branding
- Four main menu items representing learning modules
- Theme toggle button (Light/Soft Anime)
- Settings menu item
- Custom SVG icons for each menu option
- Responsive styling with hover effects

**Menu Items:**
1. **Brain** - Language model/AI interactions
2. **Voice** - Voice-based learning or TTS features
3. **Quiz** - Interactive quizzes
4. **Vocab** - Vocabulary practice

**Key Logic:**
- Uses `useTheme()` hook to get current theme and toggle function
- Theme icon changes based on current theme (Sun for light, Moon for anime)
- Menu items are styled with dynamic active states
- Implements smooth transitions on theme changes

**Dependencies:**
- `useTheme` hook - Theme management
- `cn` utility - Classname merging
- Radix UI `Button` component

**Custom Icons:**
- `StarIcon` - Logo icon
- `BrainIcon` - Brain mode
- `VoiceIcon` - Voice mode
- `QuizIcon` - Quiz mode
- `VocabIcon` - Vocabulary mode
- `ThemeIcon` - Theme toggle (conditional rendering)
- `SettingIcon` - Settings

---

### Character Showcase Component

#### `components/character-showcase.tsx` - 3D Avatar Display

**Purpose:**
Central component that renders the 3D VRM avatar in a high-performance WebGL canvas. Manages model loading states, provides interactive orbit controls, and implements professional lighting for anime-style rendering.

**Key Features:**
- Three.js Canvas with optimized settings
- Responsive camera with PerspectiveCamera
- OrbitControls for interactive model rotation/zoom
- Professional multi-light setup (ambient, directional, rim lights)
- Loading spinner animation
- Placeholder silhouette for missing models
- Corner frame decorations
- Status badge showing model state
- Radial gradient glow background

**Lighting Setup (SceneLighting):**
- **Ambient Light** (0.6 intensity) - Base visibility
- **Main Key Light** (front-right, 0.8 intensity) - Primary illumination with warm color
- **Fill Light** (left side, 0.4 intensity) - Soft side lighting
- **Rim Light** (back, 0.3 intensity) - Anime-style edge highlights
- **Bottom Fill Light** (0.15 intensity) - Reduces harsh shadows

**Canvas Configuration:**
```typescript
gl={{
  antialias: true,      // Smooth edges
  alpha: true,          // Transparent background
  preserveDrawingBuffer: true
}}
```

**Camera Setup:**
- Position: [0, 0.3, 2.2]
- FOV: 35° (slightly narrow for portrait framing)
- Near plane: 0.1, Far plane: 100

**OrbitControls Configuration:**
- Pan disabled (user cannot translate model)
- Zoom enabled (1.5x to 4x range)
- Limited vertical rotation (π/4 to π/1.8)
- Limited horizontal rotation (±π/4)
- Target focus: [0, 0.2, 0] (roughly neck height)

**Model States:**
1. **Loading** - Shows ModelLoader spinner
2. **Loaded** - Displays VRM model with status badge
3. **Error** - Shows placeholder anime silhouette

**PlaceholderCharacter Component:**
Custom SVG silhouette of an anime character with gradient fill and glow effect, displayed when VRM fails to load.

**Dependencies:**
- `@react-three/fiber` - Canvas and render loop
- `@react-three/drei` - OrbitControls, PerspectiveCamera
- `VrmModel` component - Avatar renderer
- `ModelLoader` component - Loading UI
- Three.js libraries

---

### Chat Panel Component

#### `components/chat-panel.tsx` - Chat Interface

**Purpose:**
Right-side chat panel enabling real-time conversation with the AI NARAGI assistant. Features message history, animated greeting display, and a text input with send functionality.

**Key Features:**
- Professional chat interface styling
- Message history with user/assistant distinction
- Animated greeting display on initial load
- Real-time message send and receive simulation
- User profile icon in header
- Online status indicator
- Responsive message layout
- Smooth transitions and animations

**Message Structure:**
```typescript
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}
```

**Chat Flow:**
1. Display `AnimatedGreeting` on initial page load
2. User types message and presses send
3. Message added to history with role "user"
4. Greeting hidden
5. Simulated AI response appears after 800ms delay

**UI Components:**
- **UserIcon** - Custom SVG for user avatar
- **SendIcon** - Paper plane icon for send button
- **ChatMessage** - Individual message renderer with role styling
- **Header** - Shows NARAGI name, online status, user profile
- **Input Area** - Glassmorphism input field with send button

**Input Validation:**
- Send button disabled when input is empty or whitespace-only
- Submit handler prevents empty messages

**Styling Notes:**
- Assistant messages have subtle background fill
- User messages align right
- Role labels use uppercase, small typography
- Input uses backdrop blur for glassmorphic effect

**Dependencies:**
- `AnimatedGreeting` component
- `Button` UI component
- `cn` utility function
- React hooks (useState)

---

### Chat Message Sub-Component

#### `ChatMessage` - Individual Message Display

**Purpose:**
Renders a single message with appropriate styling based on sender role.

**Features:**
- Role indicator (You / NARAGI)
- Message content with proper text direction
- Different styling for user vs assistant messages
- Accessible ARIA labels

**Styling:**
- **User Messages:** Right-aligned, primary text color
- **Assistant Messages:** Left-aligned with subtle background, muted accent color

---

### Animated Greeting Component

#### `components/animated-greeting.tsx` - Multilingual Greeting Animation

**Purpose:**
Displays an animated, character-by-character greeting in multiple languages (English and Japanese). Creates a wave-in/wave-out animation effect with automatic language switching.

**Key Features:**
- Bilingual greeting content (English and Japanese)
- Character-level animation sequencing
- Three-phase display cycle: visible → hiding → showing
- Language indicator dots
- Automatic rotation every 3 seconds
- Smooth CSS transitions with staggered timing

**Greeting Content:**
```
English: "Hello, nice to meet you, I am AI NARAGI, a Japanese teacher, let's talk!"
Japanese: "こんにちは、はじめまして。私は日本語教師のAI NARAGIです。一緒にお話ししましょう！"
```

**Animation Phases:**
1. **Visible** (3000ms) - Full display
2. **Hiding** (800ms) - Wave-out animation with per-character delay
3. **Showing** (800ms) - Wave-in animation
4. Loop back to visible

**Animation Details:**
- Each character has `animationDelay` = `index * 15ms`
- Wave-out uses `animate-wave-out` class
- Wave-in uses `animate-wave-in` class
- Opacity transitions synchronized with animation phase

**Language Indicator:**
- Dot display below text
- Active language has wider (w-4) indicator
- Inactive languages show small circular dots
- Smooth color transitions

**Accessibility:**
- Uses `aria-live="polite"` for screen reader announcements
- `lang` attribute matches current language

**Dependencies:**
- Custom CSS animations (wave-out, wave-in)
- `cn` utility function
- React hooks (useState, useEffect)

---

### VRM Model Component

#### `components/vrm-model.tsx` - 3D Avatar Loader and Animator

**Purpose:**
Loads and renders VRM (Virtual Reality Modeling) format 3D avatars. Manages model lifecycle, applies idle animations, and handles error states. Integrates with @pixiv/three-vrm library for VRM-specific features.

**Key Functionality:**
- Loads VRM files from specified URL
- Registers VRM loader plugin with GLTFLoader
- Applies rotation to face camera (π radians rotation on Y-axis)
- Implements idle animation with subtle breathing and head movements
- Proper resource cleanup on unmount
- Error handling and callback system

**Model Loading Flow:**
```
1. Create GLTFLoader instance
2. Register VRMLoaderPlugin
3. Load VRM file from URL
4. Extract VRM data from gltf.userData.vrm
5. Apply orientation rotation
6. Create AnimationMixer for potential animations
7. Call onLoad callback on success
8. Call onError callback on failure
```

**Idle Animation System:**
```javascript
- Gentle breathing motion: Y position oscillates with Math.sin(time * 1.5) * 0.01
- Subtle head sway: Head rotates on Y-axis with Math.sin(time * 0.5) * 0.02
- Head tilt: Head rotates on Z-axis with Math.sin(time * 0.3) * 0.01
- Creates lifelike subtle movement at rest
```

**Animation Mixer:**
- Optional AnimationMixer created for future animation playback
- Supports VRM animations if present in model file
- Updates on each frame via useFrame

**VRM Update Process:**
- Calls `vrm.update(delta)` each frame
- Updates VRM-specific blendshapes and humanoid bones
- Manages animation playback

**Resource Management:**
- Cleanup function disposes geometries and materials on unmount
- Prevents memory leaks from WebGL resources
- Traverses scene tree to find all meshes

**Props:**
```typescript
interface VrmModelProps {
  url: string;              // Path to VRM file
  onError?: () => void;     // Error callback
  onLoad?: () => void;      // Success callback
}
```

**Dependencies:**
- `@pixiv/three-vrm` - VRM format support
- `three` - Three.js core (GLTFLoader, AnimationMixer)
- `@react-three/fiber` - useFrame hook for render loop
- React hooks (useEffect, useState, useRef)

---

### Model Loader Component

#### `components/model-loader.tsx` - Loading Indicator

**Purpose:**
Displays an animated loading spinner while the VRM model is being fetched and processed. Provides visual feedback to users during model initialization.

**Key Features:**
- Stylized loading silhouette with glow effect
- Rotating gradient ring animation (3-second duration)
- Inner anime character silhouette icon
- Animated dots for visual emphasis
- Loading text with descriptive message
- Radial gradient background glow

**Visual Elements:**
1. **Outer Glow Ring** - Pulsing radial gradient
2. **Rotating Circle** - Animated SVG with gradient stroke
3. **Inner Silhouette** - Simplified anime character shape
4. **Animated Dots** - Three bouncing indicators with staggered timing
5. **Text Labels** - "Loading Avatar" and "Preparing 3D model..."

**Animation Details:**
- Outer ring: `animate-pulse`
- Rotating SVG: `animate-spin` with 3s duration
- Dot bouncing: `animate-bounce` with `animationDelay` = `index * 0.15s`

**Positioning:**
- Absolute positioning within canvas container
- Centered using flex layout
- Z-index 10 (above canvas)

**Dependencies:**
- `cn` utility function
- Tailwind CSS animations

---

### Theme Provider Component

#### `components/theme-provider.tsx` - Theme Context Setup

**Purpose:**
Wrapper component for next-themes library integration. Provides theme switching capability throughout the application.

**Key Logic:**
- Wraps application with NextThemesProvider
- Passes through theme provider props
- Enables theme persistence and system preference detection

**Dependencies:**
- `next-themes` - Theme management library
- React

---

### Custom Hooks

#### `hooks/use-theme.tsx` - Theme Management Hook

**Purpose:**
Custom React context hook for managing application theme state (Light mode vs Soft Anime mode). Persists user preference to localStorage and updates DOM attributes.

**Features:**
- Dual theme system: "light" | "soft-anime"
- localStorage persistence with "naragi-theme" key
- DOM attribute synchronization (data-theme)
- Theme toggle and setter functions
- Automatic theme restoration on page load

**Context Type:**
```typescript
interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}
```

**Theme Application:**
- Sets `data-theme` attribute on document root
- Used in CSS to switch variable values
- Enables instant theme switching without page reload

**Initialization:**
- Checks localStorage for saved preference
- Validates theme value
- Falls back to default if not found
- Applies theme on component mount

**Usage in Components:**
```typescript
const { theme, toggleTheme, setTheme } = useTheme();
```

---

#### `hooks/use-mobile.ts` - Mobile Breakpoint Detection

**Purpose:**
Detects whether the application is running on a mobile device by monitoring viewport width against the 768px breakpoint.

**Key Logic:**
- Uses `window.matchMedia` for responsive design detection
- Listens for breakpoint changes
- Sets initial state on mount
- Cleans up event listeners on unmount

**Breakpoint:**
- Mobile: < 768px
- Desktop: ≥ 768px

**Return Value:**
```typescript
boolean | undefined
```

---

### Utilities

#### `lib/utils.ts` - Classname Merging Utility

**Purpose:**
Provides a `cn()` utility function that merges Tailwind CSS classnames intelligently, resolving conflicts and removing duplicate classes.

**Implementation:**
```typescript
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

**Features:**
- Combines multiple class values using `clsx`
- Resolves Tailwind CSS conflicts using `twMerge`
- Supports conditional classes
- Prevents duplicate/conflicting utilities

**Usage:**
```typescript
cn("px-4", "px-6")  // → "px-6" (resolves conflict)
cn("text-red-500", isActive && "text-blue-500")  // Conditional
```

---

## Styling & Theme System

### Global Styles (app/globals.css)

#### Theme Variables Structure

The application uses CSS custom properties (variables) to manage theming, enabling instant theme switching without page reloads.

#### Light Mode (Default)

```css
:root {
  --background: #FFFFFF;
  --foreground: #1F2937;
  --primary: #7C3AED;        /* Indigo/Violet */
  --secondary: #F3F4F6;       /* Light gray */
  --accent: #6366F1;          /* Indigo */
  --muted: #F9FAFB;
  --muted-foreground: #6B7280;
  --destructive: #EF4444;     /* Red */
  --border: #E5E7EB;
  --input: #F3F4F6;
}
```

#### Soft Anime Theme (Dark Mode)

```css
[data-theme="soft-anime"] {
  --background: #1a1625;      /* Deep purple-gray */
  --foreground: #E8E4F0;      /* Light lavender */
  --card: #241f31;            /* Darker purple-gray */
  --primary: #A78BFA;         /* Light purple */
  --secondary: (darker shade)
  --accent: (lighter shade)
  /* Additional dark mode variables */
}
```

#### Tailwind Integration

Variables are mapped to Tailwind color utility system via `@theme` directive:
```css
@theme inline {
  --color-primary: var(--primary);
  --color-background: var(--background);
  /* ... more mappings ... */
}
```

#### Sidebar Theme Variables

Dedicated variables for sidebar styling:
```css
--sidebar: #F9FAFB;
--sidebar-foreground: #1F2937;
--sidebar-primary: #7C3AED;
--sidebar-accent: #F3F4F6;
--sidebar-border: #E5E7EB;
```

### Typography

- **Font Family:** Geist (sans-serif), Geist Mono (monospace)
- **Imported from:** Google Fonts
- **Fallback:** System fonts

### Animations

#### Wave Animation (Character-level)

Custom CSS animations for the AnimatedGreeting component:
```css
@keyframes wave-out {
  0% { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(-12px); }
}

@keyframes wave-in {
  0% { opacity: 0; transform: translateY(12px); }
  100% { opacity: 1; transform: translateY(0); }
}
```

#### Standard Tailwind Animations

- `animate-spin` - Rotating loader ring
- `animate-pulse` - Pulsing glow effect
- `animate-bounce` - Bouncing loading dots

### Responsive Design

#### Breakpoints

- **Mobile:** < 768px
- **Tablet/Desktop:** ≥ 768px

#### Responsive Layout

```typescript
// Chat panel uses clamp for responsive width
w-[clamp(380px, 28vw, 480px)]
```

---

## 3D Rendering Architecture

### Three.js Integration

The application uses a sophisticated 3D rendering pipeline:

#### Canvas Setup

- **Renderer:** WebGL with antialiasing enabled
- **Background:** Transparent (CSS handles background)
- **Resolution:** Dynamic (canvas fills container)
- **Pixel Ratio:** Automatic (device-aware)

#### Camera Configuration

**PerspectiveCamera:**
```
Position: [0, 0.3, 2.2]  - Positioned in front of model at slight upward angle
FOV: 35°                  - Slightly narrow for portrait framing
Aspect: Auto              - Maintains canvas aspect ratio
Near: 0.1                 - Prevents close object clipping
Far: 100                  - Distant far plane for large scenes
```

#### Lighting Model

**Multi-light Setup for Anime Rendering:**

1. **Ambient Light** (intensity 0.6)
   - Provides base illumination
   - Prevents completely dark areas
   - Color: #FFFFFF (white)

2. **Key Light - Front Right** (intensity 0.8)
   - Main directional light
   - Position: [3, 4, 5]
   - Color: #FFF5F0 (warm)
   - Creates primary shadows and highlights

3. **Fill Light - Left Side** (intensity 0.4)
   - Secondary light source
   - Position: [-3, 2, 3]
   - Color: #F0F5FF (cool/blue)
   - Illuminates shadow areas

4. **Rim/Back Light** (intensity 0.3)
   - Creates edge highlights
   - Position: [0, 3, -4]
   - Color: #E8E0FF (purple)
   - Anime-style silhouette effect

5. **Bottom Fill Light** (intensity 0.15)
   - Reduces harsh chin shadows
   - Position: [0, -2, 3]
   - Color: #FFFFFF (white)

#### Interaction Controls

**OrbitControls Configuration:**

```typescript
- enablePan: false              // Prevent translation
- enableZoom: true              // Allow zoom
- minDistance: 1.5              // Minimum zoom level
- maxDistance: 4                // Maximum zoom level
- minPolarAngle: π/4 (45°)     // Lowest vertical rotation
- maxPolarAngle: π/1.8 (100°)  // Highest vertical rotation
- minAzimuthAngle: -π/4 (-45°) // Leftmost rotation
- maxAzimuthAngle: π/4 (45°)   // Rightmost rotation
- target: [0, 0.2, 0]          // Rotation center (neck height)
```

This constrains rotation to prevent the model from rotating too far up/down or side to side.

### VRM Model Rendering

#### Loading Process

1. **GLTFLoader Initialization**
   - Create GLTFLoader instance
   - Register VRMLoaderPlugin for VRM support
   - Load file from public path

2. **VRM Extraction**
   - Extract VRM data from gltf.userData.vrm
   - Verify VRM object exists

3. **Model Orientation**
   - VRM models typically face +Z axis
   - Rotate by π radians on Y-axis to face camera
   - Position at [0, -0.8, 0] (center on stage)

4. **Animation Setup**
   - Create AnimationMixer for playback
   - Prepare for future animation triggering

#### Idle Animation

**Breathing Motion:**
```javascript
position.y = Math.sin(time * 1.5) * 0.01 - 0.8
// Oscillates ±0.01 units at 1.5x time scale
```

**Head Sway:**
```javascript
head.rotation.y = Math.sin(time * 0.5) * 0.02  // Y-axis sway
head.rotation.z = Math.sin(time * 0.3) * 0.01  // Z-axis tilt
```

**Effect:** Creates subtle, lifelike animation that suggests the character is alive and present.

#### Update Loop

Every frame (via `useFrame`):

```
1. Update VRM (vrm.update(delta))
   ├─ Updates bone positions/rotations
   ├─ Updates blendshapes
   └─ Syncs animations
2. Apply idle animations
3. Update AnimationMixer
4. Render via Three.js
```

#### Memory Management

**Garbage Collection:**
- Dispose geometries when component unmounts
- Dispose materials (single and array)
- Prevent WebGL memory leaks

---

## Advanced Features

### Error Handling

The application gracefully handles VRM loading failures:

1. **Loading State:** Shows spinner while fetching
2. **Success State:** Displays fully loaded model
3. **Error State:** Shows placeholder anime character silhouette

Users are informed via placeholder text to place VRM file at `/public/AvatarSample_A.vrm`.

### Responsive Layout

The interface adapts to different screen sizes:

- **Sidebar:** Fixed width (250px)
- **Character Showcase:** Flexible, responsive with max-width constraint
- **Chat Panel:** Responsive width using CSS `clamp()`

Breaks gracefully on mobile devices, though designed for desktop-first experience.

### Accessibility

- Semantic HTML with proper heading hierarchy
- ARIA labels on interactive elements
- `aria-live` regions for screen reader announcements
- Form input with associated labels
- Color contrast ratios meet WCAG standards

---

## Performance Optimizations

### WebGL Canvas

- Antialiasing enabled for smooth edges
- Alpha channel enabled for transparency
- Drawing buffer preserved for screenshots
- Efficient orbit controls with limited rotation

### Component Rendering

- "use client" directives prevent unnecessary SSR
- React hooks for local state management
- Efficient event handlers with useCallback
- Proper dependency arrays in useEffect

### Theme Switching

- localStorage for instant persistence
- CSS variables for near-zero-latency theme changes
- No component re-renders required

### 3D Model

- Streaming VRM format (efficient)
- Lazy loading via lazy imports
- Proper resource cleanup
- Optimized lighting for real-time performance

---

## Common Issues and Solutions

### VRM Model Not Loading

**Issue:** Placeholder silhouette displays instead of model.

**Solutions:**
1. Verify VRM file exists at `public/AvatarSample_A.vrm`
2. Check browser console for CORS errors
3. Ensure VRM file is valid and not corrupted
4. Try uploading model to CDN if local loading fails

### Theme Not Persisting

**Issue:** Theme choice resets on page reload.

**Solution:**
- Check browser localStorage is enabled
- Verify `localStorage.getItem("naragi-theme")` works
- Clear localStorage and rebuild if corrupted

### 3D Model Rendering Issues

**Issue:** Model appears distorted or rotated incorrectly.

**Solutions:**
1. Verify model orientation is correct in source VRM file
2. Check lighting isn't causing harsh shadows
3. Try adjusting camera FOV or position in `CharacterShowcase`
4. Verify GPU drivers are up to date

### Chat Messages Not Appearing

**Issue:** Messages not displaying in chat panel.

**Solution:**
- Check browser console for JavaScript errors
- Verify Message interface matches implementation
- Check state updates in handleSubmit function

---

## Development Workflow

### Adding New Features

1. Create component in `components/` directory
2. Use TypeScript for type safety
3. Style with Tailwind CSS utilities
4. Export from component file
5. Import and integrate into layout

### Adding UI Components

New Radix UI components can be added via:
```bash
npx shadcn-ui@latest add [component-name]
```

This adds the component to `components/ui/`.

### Debugging

Use React Developer Tools browser extension to inspect:
- Component hierarchy
- Props and state
- Theme context values
- Performance metrics

For 3D debugging, use Three.js Inspector (browser extension) to examine scene graph.

---

## Deployment

### Building for Production

```bash
pnpm run build
pnpm start
```

The production build:
- Optimizes bundle size
- Minifies CSS and JavaScript
- Enables image optimization
- Configures for Vercel deployment

### Environment Considerations

- Ensure VRM asset is in `public/` folder (copied to build output)
- Test all three-column layout on target browsers
- Verify WebGL support on deployment platform
- Configure CDN for static asset delivery

---

## Future Enhancement Opportunities

1. **Voice Integration:** Add text-to-speech for AI responses
2. **Animation Triggers:** Play VRM animations on specific events
3. **Customization:** Allow users to upload custom VRM models
4. **Real Backend:** Connect chat to actual LLM backend
5. **Mobile Optimization:** Simplify layout for mobile screens
6. **Analytics:** Track user interactions and learning progress
7. **Accessibility:** Enhance keyboard navigation and screen reader support
8. **Performance:** Implement model preloading and streaming

---

## References

- [Next.js Documentation](https://nextjs.org/docs)
- [React 19 Documentation](https://react.dev)
- [Three.js Documentation](https://threejs.org/docs)
- [@react-three/fiber Docs](https://docs.pmnd.rs/react-three-fiber)
- [@pixiv/three-vrm](https://github.com/pixiv/three-vrm)
- [Tailwind CSS](https://tailwindcss.com)
- [Radix UI](https://www.radix-ui.com)

---

## Conclusion

The AI NARAGI frontend represents a modern, full-featured React application integrating advanced 3D graphics, real-time chat, and polished UI design. The modular architecture, TypeScript support, and comprehensive component system make it maintainable and extensible for future development. The sophisticated lighting and animation setup creates an engaging, professional user experience for Japanese language learning.

