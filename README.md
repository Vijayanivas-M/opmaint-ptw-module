# Permit to Work (PTW) Module - Opmaint

A production-ready, mobile-first safety authorization module designed for field technicians. Built as a technical assignment for Opmaint, this application facilitates the creation and management of specialized safety permits (e.g., Hot Work) with a focus on data integrity, relational database design, and a responsive mobile UI.

## 🏗️ Architecture & Tech Stack

This project utilizes a modern full-stack ecosystem, decoupled to ensure independent scaling of the API and the client interface.

**Frontend:**
* React (Vite)
* TypeScript
* Tailwind CSS v4
* React Router DOM (Client-side routing)

**Backend:**
* Node.js & Express (ESM routing)
* TypeScript (`tsx`)
* PostgreSQL (Hosted via Supabase)
* `pg` (Node-Postgres connection pool)

## ✨ Core Features & Technical Highlights

* **Scalable Relational Schema:** Implements a base `permits` table combined with one-to-one extension tables (e.g., `permit_hot_work`). This avoids null-heavy wide tables and allows infinite scaling for future permit types (Confined Space, Working at Height) without schema alterations.
* **ACID Transactions:** The Express API utilizes strict SQL transactions (`BEGIN`, `COMMIT`, `ROLLBACK`) during creation to guarantee that data is written safely across multiple linked tables, preventing orphaned records.
* **Mobile-First UI:** Designed with large touch targets, accessible contrast, and persistent CTAs specifically tailored for field operators using mobile devices under industrial conditions. 
* **Cross-Device Networking:** Configured the backend to bind to `0.0.0.0`, allowing seamless local network testing across desktop and mobile devices simultaneously.

## ⚙️ Local Setup Instructions

### 1. Prerequisites
* Node.js (v18+ recommended)
* PostgreSQL database instance (Supabase used in development)

### 2. Environment Configuration
Create a `.env` file in the `/backend` directory and add your connection string. 
*(Note: Ensure reserved URL characters in passwords like `?` or `/` are percent-encoded)*
```env
DATABASE_URL="postgresql://postgres.[YOUR_PROJECT]:[YOUR_PASSWORD]@[aws-0-eu-central-1.pooler.supabase.com:6543/postgres](https://aws-0-eu-central-1.pooler.supabase.com:6543/postgres)"
```


