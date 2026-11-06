// Jest for the app and the module tests (copied to tests/modules/<module>/): jest-expo preset, React Native Testing Library matchers.
module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/tests/**/*.test.[jt]s?(x)'],
  transformIgnorePatterns: ['node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|react-native-paper|react-native-vector-icons|react-native-safe-area-context|react-native-screens))'],
};
