const { config } = require("@swc/core/spack");

module.exports = config({
    output: {
        path: __dirname + "/lib",
    },
    mode: "production",
    entry: __dirname + "/src/index.ts",
    module: {

    },
    target: "node"
});