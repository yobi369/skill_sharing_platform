// Set apiBaseUrl to the deployed API origin when the static frontend and API use different hosts.
// Keep CORS_ORIGINS on the API restricted to this exact frontend origin.
window.SKILLCHAIN_CONFIG = Object.freeze({
  apiBaseUrl: ""
});
