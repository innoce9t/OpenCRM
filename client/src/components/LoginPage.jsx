import { useEffect, useRef, useState } from 'react';
import { api, setToken } from '../api.js';

// Load the Google Identity Services script once.
function loadGis() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    let s = document.getElementById('gis-script');
    if (s) { s.addEventListener('load', resolve); s.addEventListener('error', reject); return; }
    s = document.createElement('script');
    s.id = 'gis-script';
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true; s.defer = true;
    s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

export default function LoginPage({ onAuthed }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [googleClientId, setGoogleClientId] = useState(null);
  const [firebaseConfig, setFirebaseConfig] = useState(null);
  const googleBtnRef = useRef(null);

  useEffect(() => {
    api.authConfig().then((c) => { setFirebaseConfig(c.firebaseConfig || null); setGoogleClientId(c.googleClientId); }).catch(() => {});
  }, []);

  // Firebase Google sign-in (popup). Handles both sign-in and first-time signup.
  const signInWithFirebase = async () => {
    setError(''); setBusy(true);
    try {
      const { initializeApp, getApps } = await import('firebase/app');
      const { getAuth, GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
      if (!getApps().length) initializeApp(firebaseConfig);
      const result = await signInWithPopup(getAuth(), new GoogleAuthProvider());
      const idToken = await result.user.getIdToken();
      const r = await api.firebaseLogin(idToken);
      setToken(r.token); onAuthed(r.user);
    } catch (err) {
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') { setBusy(false); return; }
      setError(err?.body?.error || err?.message || 'Google sign-in failed.');
    } finally { setBusy(false); }
  };

  // Fallback: raw Google Identity Services (used only if Firebase isn't configured).
  useEffect(() => {
    if (firebaseConfig || !googleClientId) return;
    let cancelled = false;
    const handleGoogle = async (resp) => {
      setError(''); setBusy(true);
      try {
        const r = await api.googleLogin(resp.credential);
        setToken(r.token); onAuthed(r.user);
      } catch (err) { setError(err.body?.error || 'Google sign-in failed.'); }
      finally { setBusy(false); }
    };
    loadGis().then(() => {
      if (cancelled || !window.google?.accounts?.id) return;
      const dark = document.documentElement.getAttribute('data-theme') !== 'light';
      window.google.accounts.id.initialize({ client_id: googleClientId, callback: handleGoogle });
      if (googleBtnRef.current) {
        googleBtnRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(googleBtnRef.current, { theme: dark ? 'filled_black' : 'outline', size: 'large', width: 324, text: 'continue_with', shape: 'rectangular' });
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [firebaseConfig, googleClientId, onAuthed]);

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const res = await api.login(email.trim(), password);
      setToken(res.token);
      onAuthed(res.user);
    } catch (err) {
      setError(err.body?.error || 'Something went wrong.');
    } finally { setBusy(false); }
  };

  const fillDemo = () => { setEmail('ahsan@opencrm.app'); setPassword('opencrm'); };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-logo">
          <span className="logo-dots"><i className="dot dot-red" /><i className="dot dot-green" /></span>
          <span className="logo-text">OpenCRM</span>
        </div>
        <h1 className="auth-title">Sign in</h1>

        {firebaseConfig ? (
          <>
            <button type="button" className="google-btn" onClick={signInWithFirebase} disabled={busy}>
              <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
                <path fill="#4285F4" d="M17.6 9.2c0-.6-.05-1.18-.15-1.74H9v3.3h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.58 2.64-3.9 2.64-6.54z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.95v2.33A9 9 0 0 0 9 18z"/>
                <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.95a9 9 0 0 0 0 8.1l3.02-2.33z"/>
                <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.89 11.43 0 9 0A9 9 0 0 0 .95 4.95l3.02 2.33C4.68 5.16 6.66 3.58 9 3.58z"/>
              </svg>
              Continue with Google
            </button>
            <div className="auth-divider"><span>or</span></div>
          </>
        ) : googleClientId && (
          <>
            <div className="google-btn-wrap" ref={googleBtnRef} />
            <div className="auth-divider"><span>or</span></div>
          </>
        )}

        <label className="auth-field">
          <span>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required />
        </label>
        <label className="auth-field">
          <span>Password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
        </label>

        {error && <div className="auth-error">{error}</div>}

        <button className="btn-primary auth-submit" disabled={busy} type="submit">
          {busy ? 'Please wait…' : 'Sign in'}
        </button>

        <div className="auth-demo">
          Demo: <code>ahsan@opencrm.app</code> / <code>opencrm</code>
          <button type="button" className="link-btn" onClick={fillDemo}>use it</button>
        </div>
      </form>
      <div className="auth-footer">
        Developed by <a href="https://ahsan.live" target="_blank" rel="noreferrer">Ahsan Nawazish</a>
      </div>
    </div>
  );
}
