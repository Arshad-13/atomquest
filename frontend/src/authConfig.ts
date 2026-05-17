import type { Configuration, RedirectRequest } from "@azure/msal-browser";

export const msalConfig: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_AZURE_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID}`,
    redirectUri: window.location.origin + "/",
    postLogoutRedirectUri: "/"
  },
  cache: { cacheLocation: "sessionStorage" }
};

export const loginRequest: RedirectRequest = {
  scopes: ["User.Read"],
};