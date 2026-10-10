/* Build-time configuration. scripts/sync_assets.py replaces the __PLACEHOLDERS__
   when the Android assets are prepared (GitHub Actions does this automatically). */
window.PT_CONFIG = {
  // Base URL of the published lessons site (GitHub Pages), e.g. https://user.github.io/PythonTaj/
  REMOTE_BASE: '__REMOTE_BASE__',
  // GitHub repository "owner/name" that publishes APK releases
  GITHUB_REPO: '__GITHUB_REPO__',
  APP_VERSION: '1.0.0',
  FETCH_TIMEOUT_MS: 20000,
};
