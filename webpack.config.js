const path = require('path');
const webpack = require('webpack');
const DIST_DIR = path.resolve(__dirname, 'dist');
const SRC_DIR = path.resolve(__dirname, 'src');
const ASSET_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'eot', 'otf', 'svg', 'ttf', 'woff', 'woff2'];
const MANIFEST_FILE = 'manifest.json';

const manifestPath = path.join(SRC_DIR, MANIFEST_FILE);

const CleanWebpackPlugin = require("clean-webpack-plugin").CleanWebpackPlugin;
const CopyWebpackPlugin = require("copy-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
// const WriteFilePlugin = require("write-file-webpack-plugin");

const package = require('./package');

const options = {
	mode: "development",
  /*performance: {
    hints: false
  },*/
  devtool: 'cheap-module-source-map', // to fix EvalError
	entry: {
    popup: path.join(SRC_DIR, "popup", "js", "index.js"),
    // options: path.join(SRC_DIR, "options", "index.js"),
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
      /*{
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
        exclude: /node_modules/
      },*/
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
			        manifest.name = package.name;
			        manifest.version = package.version;
			        manifest.description = package.description;
			        manifest.author = package.author;
			        
			        // Firefox compatibility: Firefox doesn't fully support service_worker in V3 yet
			        // Convert service_worker to scripts for Firefox compatibility
			        // Chrome will still work with scripts in V3 (though service_worker is preferred)
			        if (manifest.background && manifest.background.service_worker) {
			          manifest.background.scripts = [manifest.background.service_worker];
			          delete manifest.background.service_worker;
			        }
			        
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
    		to: "popup/css"
    	}]
    }),
    new CopyWebpackPlugin({
    	patterns: [{
    		from: "src/popup/js/select2",
    		to: "popup/js/select2"
    	}]
    }),
    new CopyWebpackPlugin({
    	patterns: [{
    		from: "src/popup/js/jquery.min.js",
    		to: "popup/js/jquery.min.js"
    	}]
    }),
    new HtmlWebpackPlugin({
      template: path.join(SRC_DIR, "popup", "index.html"),
      filename: "popup.html",
      chunks: ["popup"]
    }),
    /*new HtmlWebpackPlugin({
      template: path.join(SRC_DIR, "options", "index.html"),
      filename: "options.html",
      chunks: ["options"]
    }),*/
    /*new HtmlWebpackPlugin({
      template: path.join(SRC_DIR, "background.html"),
      filename: "background.html",
      chunks: ["background"]
    }),*/
    // new WriteFilePlugin(),
    new webpack.ProvidePlugin({
      browser: 'webextension-polyfill'
    }),

  ],
  externals: {
    // only define the dependencies you are NOT using as externals!
    canvg: "canvg",
    html2canvas: "html2canvas",
    dompurify: "dompurify"
  }
};

module.exports = options;