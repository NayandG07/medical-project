# Medical AI Platform - Frontend

Next.js frontend for the Medical AI Platform.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
```bash
cp .env.local.example .env.local
# Edit .env.local with your backend API URL and Supabase credentials
```

3. Run the development server:
```bash
npm run dev
```

The application will be available at http://localhost:3000

## Testing

Run tests with:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

## Project Structure

```
frontend/
├── pages/              # Next.js pages
│   ├── index.tsx       # Home page
│   ├── chat.tsx        # Chat interface
│   └── admin/          # Admin panel pages
├── components/         # React components
├── lib/               # Utility functions and clients
├── styles/            # CSS styles
└── tests/             # Test suite
    ├── unit/
    ├── integration/
    └── property/
```

## Building for Production

```bash
npm run build
npm start
```
