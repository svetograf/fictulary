import {
  INestApplication,
  RequestMethod,
  Type,
  ValidationPipe,
} from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { DevAuthController } from './auth/dev/dev-auth.controller';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { BooksController } from './books/books.controller';
import { BooksService } from './books/books.service';
import { DefinitionsService } from './dictionary/definitions.service';
import { DictionaryController } from './dictionary/dictionary.controller';
import { DictionaryService } from './dictionary/dictionary.service';
import { User } from './users/user.entity';

/** Every controller in the app. Add new controllers here. */
const CONTROLLERS: Type[] = [
  AppController,
  AuthController,
  DevAuthController,
  BooksController,
  DictionaryController,
];

/** The only routes reachable without a token. */
const PUBLIC_ROUTES = [
  'POST /api/auth/google',
  'POST /api/auth/apple',
  'POST /api/auth/dev',
];

interface Route {
  method: string;
  path: string;
}

/** Lists routes from controller metadata, filling `:params` with `1`. */
function routes(): Route[] {
  return CONTROLLERS.flatMap((controller) => {
    const base = String(Reflect.getMetadata(PATH_METADATA, controller) ?? '');
    const proto = controller.prototype;
    return (
      Object.getOwnPropertyNames(proto)
        // The constructor is the class itself, which carries the controller path.
        .filter((name) => name !== 'constructor')
        .map((name) => proto[name])
        .filter((handler) => Reflect.hasMetadata(PATH_METADATA, handler))
        .map((handler) => {
          const method =
            RequestMethod[Reflect.getMetadata(METHOD_METADATA, handler)];
          const path = [
            base,
            String(Reflect.getMetadata(PATH_METADATA, handler)),
          ]
            .filter((part) => part && part !== '/')
            .join('/')
            .replace(/:word\b/, 'phone')
            .replace(/:\w+/g, '1');
          return { method, path: `/api/${path}`.replace(/\/$/, '') };
        })
    );
  });
}

describe('route protection', () => {
  let app: INestApplication;
  let token: string;

  const resolves = (value: unknown) => jest.fn().mockResolvedValue(value);

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'test-secret' })],
      controllers: CONTROLLERS,
      providers: [
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        {
          provide: getRepositoryToken(User),
          useValue: { existsBy: resolves(true) },
        },
        { provide: AppService, useValue: { getData: jest.fn(() => ({})) } },
        {
          provide: AuthService,
          useValue: {
            signInWithGoogle: resolves({}),
            signInWithApple: resolves({}),
            devSignIn: resolves({}),
            me: resolves({}),
            updateProfile: resolves({}),
            deleteAccount: resolves(undefined),
          },
        },
        {
          provide: BooksService,
          useValue: {
            findAll: resolves([]),
            findOne: resolves({}),
            create: resolves({}),
            wordsWithStatus: resolves([]),
            wordsToLearnPage: resolves({}),
            remove: resolves(undefined),
          },
        },
        {
          provide: DictionaryService,
          useValue: {
            list: resolves({}),
            details: resolves({}),
            updateStatus: resolves({}),
            markViewed: resolves({}),
          },
        },
        { provide: DefinitionsService, useValue: { lookup: resolves({}) } },
      ],
    }).compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
    token = await module
      .get(JwtService)
      .signAsync({ sub: '1', email: 'ada@example.com' });
  });

  afterAll(() => app.close());

  const send = ({ method, path }: Route) =>
    request(app.getHttpServer())[method.toLowerCase() as 'get'](path);

  it('finds the routes to check', () => {
    const all = routes().map((r) => `${r.method} ${r.path}`);
    expect(all).toEqual(
      expect.arrayContaining([
        ...PUBLIC_ROUTES,
        'GET /api/me',
        'POST /api/book',
      ]),
    );
  });

  it.each(
    routes()
      .filter((r) => !PUBLIC_ROUTES.includes(`${r.method} ${r.path}`))
      .map((r) => [`${r.method} ${r.path}`, r] as const),
  )('%s rejects requests without a token', async (_name, route) => {
    const response = await send(route);
    expect(response.status).toBe(401);
  });

  it.each(
    routes()
      .filter((r) => !PUBLIC_ROUTES.includes(`${r.method} ${r.path}`))
      .map((r) => [`${r.method} ${r.path}`, r] as const),
  )('%s rejects an invalid token', async (_name, route) => {
    const response = await send(route).set('Authorization', 'Bearer nope');
    expect(response.status).toBe(401);
  });

  it.each(
    routes()
      .filter((r) => !PUBLIC_ROUTES.includes(`${r.method} ${r.path}`))
      .map((r) => [`${r.method} ${r.path}`, r] as const),
  )('%s passes the guard with a valid token', async (_name, route) => {
    const response = await send(route).set('Authorization', `Bearer ${token}`);
    expect(response.status).not.toBe(401);
  });

  it.each(PUBLIC_ROUTES.map((name) => [name] as const))(
    '%s is reachable without a token',
    async (name) => {
      const [method, path] = name.split(' ');
      const response = await send({ method, path });
      // Reaches validation (400) rather than being turned away (401).
      expect(response.status).toBe(400);
    },
  );
});
