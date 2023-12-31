const { execSync } = require("child_process");

execSync(`ncc build ./targets --source-map --license LICENSE -o ./lib && act -j debug -s GITHUB_TOKEN=${process.env.GITHUB_TOKEN}`, { stdio: 'inherit' })