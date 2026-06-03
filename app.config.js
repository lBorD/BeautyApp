const enableEasUpdates = process.env.EXPO_USE_EAS_UPDATES === '1'
  || process.env.EAS_BUILD === 'true'
  || process.env.EAS_BUILD === '1';

module.exports = ({ config }) => {
  const nextConfig = {
    ...config,
    updates: {
      fallbackToCacheTimeout: 0,
    },
  };

  if (enableEasUpdates) {
    return {
      ...nextConfig,
      updates: config.updates,
      runtimeVersion: config.runtimeVersion,
    };
  }

  delete nextConfig.runtimeVersion;
  return nextConfig;
};
