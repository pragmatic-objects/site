const { typographist, ratios } = require('typographist');

module.exports = () => ({
    plugins: [
        typographist({
            base: '12px',
            lineHeight: 1.5, 
            ratio: ratios.GOLDEN_SECTION,
            mobile: {
                breakpoint: '20em',
                base: '14px',
                ratio: ratios.GOLDEN_SECTION
            },
            tablet: {
                breakpoint: '48em',
                base: '16px',
                ratio: ratios.GOLDEN_SECTION
            },
            desktop: {
                breakpoint: '64em',
                base: '18px',
                ratio: ratios.GOLDEN_SECTION
            }
        })
    ]
});
