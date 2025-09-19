module.exports = function (api) {
  api && api.cache && api.cache(true);
  return {
    presets: ['module:@react-native/babel-preset'],
    plugins: [
      ['react-native-unistyles/plugin', { root: 'src' }],
    ],
  };
};
