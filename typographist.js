const { typographist, ratios } = require('typographist');

module.exports = () => ({
    plugins: [
        typographist({
            base: '18px',
            lineHeight: 1.5,
            ratio: ratios.MINOR_THIRD
        })
    ]
});