module.exports = {
    apps: [
        {
            name: 'radiorecord',
            script: './server.bundle.js',
            watch: false,
            instance_var: 'INSTANCE_ID',
            env: {
                NODE_ENV: 'production'
            }
        }
    ]
};
