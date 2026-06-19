module.exports = ({ config }) => {
  return {
    ...config,
    updates: {
      ...config.updates,
      fallbackToCacheTimeout: 0,
    },
    runtimeVersion: config.runtimeVersion,
  };
};
