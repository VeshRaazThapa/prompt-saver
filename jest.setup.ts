import '@testing-library/jest-dom';

// Mock environment variables for tests
process.env['NEXTAUTH_SECRET'] = 'test-secret-key-do-not-use-in-production';
process.env['NEXTAUTH_URL'] = 'http://localhost:3000';
