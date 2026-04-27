# Guitar Scale Tool

An interactive web application for learning and practicing guitar scales. Features a visual fretboard, audio playback, chord diagrams, and a gamified practice mode to help guitarists master scales across the entire neck.

## Features

### Interactive Fretboard
- Visual display of scale positions with CAGED system or 3-Notes-Per-String (3NPS) patterns
- Click-to-play notes with Web Audio synthesizer
- Configurable fret count (12-24 frets)
- Realistic proportional fret widths
- Multiple display modes: dots, note names, or intervals

### 60+ Built-in Scales
- Major/Minor (natural, harmonic, melodic)
- Pentatonic & Blues scales
- Greek Modes (Ionian, Dorian, Phrygian, Lydian, Mixolydian, Aeolian, Locrian)
- Jazz scales (Bebop, Diminished, Whole Tone)
- Exotic scales (Hungarian, Persian, Japanese, Chinese, Egyptian, and more)
- Custom scale creation

### Audio Engine
- Web Audio API synthesizer with guitar-like envelope
- Built-in metronome with tempo, time signature, and accent controls
- Adjustable volume, sustain, attack, and release

### Multiple Tuning Support
- Standard tuning
- Drop tunings (Drop D, Drop C)
- Open tunings (Open G, Open D, Open E, Open A)
- Alternate tunings (DADGAD, Half Step Down, Whole Step Down)
- Extended range (7-string, 8-string)

### Chord Diagrams
- Diatonic chord generation for any scale
- Visual chord diagrams with fingering positions
- Chord playback

### Practice Mode
- Note identification quizzes
- Interval recognition exercises
- Progressive speed trainer
- Multiple difficulty levels

### Gamification
- XP and leveling system
- Daily practice streaks
- Achievement tracking
- Progress statistics

### UI/UX
- Dark/Light theme (GMK Taro / GMK Botanical color schemes)
- Responsive design for mobile, tablet, and desktop
- Collapsible panels for mobile optimization

## Tech Stack

### Frontend
- React 19
- TypeScript
- Vite
- Tailwind CSS
- Zustand (state management)

### Backend
- FastAPI (Python)
- Motor (async MongoDB driver)
- MongoDB

## Usage

Try it live: [guitarscaleteacher.vercel.app](https://guitarscaleteacher.vercel.app)

<details>
<summary>Local Development</summary>

### Prerequisites
- Node.js and npm
- Python 3.12+
- MongoDB Community Edition (running locally on port 27017)

### Installation

1. Clone the repository
```bash
git clone https://github.com/SeanSnaider/guitar-scale-tool.git
cd guitar-scale-tool/Guitar-Scale-Tool
```

2. Install frontend dependencies
```bash
cd frontend
npm install
```

3. Set up the backend
```bash
cd backend
cp .env.example .env
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Running Locally

1. Start the backend server (Terminal 1)
```bash
cd backend
source venv/bin/activate  # On Windows: venv\Scripts\activate
uvicorn app.main:app --reload
```

2. Start the frontend development server (Terminal 2)
```bash
cd frontend
npm run dev
```

The app will be available at `http://localhost:5173`

</details>