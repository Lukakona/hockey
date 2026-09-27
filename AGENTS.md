# AGENTS.md — Project Context & Engineering Guidelines

## Project Overview
**BlueLine Hockey** is a sports tracking, wagering, and social web application for hockey games.
Users can track hockey stats, bet **virtual currency** (no real money involved) on game outcomes and player props, view dynamic leaderboards, and participate in real-time league chat.

---

## Tech Stack & Architecture

- **Framework:** Next.js (App Router, TypeScript, React 19)
- **Styling:** Tailwind CSS + `shadcn/ui`, not finalized. You make make suggestions. The styling should be lighthearted, in the way that the platform Bluesky is.
- **Database & Auth:** Supabase (PostgreSQL + Supabase Auth)
- **Real-time:** Supabase Realtime (WebSockets for chat & live leaderboard updates)
- **Deployment & Hosting:** currently undecided, you may make suggestions

---