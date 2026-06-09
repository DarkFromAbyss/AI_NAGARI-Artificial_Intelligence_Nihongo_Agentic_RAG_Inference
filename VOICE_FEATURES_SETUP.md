# Voice Features Setup Guide

## Overview
The Voice Profiles feature allows users to select different character voices for Text-to-Speech (TTS) synthesis using Voicevox. The voice data is organized by character IDs with associated icons and sample audio.

## Character Data Structure

### Available Characters
- **ID 110**: Aqua - Clear and elegant female voice
- **ID 111**: Aura - Warm and soothing female voice
- **ID 3055**: Akari - Bright and cheerful female voice
- **ID 3056**: Ayaka - Sweet and gentle female voice
- **ID 3057**: Anzu - Lively and energetic female voice
- **ID 55**: Amane - Cool and composed female voice
- **ID 56**: Arisa - Mature and refined female voice
- **ID 57**: Asuna - Energetic and youthful female voice

### Voicevox Resources Location
```
voicevox/windows-directml/resources/character_info/
└── 00a5c10c-d3bd-459f-83fd-43180b521a44/
    ├── portrait.png
    ├── metas.json
    ├── policy.md
    ├── icons/
    │   ├── 110.png
    │   ├── 111.png
    │   ├── 3055.png
    │   ├── 3056.png
    │   ├── 3057.png
    │   ├── 55.png
    │   ├── 56.png
    │   └── 57.png
    └── voice_samples/
        ├── 110_001.wav, 110_002.wav, 110_003.wav
        ├── 111_001.wav, 111_002.wav, 111_003.wav
        ├── 3055_001.wav, 3055_002.wav, 3055_003.wav
        ├── 3056_001.wav, 3056_002.wav, 3056_003.wav
        ├── 3057_001.wav, 3057_002.wav, 3057_003.wav
        ├── 55_001.wav, 55_002.wav, 55_003.wav
        ├── 56_001.wav, 56_002.wav, 56_003.wav
        └── 57_001.wav, 57_002.wav, 57_003.wav
```

## Setup Instructions

### 1. Copy Voice Resources to Public Folder

To make voice icons and samples accessible from the frontend, copy them to the public directory:

**For Icon Files:**
```bash
# Copy icon files to public directory
# From: voicevox/windows-directml/resources/character_info/00a5c10c-d3bd-459f-83fd-43180b521a44/icons/
# To: frontend/public/voice/icons/00a5c10c-d3bd-459f-83fd-43180b521a44/

cp -r voicevox/windows-directml/resources/character_info/00a5c10c-d3bd-459f-83fd-43180b521a44/icons/* \
  frontend/public/voice/icons/00a5c10c-d3bd-459f-83fd-43180b521a44/
```

**For Sample Voice Files:**
```bash
# Copy voice sample files to public directory
# From: voicevox/windows-directml/resources/character_info/00a5c10c-d3bd-459f-83fd-43180b521a44/voice_samples/
# To: frontend/public/voice/samples/00a5c10c-d3bd-459f-83fd-43180b521a44/

cp -r voicevox/windows-directml/resources/character_info/00a5c10c-d3bd-459f-83fd-43180b521a44/voice_samples/* \
  frontend/public/voice/samples/00a5c10c-d3bd-459f-83fd-43180b521a44/
```

### 2. Character Data JSON

The character data is stored in:
```
frontend/public/data/voice-characters.json
```

This file contains:
- Character ID and name
- Path to character icon
- Path to voice sample
- Character description
- UUID for Voicevox reference

## Voice Profiles Page Features

### URL
- **Route**: `/profile/voice`
- **Accessible via**: Left sidebar "Voice" button

### Features Implemented
1. **Voice Feature Toggle**: ON/OFF master switch
2. **Character Selection Table**:
   - Character icon display
   - Voice ID
   - Character name
   - Voice description
   - Play button for voice samples
   - Select/Selected action button
3. **Dark Mode Styling**: Matches application theme
4. **Responsive Design**: Optimized for mobile and desktop

### UI Components

#### Toggle Switch
- Toggles the voice feature ON/OFF
- Affects table availability
- Visual glow effect when active

#### Character Table
- **Icon Column**: Shows character icon (60x60px)
- **ID Column**: Voicevox speaker ID
- **Name Column**: Character name
- **Description Column**: Voice characteristics
- **Sample Column**: Play button for 3-second voice sample
- **Action Column**: Select/Selected button

#### Row Selection
- Click any row to select that character
- Selected row highlights with primary color
- Selection persists during session

## API Integration (Optional)

To integrate with the backend for saving voice preferences:

### Backend Endpoint Example
```python
@router.put("/api/profile/voice-preference")
async def update_voice_preference(
    voice_id: int,
    session_token: str = Header(...)
):
    """Update user's preferred voice character"""
    # Save to database
    return {"success": True, "message": "Voice preference updated"}
```

### Frontend Integration
```typescript
const saveVoicePreference = async (characterId: number) => {
  const response = await fetch('/api/profile/voice-preference', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sessionToken}`
    },
    body: JSON.stringify({ voice_id: characterId })
  });
  return response.json();
};
```

## Files Modified

1. **frontend/app/profile/voice/page.tsx** - Main page component
2. **frontend/components/sidebar.tsx** - Enhanced with voice navigation
3. **frontend/styles/voice-profiles.module.css** - Styling and theme
4. **frontend/public/data/voice-characters.json** - Character data

## Troubleshooting

### Icons Not Displaying
- Ensure icon files are copied to `frontend/public/voice/icons/`
- Check browser console for 404 errors
- Verify file paths match UUID structure

### Voice Samples Not Playing
- Ensure WAV files are copied to `frontend/public/voice/samples/`
- Check file permissions are readable
- Browser may need permission to play audio
- Verify sample file format (WAV @ 24kHz)

### Voice Button Not Navigating
- Check that Next.js router is properly imported
- Verify `/profile/voice` route exists
- Check browser console for navigation errors

## Future Enhancements

- [ ] Backend persistence of voice preference
- [ ] API endpoint to dynamically load voice characters
- [ ] Advanced voice settings (pitch, speed, volume)
- [ ] Voice preview with user's own text
- [ ] Multi-language character support
- [ ] Character portrait display on hover
- [ ] Voice history/favorites

## References

- [Voicevox Official](https://voicevox.hiroshimaweb.jp/)
- [Voicevox Speaker List](https://voicevox.hiroshimaweb.jp/)
- Frontend: `/profile/voice`
