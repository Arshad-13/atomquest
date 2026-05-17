import { useEffect } from 'react';
import { useMsal } from '@azure/msal-react';

/**
 * MSAL Popup Redirect Handler
 *
 * This component is rendered at /auth-redirect (a public, unguarded route).
 * When MSAL's loginPopup() redirects the popup window here, MsalProvider
 * automatically calls handleRedirectPromise() on mount, which:
 *   1. Reads the auth code from the URL hash
 *   2. Exchanges it for tokens
 *   3. Posts the result back to the parent window via postMessage
 *   4. Closes this popup window
 *
 * This page intentionally has no UI — it should close itself within ~1 second.
 */
export const AuthRedirect = () => {
  const { instance } = useMsal();

  useEffect(() => {
    // Explicitly call handleRedirectPromise for MSAL v3 popup flow.
    // MsalProvider also calls this on mount, but being explicit ensures it runs.
    instance.handleRedirectPromise()
      .then(() => {
        // The popup closes itself after sending the token to the parent.
        // If for some reason it doesn't, close manually.
        if (window.opener) {
          window.close();
        }
      })
      .catch((err) => {
        console.error('[AuthRedirect] handleRedirectPromise error:', err);
        if (window.opener) {
          window.close();
        }
      });
  }, [instance]);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      fontFamily: 'system-ui, sans-serif',
      color: '#6366f1',
      fontSize: '14px',
      gap: '10px'
    }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 6v6l4 2"/>
      </svg>
      Completing sign-in...
    </div>
  );
};
