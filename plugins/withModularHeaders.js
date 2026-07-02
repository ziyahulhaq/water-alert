const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * Expo config plugin that adds `use_modular_headers!` to the iOS Podfile.
 * Required for Firebase Swift pods (FirebaseCoreInternal → GoogleUtilities).
 */
module.exports = function withModularHeaders(config) {
  return withDangerousMod(config, [
    "ios",
    async (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, "Podfile");

      if (fs.existsSync(podfilePath)) {
        let contents = fs.readFileSync(podfilePath, "utf-8");

        if (!contents.includes("use_modular_headers!")) {
          contents = contents.replace(
            "prepare_react_native_project!",
            `prepare_react_native_project!\n\n# Required for Firebase Swift pods (FirebaseCoreInternal → GoogleUtilities)\nuse_modular_headers!`
          );
          fs.writeFileSync(podfilePath, contents);
        }
      }

      return cfg;
    },
  ]);
};
