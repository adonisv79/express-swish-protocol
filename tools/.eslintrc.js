'use strict';

module.exports = {
  "extends": "airbnb-base",
  "rules": {
    "no-console": "off",
    "no-else-return": ["error", { "allowElseIf": true }],
    "import/no-extraneous-dependencies": ["error", {"devDependencies": true, "optionalDependencies": false, "peerDependencies": false}]
  }
};