import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Store, provideStore } from '@ngxs/store';
import { App } from './app';
import { LoadMeSuccess, SignInSuccess } from './auth/auth.actions';
import { AuthState } from './auth/auth.state';
import { ada, authResponse } from './auth/testing';

describe('App', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([{ path: '**', children: [] }]),
        provideStore([AuthState]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
  });

  const render = async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  };

  it('should render title', async () => {
    const element = await render();
    expect(element.querySelector('h1')?.textContent).toContain('Fictulary');
  });

  it('offers sign in when signed out', async () => {
    const text = (await render()).querySelector('nav')?.textContent;
    expect(text).toContain('Sign in');
    expect(text).not.toContain('Upload');
  });

  it('shows the upload link and the user when signed in', async () => {
    TestBed.inject(Store).dispatch(new SignInSuccess(authResponse()));
    const text = (await render()).querySelector('nav')?.textContent;
    expect(text).toContain('Upload');
    expect(text).toContain('Ada');
    expect(text).not.toContain('Sign in');
  });

  it('asks a restored user without a name for one', async () => {
    await render();
    TestBed.inject(Store).dispatch(
      new SignInSuccess({ ...authResponse(), user: { ...ada, name: null } }),
    );
    await TestBed.inject(Router).navigateByUrl('/book/3');
    TestBed.inject(Store).dispatch(new LoadMeSuccess({ ...ada, name: null }));
    await new Promise((resolve) => setTimeout(resolve));
    expect(TestBed.inject(Router).url).toBe('/welcome?returnUrl=%2Fbook%2F3');
  });
});
