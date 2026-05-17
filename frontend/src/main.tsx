import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { MsalProvider } from '@azure/msal-react';
import { msalInstance } from './msalInstance';
import { useAppStore } from './store/useAppStore';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

msalInstance.initialize().then(async () => {
  // 1. Restore active account from session storage
  const accounts = msalInstance.getAllAccounts();
  if (accounts.length > 0) msalInstance.setActiveAccount(accounts[0]);

  // 2. Handle redirect result BEFORE rendering React.
  //    This runs synchronously with the page load after Microsoft's redirect.
  //    If we wait for useEffect in App.tsx, the event has already fired.
  try {
    const redirectResult = await msalInstance.handleRedirectPromise();
    if (redirectResult?.accessToken) {
      // Exchange the MSAL token for our app's JWT
      const azureRes = await axios.post(
        `${API_URL}/auth/azure`,
        { access_token: redirectResult.accessToken }
      );
      const appToken = azureRes.data.access_token;
      const meRes = await axios.get(
        `${API_URL}/auth/me`,
        { headers: { Authorization: `Bearer ${appToken}` } }
      );
      // Store auth state before React renders — app will boot into dashboard
      useAppStore.getState().setAuth(meRes.data, appToken);
    }
  } catch (err) {
    console.error('[SSO] Redirect token exchange failed:', err);
  }

  // 3. Render the app (user is now authenticated if redirect succeeded)
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <MsalProvider instance={msalInstance}>
        <App />
      </MsalProvider>
    </React.StrictMode>,
  );
});