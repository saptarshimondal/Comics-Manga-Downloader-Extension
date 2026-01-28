const path = require('path');
const fs = require('fs');
const webpack = require('webpack');
const DIST_DIR = path.resolve(__dirname, 'dist');
const SRC_DIR = path.resolve(__dirname, 'src');
const ASSET_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'eot', 'otf', 'svg', 'ttf', 'woff', 'woff2'];
const MANIFEST_FILE = 'manifest.json';

const manifestPath = path.join(SRC_DIR, MANIFEST_FILE);

const CleanWebpackPlugin = require("clean-webpack-plugin").CleanWebpackPlugin;
const CopyWebpackPlugin = require("copy-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");

const package = require('./package');

const options = {
	mode: "development",
  performance: {
    hints: false,
    maxAssetSize: 512000,
    maxEntrypointSize: 512000
  },
  devtool: 'cheap-module-source-map',
	entry: {
    popup: path.join(SRC_DIR, "popup", "js", "index.js"),
    background: path.join(SRC_DIR, "background", "index.js"),
    content: path.join(SRC_DIR, "content", "index.js")
  },
  output: {
    path: DIST_DIR,
    filename: "[name].bundle.js",
    publicPath: "/",
  },
  module: {
    rules: [
      {
        test: new RegExp('.(' + ASSET_EXTENSIONS.join('|') + ')$'),
        type: 'asset/resource',
        exclude: /node_modules/
      },
      {
        test: /\.html$/,
        use: ["html-loader"],
        exclude: /node_modules/
      },
      {
        test: /\.(js)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader'
        }
      },
    ]
  },
  plugins: [
  	// clean the dist folder
    new CleanWebpackPlugin({
      cleanStaleWebpackAssets: false
    }),
    new CopyWebpackPlugin(
	    {
	    	patterns: [
	    		{
	      		from: "src/manifest.json",
			      transform: function (content, path) {
			        // generates the manifest file using the package.json informations
			        const manifest = JSON.parse(content.toString())
			        manifest.name = package.displayName || package.name;
			        manifest.version = package.version;
			        manifest.description = package.description;
			        manifest.author = package.author;
			        
			        // Chrome V3: keep service_worker (required for Chrome)
			        // Don't convert to scripts
			        
			        return Buffer.from(JSON.stringify(manifest, null, 2))
			      },
	    		}
	    	]
	    }
    ),
    new CopyWebpackPlugin({
    	patterns: [{
    		from: "src/icon",
    		to: "icon"
    	}]
    }),
    new CopyWebpackPlugin({
    	patterns: [{
    		from: "src/popup/icon",
    		to: "popup/icon"
    	}]
    }),
    new CopyWebpackPlugin({
    	patterns: [{
    		from: "src/popup/css",
    		to: "css"
    	}]
    }),
    new CopyWebpackPlugin({
    	patterns: [{
    		from: "src/popup/images",
    		to: "images"
    	}]
    }),
    new HtmlWebpackPlugin({
      templateContent: fs.readFileSync(path.join(SRC_DIR, "popup", "index.html"), "utf8"),
      filename: "popup.html",
      chunks: ["popup"],
      inject: "body",
      scriptLoading: "blocking",
      publicPath: "./"
    }),
    new webpack.ProvidePlugin({
      browser: 'webextension-polyfill'
    }),

  ],
  externals: {
    canvg: "canvg",
    html2canvas: "html2canvas",
    dompurify: "dompurify"
  }
};

module.exports = options;
