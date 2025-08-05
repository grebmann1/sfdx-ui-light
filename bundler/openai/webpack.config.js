const path = require('path');

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
    //sourceMapFilename: 'bundle.min.js.map',
  },
  //devtool: 'source-map',
  resolve: {
    extensions: ['.js', '.json'],
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
              ['@babel/plugin-proposal-class-properties', { loose: true }],
              ['@babel/plugin-proposal-private-methods', { loose: true }],
              ['@babel/plugin-transform-private-methods', { loose: true }]
            ]
          },
        },
      },
      {
        test: /\.json$/,
        type: 'json',
      },
    ],
  },
  externals: {},
}; 