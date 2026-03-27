# Testing

100% test coverage is the key to great vibe coding. Tests let you move fast, trust your instincts, and ship with confidence — without them, vibe coding is just yolo coding. With tests, it's a superpower.

## Framework

- **Vitest** v4.x — fast, Vite-native test runner
- **@testing-library/react** — component testing
- **@testing-library/jest-dom** — DOM matchers
- **jsdom** — browser environment simulation

## Running Tests

```bash
npm test          # Single run
npm run test:watch  # Watch mode
```

## Test Layers

### Unit Tests (`src/**/*.test.ts`)
- Pure functions: poker math, hand classification, distractor generation
- Data validation: opening move legality, type constraints

### Integration Tests (`src/**/*.test.tsx`)
- Component rendering and user interaction
- Hook behavior with mocked dependencies

### Smoke Tests
- Build verification: `npm run build`

### E2E Tests
- Not yet configured. Consider Playwright for full user flow testing.

## Conventions

- Test files live next to their source: `foo.ts` → `foo.test.ts`
- Use `describe` blocks grouped by function/component
- Prefer `toBeCloseTo` for floating point comparisons
- Test both happy paths and edge cases (empty input, boundaries)
