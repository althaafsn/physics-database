# Physics Problem Database

[![CI](https://github.com/althaafsn/physics-database/actions/workflows/ci.yml/badge.svg)](https://github.com/althaafsn/physics-database/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Live Demo](https://img.shields.io/badge/demo-live-0ea5e9)](https://d28e99c7v2289t.cloudfront.net)

A web app for browsing Indonesian physics olympiad problems and assembling custom exam papers — no account, no backend.

**[Try it live](https://d28e99c7v2289t.cloudfront.net)** · **[Watch demo](#demo)**

## What it does

Teachers and students can search a library of **~439 problems** from OSK, OSP, and OSN exams (2004–2026), pick questions into a set, preview the paper, and save it as a PDF from the browser.

Problems include **LaTeX math**, **figures**, and optional **English translations** (~99% coverage). Everything runs in the browser; your sets are saved locally on your device.

## Demo

https://github.com/user-attachments/assets/581c7954-b054-4d22-a443-abfefe9fcba2

## How it works

### 1. Browse the library

Filter by competition level, year, and topic (mechanics, electromagnetism, thermodynamics, waves, modern physics). Search by title or keyword, open a problem to read the full statement with rendered math and diagrams, then add it to your current set.

### 2. Build an exam set

The set builder is where you compose a paper:

- Add or remove problems from the library
- Reorder questions (move up/down or drag)
- Generate a **random set** with filters (level, year, topic, count)
- Work on **multiple saved sets** — switch between them anytime
- Start from a **starter template** (e.g. OSK Mechanics Sample) on first visit

Sets auto-save to **localStorage**, so they persist on the same browser without logging in.

### 3. Preview and export

Open **Preview** to see the formatted exam layout, then **Print / Save PDF** and choose “Save as PDF” in the print dialog. No server-side PDF generation — the preview is what you print.

### 4. Language toggle

Switch between **Indonesian** (original) and **English** where a translation exists. Stats on the dashboard show translation coverage across the corpus.

## Corpus

Problems were extracted from official exam PDFs and structured into a searchable catalog with metadata (level, year, topic, subparts, figures). The repo includes the parsed corpus and a Python pipeline for ingest, validation, and translation — not the original PDF files.

| | |
|---|---|
| Levels | OSK (school), OSP (provincial), OSN (national) |
| Topics | Mechanics, E&M, thermodynamics, waves/optics, modern physics |
| Format | Markdown + KaTeX, with extracted diagram assets |

## Run locally

```bash
git clone https://github.com/althaafsn/physics-database.git
cd physics-database
npm ci
npm run build:static
npm run preview:static   # http://localhost:3000
```

For development with hot reload: `npm run dev` (run `npm run export:data` first if catalog data is missing).

## Tech

Next.js · React · Tailwind · KaTeX · static JSON corpus · Python ingestion pipeline

Deploy notes (optional): [deploy/aws/README.md](deploy/aws/README.md)

## License

MIT — see [LICENSE](LICENSE).
