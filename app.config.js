const fs = require("fs");

const baseConfig = require("./app.json").expo;

const IOS_FIREBASE_FILE = "./GoogleService-Info.plist";
const ANDROID_FIREBASE_FILE = "./google-services.json";

const argv = process.argv.join(" ");
const isIosCommand = /\b(run:ios|ios)\b/.test(argv) || /--platform\s+ios\b/.test(argv);
const isAndroidCommand =
  /\b(run:android|android)\b/.test(argv) || /--platform\s+android\b/.test(argv);

const hasIosFirebaseConfig = fs.existsSync(IOS_FIREBASE_FILE);
const hasAndroidFirebaseConfig = fs.existsSync(ANDROID_FIREBASE_FILE);

const firebasePlugins = [
  "@react-native-firebase/app",
  "@react-native-firebase/messaging",
];

module.exports = () => {
  const plugins = baseConfig.plugins.filter(
    (plugin) => !firebasePlugins.includes(Array.isArray(plugin) ? plugin[0] : plugin)
  );

  if (hasIosFirebaseConfig || (hasAndroidFirebaseConfig && isAndroidCommand)) {
    plugins.push(...firebasePlugins);
  }

  return {
    ...baseConfig,
    ios: {
      ...baseConfig.ios,
      ...(hasIosFirebaseConfig ? { googleServicesFile: IOS_FIREBASE_FILE } : {}),
    },
    plugins,
    extra: {
      ...baseConfig.extra,
      hasIosFirebaseConfig,
    },
  };
};
