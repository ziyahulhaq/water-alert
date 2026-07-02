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

  if (hasIosFirebaseConfig && isIosCommand) {
    // Only add @react-native-firebase/app on iOS (not messaging)
    // because messaging requires Push Notifications capability
    // which is not supported by free/personal Apple Developer accounts.
    plugins.push("@react-native-firebase/app");
  } else if (hasAndroidFirebaseConfig && isAndroidCommand) {
    plugins.push(...firebasePlugins);
  }

  // When iOS Firebase config is missing, exclude Firebase from iOS autolinking
  // to prevent the native FirebaseApp.configure() crash.
  if (!hasIosFirebaseConfig) {
    plugins.push("./plugins/withExcludeFirebaseAutolinking");
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
