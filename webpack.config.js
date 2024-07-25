const path = require('path');
const WebpackMd5Hash = require('webpack-md5-hash');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const SshWebpackPlugin = require('ssh-webpack-plugin');

module.exports = {
    entry: {
        server: ['@babel/polyfill', path.resolve(__dirname, './index.js')]
    },
    output: {
        path: path.resolve(__dirname, 'dist'),
        publicPath: '/',
        filename: '[name].bundle.js'
    },
    target: 'node',
    node: {
        // Need this when working with express, otherwise the build fails
        __dirname: false, // if you don't put this is, __dirname
        __filename: false // and __filename return blank or /
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader'
                }
            }
        ]
    },
    plugins: [
        new CleanWebpackPlugin(),
        new CopyWebpackPlugin([
            { from: path.join(__dirname, './package.json'), to: './package.json' }
        ]),
        new CopyWebpackPlugin([
            { from: path.join(__dirname, './ecosystem.config.js'), to: './ecosystem.config.js' }
        ]),
        new SshWebpackPlugin({
            host: '5.45.116.160',
            port: '22',
            username: 'admin',
            privateKey: require('fs').readFileSync(path.resolve('../../.ssh', 'id_rsa')),
            from: path.join(__dirname, './dist'),
            to: '/home/admin/nodomain/radiorecord',
            after: 'pm2 restart radiorecord'
        }),
        new WebpackMd5Hash()
    ]
};
