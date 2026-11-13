// The web demo is served from a subpath on GitHub Pages (WEB_BASE_URL=/<repo>); everything else comes from app.json.
module.exports = ({ config }) =>
  process.env.WEB_BASE_URL ? { ...config, experiments: { ...config.experiments, baseUrl: process.env.WEB_BASE_URL } } : config;
