/**
 * Expo config plugin that modifies the iOS Podfile to exclude
 * @react-native-firebase packages from autolinking when
 * GoogleService-Info.plist is not present.
 */
const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

function withExcludeFirebaseAutolinking(config) {
  return withDangerousMod(config, [
    "ios",
    (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        "Podfile"
      );
      let podfile = fs.readFileSync(podfilePath, "utf8");

      // Check if Firebase exclusions are already present
      if (podfile.includes("@react-native-firebase")) {
        console.log(
          "[withExcludeFirebaseAutolinking] Firebase exclusions already present"
        );
        return config;
      }

      // Add --exclude flags to the expo-modules-autolinking react-native-config command
      const oldCommand = `      '--platform',\n      'ios'\n    ]`;
      const newCommand = `      '--platform',\n      'ios',\n      '--exclude',\n      '@react-native-firebase/app',\n      '@react-native-firebase/messaging'\n    ]`;

      if (podfile.includes(oldCommand)) {
        podfile = podfile.replace(oldCommand, newCommand);
        fs.writeFileSync(podfilePath, podfile, "utf8");
        console.log(
          "[withExcludeFirebaseAutolinking] Excluded Firebase from iOS autolinking"
        );
      } else {
        console.warn(
          "[withExcludeFirebaseAutolinking] Could not find autolinking config command in Podfile. " +
            "Attempting regex fallback..."
        );
        // Regex fallback: match the '--platform', 'ios' pattern with flexible whitespace
        const regex = /('--platform',\s*\n\s*'ios'\s*\n\s*\])/;
        if (regex.test(podfile)) {
          podfile = podfile.replace(
            regex,
            `'--platform',\n      'ios',\n      '--exclude',\n      '@react-native-firebase/app',\n      '@react-native-firebase/messaging'\n    ]`
          );
          fs.writeFileSync(podfilePath, podfile, "utf8");
          console.log(
            "[withExcludeFirebaseAutolinking] Excluded Firebase via regex fallback"
          );
        } else {
          console.error(
            "[withExcludeFirebaseAutolinking] Failed to patch Podfile"
          );
        }
      }

      return config;
    },
  ]);
}

module.exports = withExcludeFirebaseAutolinking;
