# ChatIAS Web Dashboard

A modern React-based web dashboard for managing the ChatIAS 3.0 multi-tenant AI agent platform.

## Features

- **Dashboard** - Overview of tenant usage, stats, and quick actions
- **Tenant Management** - Create, manage, and monitor multiple tenants
- **User Management** - Add users, assign roles, and manage permissions
- **Integrations** - Configure Evolution API, RD Station, and Confirm8 connections
- **Settings** - Customize security, billing, and API settings

## Tech Stack

- React 18
- React Router 6
- TypeScript
- Vite
- CSS (custom properties for theming)

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Install dependencies
cd packages/web
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### Environment Variables

Create a `.env` file in the packages/web directory:

```env
VITE_API_URL=http://localhost:3001
VITE_AUTH_URL=http://localhost:3000
```

## Project Structure

```
packages/web/
├── public/
│   └── favicon.svg
├── src/
│   ├── App.tsx              # Main app with routing
│   ├── main.tsx             # Entry point
│   ├── index.css            # Global styles
│   └── pages/
│       ├── Dashboard.tsx    # Main dashboard
│       ├── Tenants.tsx      # Tenant management
│       ├── Users.tsx        # User management
│       ├── Integrations.tsx # Integration configuration
│       ├── Settings.tsx     # Tenant settings
│       └── Login.tsx        # Login page
├── index.html
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## Usage

1. Start the development server: `npm run dev`
2. Open http://localhost:3000
3. Create your first tenant
4. Add users and configure integrations

## Screenshots

### Dashboard
![Dashboard](docs/dashboard.png)

### Tenant Management
![Tenants](docs/tenants.png)

### Integrations
![Integrations](docs/integrations.png)

## Development

```bash
# Type checking
npm run type-check

# Preview production build
npm run preview
```

## Integration with Backend

The web dashboard integrates with the ChatIAS core packages:

- `@chatias/core` - Multi-tenant system and utilities
- `@chatias/database` - Database repositories

In production, these would connect to a real backend API.

## License

MIT
