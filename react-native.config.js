const fs = require("fs");

const hasIosFirebaseConfig = fs.existsSync("./GoogleService-Info.plist");

module.exports = {
  dependencies: {
    // Disable Firebase autolinking on iOS when GoogleService-Info.plist is missing.
    // The native module calls FirebaseApp.configure() in the AppDelegate,
    // which crashes if the plist isn't present.
    "@react-native-firebase/app": {
      platforms: {
        ios: hasIosFirebaseConfig ? undefined : null,
      },
    },
    "@react-native-firebase/messaging": {
      platforms: {
        ios: hasIosFirebaseConfig ? undefined : null,
      },
    },
  },
};
