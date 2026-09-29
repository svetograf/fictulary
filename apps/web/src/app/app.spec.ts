import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Store, provideStore } from '@ngxs/store';
import { App } from './app';
import { SignInSuccess } from './auth/auth.actions';
import { AuthState } from './auth/auth.state';
import { authResponse } from './auth/testing';

describe('App', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
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

  it('offers sign in and sign up when signed out', async () => {
    const text = (await render()).querySelector('nav')?.textContent;
    expect(text).toContain('Sign in');
    expect(text).toContain('Sign up');
    expect(text).not.toContain('Upload');
  });

  it('shows the upload link and the user when signed in', async () => {
    TestBed.inject(Store).dispatch(new SignInSuccess(authResponse()));
    const text = (await render()).querySelector('nav')?.textContent;
    expect(text).toContain('Upload');
    expect(text).toContain('Ada');
    expect(text).not.toContain('Sign up');
  });
});
