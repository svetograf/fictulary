import { DevAuthModule } from './dev-auth.module';

describe('DevAuthModule', () => {
  const nodeEnv = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = nodeEnv;
  });

  it('refuses to start in production', () => {
    process.env.NODE_ENV = 'production';
    expect(() => new DevAuthModule()).toThrow(/production/);
  });

  it('starts elsewhere', () => {
    process.env.NODE_ENV = 'development';
    expect(() => new DevAuthModule()).not.toThrow();
  });
});
