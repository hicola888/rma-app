import 'reflect-metadata';

process.env.CLERK_SECRET_KEY ??= 'sk_test_placeholder';
process.env.DIRECT_URL ??= 'postgresql://rma:rma@localhost:15432/rma?schema=public';
process.env.DATABASE_URL = 'postgresql://rma_app:rma_app@localhost:15432/rma?schema=public';
