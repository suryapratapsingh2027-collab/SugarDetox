// Extends app.json. Fails EAS production builds early if the API URL is missing or not HTTPS,
// so you can never ship a store build that points at localhost.
module.exports = ({ config }) => {
  const isProdBuild = process.env.EAS_BUILD_PROFILE === 'production';
  const url = process.env.EXPO_PUBLIC_API_URL || '';
  if (isProdBuild && !/^https:\/\/[^/]+/i.test(url)) {
    throw new Error(
      'EXPO_PUBLIC_API_URL must be set to your deployed https:// API URL for production builds ' +
        '(set it in eas.json under build.production.env).'
    );
  }
  return config;
};
