const path = require("path");
const fs = require("fs");
const webpack = require("webpack");

const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");

const DIST_DIR = path.resolve(__dirname, "dist");
const SRC_DIR = path.resolve(__dirname, "src");

const ASSET_EXTENSIONS = [
  "jpg",
  "jpeg",
  "png",
  "gif",
  "eot",
  "otf",
  "svg",
  "ttf",
  "woff",
  "woff2",
];

const pkg = require("./package.json");
const isProd = process.env.NODE_ENV === "production";

module.exports = {
  mode: isProd ? "production" : "development",
  performance: {
    hints: false,
    maxAssetSize: 512000,
    maxEntrypointSize: 512000,
  },
  devtool: isProd ? "source-map" : "cheap-module-source-map",

  entry: {
    popup: path.join(SRC_DIR, "popup", "js", "index.js"),
    background: path.join(SRC_DIR, "background", "index.js"),
    content: path.join(SRC_DIR, "content", "index.js"),
  },

  output: {
    path: DIST_DIR,
    filename: "[name].bundle.js",
    // Extensions should use relative paths
    publicPath: "",
    // Avoid global-object shims that can trigger eval-like patterns
    globalObject: "globalThis",
  },

  optimization: {
    splitChunks: false,
    runtimeChunk: false,
  },

  module: {
    rules: [
      {
        test: new RegExp(`\\.(${ASSET_EXTENSIONS.join("|")})$`),
        type: "asset/resource",
        exclude: /node_modules/,
      },
      {
        test: /\.html$/,
        use: ["html-loader"],
        exclude: /node_modules/,
      },
      {
        test: /\.(js)$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
        },
      },
    ],
  },

  plugins: [
    new CleanWebpackPlugin({
      cleanStaleWebpackAssets: false,
    }),

    // Build Firefox-specific manifest from manifest.base.json
    new CopyWebpackPlugin({
      patterns: [
        {
          from: "src/manifest.base.json",
          to: "manifest.json",
          transform(content) {
            const manifest = JSON.parse(content.toString());

            // Fill from package.json
            manifest.name = pkg.displayName || pkg.name;
            manifest.version = pkg.version;
            manifest.description = pkg.description;
            manifest.author = pkg.author;

            // Firefox MV3 AMO requirements
            manifest.browser_specific_settings = {
              gecko: {
                id: "comics-manga-downloader@saptarshimondal",
                strict_min_version: "140.0",
                data_collection_permissions: {
                  required: ["none"],
                },
              },
            };

            // web-ext lint / AMO currently rejects service_worker in your setup:
            // Convert background.service_worker -> background.scripts
            if (manifest.background?.service_worker) {
              manifest.background = {
                scripts: [manifest.background.service_worker],
              };
            }

            return Buffer.from(JSON.stringify(manifest, null, 2));
          },
        },
      ],
    }),

    // Static assets
    new CopyWebpackPlugin({
      patterns: [
        { from: "src/icon", to: "icon" },
        { from: "src/popup/icon", to: "popup/icon" },
        { from: "src/popup/css", to: "css" },
        { from: "src/popup/images", to: "images" },
      ],
    }),

    // Popup HTML
    new HtmlWebpackPlugin({
      templateContent: fs.readFileSync(
        path.join(SRC_DIR, "popup", "index.html"),
        "utf8"
      ),
      filename: "popup.html",
      chunks: ["popup"],
      inject: "body",
      scriptLoading: "blocking",
      publicPath: "./",
    }),

    // Provide webextension-polyfill as `browser`
    new webpack.ProvidePlugin({
      browser: "webextension-polyfill",
    }),
  ],

  externals: {
    canvg: "canvg",
    html2canvas: "html2canvas",
    dompurify: "dompurify",
  },
};
