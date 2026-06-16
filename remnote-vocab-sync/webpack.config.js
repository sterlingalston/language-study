const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { BannerPlugin } = require('webpack');

const SANDBOX_SUFFIX = '-sandbox';

module.exports = {
  mode: 'development',
  devServer: {
    port: 9001,
    hot: false,
    compress: true,
    static: { directory: path.resolve(__dirname, 'dist') },
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
    },
  },
  entry: {
    index: './src/widgets/index.tsx',
    [`index${SANDBOX_SUFFIX}`]: './src/widgets/index.tsx',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    publicPath: '',
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  plugins: [
    new HtmlWebpackPlugin({
      templateContent: `
<body></body>
<script type="text/javascript">
const urlSearchParams = new URLSearchParams(window.location.search);
const queryParams = Object.fromEntries(urlSearchParams.entries());
const widgetName = queryParams["widgetName"];
if (widgetName == undefined) { document.body.innerHTML += "Widget ID not specified."; }
const s = document.createElement('script');
s.type = "module";
s.src = widgetName + "${SANDBOX_SUFFIX}.js";
document.body.appendChild(s);
</script>
`,
      filename: 'index.html',
      inject: false,
    }),
    new BannerPlugin({
      banner: (file) =>
        !file.chunk.name.includes(SANDBOX_SUFFIX) ? 'const IMPORT_META=import.meta;' : '',
      raw: true,
    }),
  ],
};
