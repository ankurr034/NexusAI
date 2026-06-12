import React from 'react';
import { useGoogleLogin, hasGrantedAllScopesGoogle } from '@react-oauth/google';
import axios from 'axios';
import { useUser } from '../context/UserContext';
import { useToast } from './Toast';
import { API_BASE_URL } from '../config';

// Google's official "G" mark as an inline SVG so we don't ship an extra asset.
const GoogleGlyph = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
    <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.49h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.63z" />
    <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.35 0-4.34-1.59-5.05-3.71H.96v2.33A9 9 0 0 0 9 18z" />
    <path fill="#FBBC05" d="M3.95 10.71a5.41 5.41 0 0 1 0-3.42V4.96H.96a9 9 0 0 0 0 8.08l2.99-2.33z" />
    <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58z" />
  </svg>
);

/**
 * "Continue with Google" button.
 *
 * Uses Google Identity Services via @react-oauth/google. The implicit-flow
 * popup returns an access token; we fetch the user's profile from Google and
 * verify it server-side. When VITE_GOOGLE_CLIENT_ID is not configured the
 * button is hidden entirely so the rest of auth keeps working.
 */
export default function GoogleSignInButton({ label = 'Continue with Google', onSuccess, disabled }) {
  const { loginWithGoogle } = useUser();
  const toast = useToast();
  const [busy, setBusy] = React.useState(false);
  const configured = !!import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const login = useGoogleLogin({
    flow: 'implicit',
    onSuccess: async (tokenResponse) => {
      try {
        // Exchange the access token for the user's basic profile, then build a
        // credential-like payload the backend can verify. We send the access
        // token; the backend validates it against Google's userinfo endpoint.
        const credential = tokenResponse.access_token;
        const result = await loginWithGoogle(credential);
        if (result.success) {
          toast.success('Signed in with Google!');
          onSuccess?.();
        } else {
          toast.error(result.error || 'Google sign-in failed');
        }
      } catch (err) {
        console.error('Google sign-in error:', err);
        toast.error('Google sign-in failed');
      } finally {
        setBusy(false);
      }
    },
    onError: () => {
      setBusy(false);
      toast.error('Google sign-in was cancelled or failed');
    },
  });

  if (!configured) return null;

  return (
    <button
      type="button"
      disabled={disabled || busy}
      onClick={() => { setBusy(true); login(); }}
      className="w-full flex items-center justify-center gap-3 bg-white hover:bg-zinc-100 text-zinc-800 font-bold py-3.5 rounded-xl transition-all border border-white/10 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed text-sm hover:scale-[1.01] active:scale-[0.99]"
    >
      {busy ? (
        <svg className="w-4 h-4 animate-spin text-zinc-600" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : (
        <GoogleGlyph />
      )}
      <span>{busy ? 'Connecting…' : label}</span>
    </button>
  );
}
