const path = require('path');
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');

module.exports = {
  mode: 'production',
  entry: './index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.min.js',
    library: 'OpenAIAgentsBundle',
    libraryTarget: 'umd',
    globalObject: 'this',
    umdNamedDefine: true,
    //sourceMapFilename: 'bundle.js.map',
  },
  optimization: {
    minimize: false
  },
  //devtool: 'source-map',
  resolve: {
    extensions: ['.js', '.json', '.mjs'],
    fallback: {
      "crypto": require.resolve("crypto-browserify"),
      "stream": require.resolve("stream-browserify"),
      "buffer": require.resolve("buffer/index.js"),
      "assert": require.resolve("assert/"),
      "http": require.resolve("stream-http"),
      "https": require.resolve("https-browserify"),
      "os": require.resolve("os-browserify/browser"),
      "url": require.resolve("url/"),
    },
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              [
                '@babel/preset-env',
                {
                  targets: { "ie": "11" },
                }
              ]
            ],
            plugins: [
              /* ['@babel/plugin-proposal-class-properties', { loose: true }],
              ['@babel/plugin-proposal-private-methods', { loose: true }],
              ['@babel/plugin-transform-private-methods', { loose: true }] */
            ]
          },
        },
      },
      {
        test: /\.json$/,
        type: 'json',
      },
      {
        test: /\.mjs$/,
        resolve: {
          fullySpecified: false
        }
      },
    ],
  },
  plugins: [
    new NodePolyfillPlugin()
  ],
  externals: {},
}; 