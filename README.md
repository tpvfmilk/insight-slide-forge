# ![distill-logo](https://github.com/user-attachments/assets/5277f352-bd50-4a99-a5ba-90657802a74a) DISTILL

Transform videos into structured, AI-powered slide decks for professional study, review, and licensing prep — all in your browser.




## 🚀 Overview

Distill is a full-stack web app that lets users upload video content (or provide transcripts) and automatically generates slide presentations using OpenAI's GPT models. Built for professionals studying for certification exams — like architecture, law, medicine, or engineering — this tool saves time by turning dense spoken content into structured learning resources.

- 🎞 Upload videos, YouTube/Vimeo links, or transcripts
- 🧠 AI-generated slides based on actual content
- 🧾 Export to PDF, CSV, or Anki decks
- 🧰 Edit and customize slides with rich UI
- 📂 Projects auto-expire after 48 hours to protect user data
- 💬 Optional context prompts to guide AI slide generation

---

## 🧱 Tech Stack

| Layer        | Tool/Service            |
| ------------ | ----------------------- |
| Frontend     | React + Vite + Tailwind |
| UI Framework | ShadCN / Radix UI       |
| Backend      | Supabase (DB + Auth + Storage) |
| AI           | OpenAI (GPT-4, Whisper) |
| Deployment   | Vercel (or self-hosted) |

---

## 📦 Features

- 🔐 **User Authentication** via Supabase
- 📤 **File Uploads** (video/audio/transcripts)
- 🧠 **Slide Generation** using OpenAI Edge Functions
- 🖼 **Slide Editor & Preview** with transitions and themes
- 🧾 **Export** to PDF, Anki, CSV
- 🌙 **Dark Mode** and Theme Customization
- ⏳ **Auto-delete projects** after 48 hours
- 💬 **Optional Prompting** for better slide accuracy

---

## 🛠 Setup Instructions

### 1. Clone the Repo

```bash
git clone https://github.com/tpvfmilk/insight-slide-forge.git
cd insight-slide-forge
```

2. Install Dependencies


```bash
npm install
```
3. Environment Setup

Create a .env file and configure:
```bash
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_OPENAI_API_KEY=your-default-api-key (optional)
```
4. Run the Dev Server
```bash
npm run dev
```
🧠 How It Works

  Upload Content
    Upload a video file, YouTube/Vimeo link, or a transcript image/text.

   Transcription (Whisper)
    Audio is transcribed using OpenAI Whisper or provided transcript is parsed.

  Slide Generation (GPT-4)
    The generate-slides Supabase edge function formats input into high-quality slides.

  Edit + Export
    Users can revise content and export it as PDF, Anki flashcards, or CSV.

📁 Project Structure
```bash
├── src
│   ├── components      # UI components
│   ├── pages           # Route views
│   ├── services        # Supabase and OpenAI services
│   └── edge-functions  # Supabase Edge Functions (generate-slides, etc)
├── public              # Static assets and logo
└── README.md
```
🛡 Security & Data Retention

  All user-uploaded data is stored temporarily

  Projects are auto-deleted 48 hours after upload

  API keys are stored securely using Supabase Edge Functions

  No personal data is used to train any model

🧪 Roadmap

File Upload + Transcription

Slide Generation with GPT

Slide Editor + PDF/CSV/Anki Export

Collaborative Editing

Theme Templates

Shareable Project URLs

Mobile Enhancements

🧑‍💻 Contributing

Got feedback or a use case in mind?
Reach out via GitHub issues
