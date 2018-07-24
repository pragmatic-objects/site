const { typographist, ratios } = require('typographist');

module.exports = () => ({
    plugins: [
        typographist({
            base: '12px',
            lineHeight: 1.5,
            ratio: ratios.MAJOR_SECOND,
            mobile: {
                breakpoint: '320px',
                base: '14px',
                ratio: ratios.MINOR_THIRD
            },
            tablet: {
                breakpoint: '768px',
                base: '16px',
                ratio: ratios.MINOR_THIRD
            },
            desktop: {
                breakpoint: '1000px',
                base: '18px',
                ratio: ratios.MINOR_THIRD
            }
        })
    ]
});