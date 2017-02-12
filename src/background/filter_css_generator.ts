module DarkReader {

    export interface FilterConfig {
        mode: FilterMode;
        brightness: number;
        contrast: number;
        grayscale: number;
        sepia: number;
        useFont: boolean;
        fontFamily: string;
        textStroke: number;
        siteList: string[];
        invertListed: boolean;

        // OBSOLETE
        //usefont: boolean;
        //fontfamily: string;
        //textstroke: number;
        //ignorelist: string[];
    }

    export interface ObsoleteFilterConfig {
        usefont: boolean;
        fontfamily: string;
        textstroke: number;
        ignorelist: string[];
    }

    export enum FilterMode {
        light = 0,
        dark = 1
    }

    export var DEFAULT_FILTER_CONFIG: DarkReader.FilterConfig = {
        mode: DarkReader.FilterMode.dark,
        brightness: 110,
        contrast: 90,
        grayscale: 20,
        sepia: 10,
        useFont: false,
        fontFamily: 'Segoe UI',
        textStroke: 0,
        invertListed: false,
        siteList: []
    };

    /**
     * Configurable CSS-generator based on CSS-filters.
     * It creates rule to invert a whole page and creates another rule to revert specific blocks back.
     */
    export class FilterCssGenerator {

        /**
         * Creates configurable CSS-generator based on CSS-filters.
         */
        constructor() {
            // Detect Chromium issue 501582
            var m = navigator.userAgent.toLowerCase().match(/chrom[e|ium]\/([^ ]+)/);
            if (m && m[1]) {
                var chromeVersion = m[1];
                if (chromeVersion >= '45.0.2431.0') {
                    this.issue501582 = true;
                }
            }
        }

        issue501582: boolean;

        /**
         * Generates CSS code.
         * @param config Generator configuration.
         * @param url Web-site address.
         */
        createCssCode(config: FilterConfig, url: string): string {
            var isUrlInDarkList = isUrlInList(url, DARK_SITES);
            var isUrlInUserList = isUrlInList(url, config.siteList);

            if ((isUrlInUserList && config.invertListed)
                || (!isUrlInDarkList
                    && !config.invertListed
                    && !isUrlInUserList)
            ) {
                console.log('Creating CSS for url: ' + url);

                // Search for custom fix
                var fix = getFixesFor(url);

                //
                // Combine CSS

                var parts: string[] = [];

                parts.push('@media screen {');

                // Add leading rule.
                parts.push('\\n/* Leading rule */');
                parts.push(this.createLeadingRule(config));

                if (config.mode === FilterMode.dark)
                    // Add contrary rule
                    if (fix.selectors) {
                        parts.push('\\n/* Contrary rule */');
                        parts.push(this.createContraryRule(config, fix.selectors.join(',\\n')));
                    }

                if (config.useFont || config.textStroke > 0) {
                    // Add text rule
                    parts.push('\\n/* Font */');
                    parts.push(`* ${this.createTextDeclaration(config)}`);
                }

                // Fix bad font hinting after inversion
                parts.push('\\n/* Text contrast */');
                parts.push('html {\\n  text-shadow: 0 0 0 !important;\\n}');

                // TODO: text-stroke is blurry, but need some way to add more contrast to bold text.
                // parts.push('em, strong, b { -webkit-text-stroke: 0.5px; }');

                // Full screen fix
                parts.push('\\n/* Full screen */');
                parts.push('*:-webkit-full-screen, *:-webkit-full-screen * {\\n  -webkit-filter: none !important;\\n}');

                // --- WARNING! HACK! ---
                if (this.issue501582) {
                    // NOTE: Chrome 45 temp <html> background fix
                    // https://code.google.com/p/chromium/issues/detail?id=501582

                    //
                    // Interpolate background color (fastest, no script required).
                    // http://www.w3.org/TR/filter-effects/#brightnessEquivalent

                    // Brightness
                    var value = config.mode === FilterMode.dark ? 0 : 1;
                    value = value * (config.brightness) / 100;

                    // Contrast
                    value = value * (config.contrast) / 100 - (0.5 * config.contrast / 100) + 0.5

                    // Grayscale?

                    // Sepia
                    var rgbaMatrix = [[value], [value], [value], [1]];
                    var sepiaMatrix = Matrix.sepia(config.sepia / 100).slice(0, 4).map(m => m.slice(0, 4));
                    var resultMatrix = multiplyMatrices(sepiaMatrix, rgbaMatrix);
                    var r = resultMatrix[0][0], g = resultMatrix[1][0], b = resultMatrix[2][0];

                    // Result color
                    if (r > 1) r = 1; if (r < 0) r = 0;
                    if (g > 1) g = 1; if (g < 0) g = 0;
                    if (b > 1) b = 1; if (b < 0) b = 0;
                    var color = {
                        r: Math.round(255 * r),
                        g: Math.round(255 * g),
                        b: Math.round(255 * b),
                        toString() { return `rgb(${this.r},${this.g},${this.b})`; }
                    };
                    parts.push('\\n/* Page background */');
                    parts.push(`html {\\n  background: ${color} !important;\\n}`);
                }

                if (fix.rules) {
                    parts.push('\\n/* Custom rules */');
                    parts.push(fix.rules.join('\\n'));
                }

                parts.push('');
                parts.push('}');

                // TODO: Formatting for readability.
                return parts.join('\\n');
            }

            // Site is not inverted
            console.log('Site is not inverted: ' + url);
            return '';
        }

        createSvgCode(config: FilterConfig) {
            var matrix = createFilterMatrix(config);
            var svg = `
<svg id="dark-reader-svg" style="display:none;">
  <filter id="DarkReader_Filter">
    <feColorMatrix type="matrix"
      values="${matrix.slice(0, 4).map(m => m.map(m => m.toFixed(3)).join(' ')).join('\n')}" />
  </filter>
  <filter id="DarkReader_ContraryFilter">
    <feColorMatrix type="matrix"
      values="${Matrix.invertNHue().slice(0, 4).map(m => m.map(m => m.toFixed(3)).join(' ')).join('\n')}" />
  </filter>
</svg>`.trim().replace(/\n/gm, '\\n');
            return svg;
        }


        //-----------------
        // CSS Declarations
        //-----------------

        protected createLeadingRule(config: FilterConfig): string {
            return `html {\\n  -webkit-filter: url(#DarkReader_Filter) !important;\\n}`;
        }

        // Should be used in 'dark mode' only
        protected createContraryRule(config: FilterConfig, selectorsToFix: string): string {
            return `${selectorsToFix} {\\n  -webkit-filter: url(#DarkReader_ContraryFilter) !important;\\n}`;
        }

        // Should be used only if 'usefont' is 'true' or 'stroke' > 0
        protected createTextDeclaration(config: FilterConfig): string {
            var result = '{\\n  ';

            if (config.useFont) {
                // TODO: Validate...
                result += !config.fontFamily ? ''
                    : 'font-family: '
                    + config.fontFamily + ' '
                    + '!important; ';
            }

            if (config.textStroke > 0) {
                result += config.textStroke == 0 ? ''
                    : `-webkit-text-stroke: ${config.textStroke}px !important;`;
            }

            result += '\\n}';

            return result;
        }
    }

    // http://stackoverflow.com/a/27205510/4137472
    function multiplyMatrices(m1: number[][], m2: number[][]) {
        var result: number[][] = [];
        for (var i = 0; i < m1.length; i++) {
            result[i] = [];
            for (var j = 0; j < m2[0].length; j++) {
                var sum = 0;
                for (var k = 0; k < m1[0].length; k++) {
                    sum += m1[i][k] * m2[k][j];
                }
                result[i][j] = sum;
            }
        }
        return result;
    }

    function createFilterMatrix(config: FilterConfig) {
        var m = Matrix.identity();
        if (config.sepia !== 0) {
            m = multiplyMatrices(m, Matrix.sepia(config.sepia / 100));
        }
        if (config.grayscale !== 0) {
            m = multiplyMatrices(m, Matrix.grayscale(config.grayscale / 100));
        }
        if (config.contrast !== 100) {
            m = multiplyMatrices(m, Matrix.contrast(config.contrast / 100));
        }
        if (config.brightness !== 100) {
            m = multiplyMatrices(m, Matrix.brightness(config.brightness / 100));
        }
        if (config.mode === FilterMode.dark) {
            m = multiplyMatrices(m, Matrix.invertNHue());
        }
        return m;
    }

    var Matrix = {

        identity() {
            return [
                [1, 0, 0, 0, 0],
                [0, 1, 0, 0, 0],
                [0, 0, 1, 0, 0],
                [0, 0, 0, 1, 0],
                [0, 0, 0, 0, 1]
            ];
        },

        invertNHue() {
            return [
                [0.333, -0.667, -0.667, 0, 1],
                [-0.667, 0.333, -0.667, 0, 1],
                [-0.667, -0.667, 0.333, 0, 1],
                [0, 0, 0, 1, 0],
                [0, 0, 0, 0, 1]
            ];
        },

        brightness(v) {
            var s = v - 1;
            return [
                [1, 0, 0, 0, s],
                [0, 1, 0, 0, s],
                [0, 0, 1, 0, s],
                [0, 0, 0, 1, 0],
                [0, 0, 0, 0, 1]
            ];
        },

        contrast(v) {
            var s = v;
            var t = (1 - s) / 2;
            return [
                [s, 0, 0, 0, t],
                [0, s, 0, 0, t],
                [0, 0, s, 0, t],
                [0, 0, 0, 1, 0],
                [0, 0, 0, 0, 1]
            ];
        },

        sepia(v) {
            return [
                [(0.393 + 0.607 * (1 - v)), (0.769 - 0.769 * (1 - v)), (0.189 - 0.189 * (1 - v)), 0, 0],
                [(0.349 - 0.349 * (1 - v)), (0.686 + 0.314 * (1 - v)), (0.168 - 0.168 * (1 - v)), 0, 0],
                [(0.272 - 0.272 * (1 - v)), (0.534 - 0.534 * (1 - v)), (0.131 + 0.869 * (1 - v)), 0, 0],
                [0, 0, 0, 1, 0],
                [0, 0, 0, 0, 1]
            ];
        },

        grayscale(v) {
            return [
                [(0.2126 + 0.7874 * (1 - v)), (0.7152 - 0.7152 * (1 - v)), (0.0722 - 0.0722 * (1 - v)), 0, 0],
                [(0.2126 - 0.2126 * (1 - v)), (0.7152 + 0.2848 * (1 - v)), (0.0722 - 0.0722 * (1 - v)), 0, 0],
                [(0.2126 - 0.2126 * (1 - v)), (0.7152 - 0.7152 * (1 - v)), (0.0722 + 0.9278 * (1 - v)), 0, 0],
                [0, 0, 0, 1, 0],
                [0, 0, 0, 0, 1]
            ];
        },
    }
} 