import type { Configuration, PopupRequest } from "@azure/msal-browser";

export const msalConfig: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_AZURE_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID}`,
    redirectUri: "/", // Points back to your app after login
    postLogoutRedirectUri: "/"
  },
  cache: {
    cacheLocation: "sessionStorage"
  }
};

// Add scopes here for ID token to be used at MS Identity Platform endpoints.
export const loginRequest: PopupRequest = {
  scopes: ["User.Read"]
};