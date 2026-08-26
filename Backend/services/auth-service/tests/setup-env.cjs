process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'unit-test-secret-with-16-chars';
process.env.DATABASE_URL = '';
process.env.OAUTH_PROVIDER = 'mock';
