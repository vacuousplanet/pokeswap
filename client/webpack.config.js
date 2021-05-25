const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');

// Electron Webpack config
const electronConfiguration = {
    // Build Mode
    mode: 'development',
    // Electron Entrypoint
    entry: './src/main/index.ts',
    target: 'electron-main',
    // helpful navigation shortcuts
    resolve: {
        alias: {
            ['@']: path.resolve(__dirname, 'src', 'main')
        },
        extensions: ['.tsx', '.ts', '.js'],
    },
    module: {
        rules: [{
            test: /\.ts$/,
            include: /src/,
            use: [{ loader: 'ts-loader' }]
        }]
    },
    output: {
        path: __dirname + '/build',
        filename: 'main.js'
    }
  }
  
// React webpack config
const reactConfiguration = {
    mode: 'development',
    entry: './src/renderer/renderer.tsx',
    target: 'electron-renderer',
    devtool: 'source-map',
    resolve: {
        alias: {
            ['@']: path.resolve(__dirname, 'src', 'renderer')
        },
        extensions: ['.tsx', '.ts', '.js'],
    },
    module: {
        rules: [
            {
                test: /\.ts(x?)$/,
                include: /src/,
                use: [{ loader: 'ts-loader' }]
            },
            {
                test: /\.s[ac]ss$/i,
                use: [
                    'style-loader',
                    'css-loader',
                    'sass-loader',
                ],
            }
        ]
    },
    output: {
        path: __dirname + '/build',
        filename: 'renderer.js'
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: path.resolve(__dirname, 'src', 'renderer', 'index.html')
        })
    ]
  }

module.exports = [
    electronConfiguration,
    reactConfiguration
];
