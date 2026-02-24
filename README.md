# [chroma.js palette ai copilot](https://colorden.vercel.app/)

A Svelte color-scale builder for perceptually balanced, colorblind-aware palettes,
forked from Gregor Aisch’s original tool and extended with an AI assistant.

## Fork notice

This project is a **fork** of [`gka/palettes`](https://github.com/gka/palettes),
extended by **Giorgi Buzaladze** with an added Ask-AI flow.

## Overview

- Build **sequential** and **diverging** palettes from custom color stops
- Tune scales with **bezier interpolation** and **lightness correction**
- Check and simulate colorblind variants (**deuteranopia/protanopia/tritanopia**)
- Export generated palettes in multiple copy-friendly formats
- Use **Ask AI** to translate natural language into palette settings

## Access

Color Den is deployed on [Vercel](https://vercel.com/). Use it at https://colorden.vercel.app/. Best experienced on desktop or tablet.

The original app is available at https://vis4.net/palettes.

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from `.env.example` and set:

```bash
OPENAI_API_KEY=your_key_here
```

3. Start local development:

```bash
npm run dev
```

"Ask AI" calls `/api/chat`, and `server.js` forwards to OpenAI using your server-side key.

## Project structure

- `src/`: Svelte frontend components and palette logic
- `src/colorBlind.js`: colorblind safety/simulation calculations
- `api/chat.js`: serverless OpenAI proxy used in production (e.g. Vercel)
- `server.js`: local Node dev server (serves `docs/` + `/api/chat`)
- `docs/`: built static output served by `sirv` / deployment target
- `docs/public/favicon.svg`: site favicon used by `docs/index.html`
