# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a React landing page application built with TypeScript, Vite, and Tailwind CSS. The application serves as a multilingual landing page for ProxyCom with features including user authentication, campaign management, and internationalization support.

## Development Commands

### Build and Development
- `npm run dev` - Start development server with HMR
- `npm run build` - Type check and build for production (runs `tsc -b && vite build`)
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint on codebase

### Notes
- No test commands are configured in package.json
- TypeScript compilation happens before Vite build process

## Architecture

### Core Technologies
- **React 19** with TypeScript
- **Vite** as build tool with custom chunk splitting for optimal bundle sizes
- **Tailwind CSS 4** for styling
- **React Router** for routing with nested routes
- **TanStack Query** for server state management
- **i18next** for internationalization (English, French, Spanish)
- **FullCalendar** for calendar functionality
- **Lottie React** for animations

### Project Structure
```
src/
├── components/     # React components (LandingPage, Header, LoginModal, etc.)
├── pages/         # Page-level components with routing
├── context/       # React Context (AuthContext)
├── utils/         # Utilities (apiClient)
├── locales/       # Translation files
├── assets/        # Static assets
└── i18n.ts        # Internationalization configuration
```

### Key Architectural Patterns

#### Routing
- Main routes: `/` (landing), `/campagne/*` (campaign pages), `/forgot-password`
- Campaign functionality is modularized in `pages/campagne` with its own router
- LoginModal is rendered globally across all routes

#### API Integration
- Vite dev server proxies `/api` requests to `https://api.proxycom.net`
- API client utilities in `src/utils/apiClient.ts`
- TanStack Query for data fetching and caching

#### Internationalization
- Configured for 3 languages: English (default), French, Spanish
- Translation files in `public/locales/{lang}/translation.json`
- Browser language detection enabled
- Debug mode enabled for development

#### Build Optimization
- Manual chunk splitting configured for vendor libraries:
  - `vendor`: React core
  - `router`: React Router
  - `query`: TanStack Query
  - `calendar`: FullCalendar components
  - `i18n`: Internationalization libraries
  - `ui`: UI component libraries
- Chunk size warning limit set to 1000kb

## ESLint Configuration
- Uses modern ESLint flat config format (`eslint.config.js`)
- TypeScript ESLint integration
- React-specific rules via `eslint-plugin-react-hooks` and `eslint-plugin-react-refresh`