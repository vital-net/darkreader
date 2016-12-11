export interface Rgb {
    r: number;
    g: number;
    b: number;
}
export interface Rgba extends Rgb {
    a: number;
}

export interface Hsb {
    h: number;
    s: number;
    b: number;
}

export interface Hsl {
    h: number;
    s: number;
    l: number;
}
export interface Hsla extends Hsl {
    a: number;
}

export interface Cmyk {
    c: number;
    m: number;
    y: number;
    k: number;
}

export function hsbToRgb(hsb: Hsb) {
    if (hsb.h < 0 ||
        hsb.h > 360 ||
        hsb.s < 0 ||
        hsb.s > 1 ||
        hsb.b < 0 ||
        hsb.b > 1
    ) {
        throw new Error(
            `Unable to convert color: hue = ${hsb.h}, saturation = ${hsb.s}, brightness = ${hsb.b}.`
        );
    }

    // Apply hue
    var rh: Rgb;
    if (hsb.h < 60) {
        rh = {
            r: 255,
            g: Math.round(hsb.h / 60 * 255),
            b: 0
        };
    } else if (hsb.h < 120) {
        rh = {
            r: Math.round((120 - hsb.h) / 60 * 255),
            g: 255,
            b: 0
        };
    } else if (hsb.h < 180) {
        rh = {
            r: 0,
            g: 255,
            b: Math.round((hsb.h - 120) / 60 * 255)
        };
    } else if (hsb.h < 240) {
        rh = {
            r: 0,
            g: Math.round((240 - hsb.h) / 60 * 255),
            b: 255
        };
    } else if (hsb.h < 300) {
        rh = {
            r: Math.round((hsb.h - 240) / 60 * 255),
            g: 0,
            b: 255
        };
    } else if (hsb.h <= 360) {
        rh = {
            r: 255,
            g: 0,
            b: Math.round((360 - hsb.h) / 60 * 255)
        };
    }

    // Apply saturation
    var max = Math.max(rh.r, rh.g, rh.b);
    var rs: Rgb = {
        r: rh.r + (max - rh.r) * (1 - hsb.s),
        g: rh.g + (max - rh.g) * (1 - hsb.s),
        b: rh.b + (max - rh.b) * (1 - hsb.s)
    };

    // Apply brightness
    var rb: Rgb = {
        r: rs.r * hsb.b,
        g: rs.g * hsb.b,
        b: rs.b * hsb.b
    };

    var result: Rgb = {
        r: Math.round(rb.r),
        g: Math.round(rb.g),
        b: Math.round(rb.b)
    };
    return result;
}

export function rgbToHsb(rgb: Rgb): Hsb {
    var max = Math.max(rgb.r, rgb.g, rgb.b);
    var min = Math.min(rgb.r, rgb.g, rgb.b);

    // Hue
    var hue: number;
    if (max === min) {
        hue = 0;
    } else if (max === rgb.r && rgb.g >= rgb.b) {
        hue = 60 * (rgb.g - rgb.b) / (max - min);
    } else if (max === rgb.r && rgb.g < rgb.b) {
        hue = 60 * (rgb.g - rgb.b) / (max - min) + 360;
    } else if (max === rgb.g) {
        hue = 60 * (rgb.b - rgb.r) / (max - min) + 120;
    } else if (max === rgb.b) {
        hue = 60 * (rgb.r - rgb.g) / (max - min) + 240;
    } else {
        throw new Error(`Unable to convert color: red = ${rgb.r}, green = ${rgb.g}, blue = ${rgb.b}.`);
    }

    // Saturation
    var saturation: number;
    if (max === 0) {
        saturation = 0;
    } else {
        saturation = (1 - min / max);
    }

    // Brightness
    var brightness = (max / 255);

    var result: Hsb = {
        h: hue,
        s: saturation,
        b: brightness
    };

    return result;
}

export function rgbaToHsla(rgba: Rgba): Hsla {
    var hsb = rgbToHsb(rgba);
    var l = ((2 - hsb.s) * hsb.b / 2);
    var s = (l === 0 || l === 1 ?
        0 :
        (hsb.s * hsb.b / (l < 0.5 ? l : (1 - l)) / 2)
    );
    return {
        h: hsb.h,
        s: s,
        l: l,
        a: rgba.a
    };
}

export var regexps = {
    rgb: /^\s*rgb\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)\s*$/,
    rgba: /^\s*rgba\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d?\.?\d*)\s*\)\s*$/,
    hexShort: /^\s*#([\dA-Fa-f])([\dA-Fa-f])([\dA-Fa-f])\s*$/,
    hex: /^\s*#([\dA-Fa-f]{2})([\dA-Fa-f]{2})([\dA-Fa-f]{2})\s*$/
};

export function parse(color: string): Rgba {
    var matches: string[];

    var rgba: Rgba;
    if (color === 'transparent') {
        rgba = { r: 0, g: 0, b: 0, a: 0 };
    } else if (matches = color.match(regexps.rgb)) {
        rgba = {
            r: parseInt(matches[1], 10),
            g: parseInt(matches[2], 10),
            b: parseInt(matches[3], 10),
            a: 1
        };
    } else if (matches = color.match(regexps.rgba)) {
        rgba = {
            r: parseInt(matches[1], 10),
            g: parseInt(matches[2], 10),
            b: parseInt(matches[3], 10),
            a: parseFloat(matches[4])
        };
    } else if (matches = color.match(regexps.hexShort)) {
        rgba = {
            r: parseInt(matches[1] + matches[1], 16),
            g: parseInt(matches[2] + matches[2], 16),
            b: parseInt(matches[3] + matches[3], 16),
            a: 1
        };
    } else if (matches = color.match(regexps.hex) ||
        (NamedColors[color] && (matches = NamedColors[color].match(regexps.hex)))
    ) {
        rgba = {
            r: parseInt(matches[1], 16),
            g: parseInt(matches[2], 16),
            b: parseInt(matches[3], 16),
            a: 1
        };
    } else {
        throw new Error(`Color ${color} is not valid.`);
    }

    if (rgba.r < 0 ||
        rgba.r > 255 ||
        rgba.g < 0 ||
        rgba.g > 255 ||
        rgba.b < 0 ||
        rgba.b > 255 ||
        rgba.a < 0 ||
        rgba.a > 1
    ) {
        throw new Error(`Color ${color} is not valid.`);
    }

    return rgba;
}

function isRgba(color) {
    var sum = (color.a + color.r + color.g + color.b);
    return (sum >= 0 && sum <= 255 * 4);
}

export function areEqual(color1: string | Rgba, color2: string | Rgba) {
    var c1: Rgba;
    var c2: Rgba;
    if (typeof color1 === 'string') {
        c1 = parse(color1);
    } else if (isRgba(color1)) {
        c1 = color1;
    } else {
        throw new Error('Invalid color.');
    }
    if (typeof color2 === 'string') {
        c2 = parse(color2);
    } else if (isRgba(color2)) {
        c2 = color2;
    } else {
        throw new Error('Invalid color.');
    }
    return (
        (c1.r === c2.r) &&
        (c1.g === c2.g) &&
        (c1.b === c2.b) &&
        (c1.a === c2.a)
    );
}

// https://gist.github.com/felipesabino/5066336
// TODO: Use some color profile?
export function rgbToCmyk(rgb: Rgb) {
    var result = <Cmyk>{};

    var r = (rgb.r / 255);
    var g = (rgb.g / 255);
    var b = (rgb.b / 255);

    result.k = Math.min(1 - r, 1 - g, 1 - b);
    result.c = (1 - r - result.k) / (1 - result.k);
    result.m = (1 - g - result.k) / (1 - result.k);
    result.y = (1 - b - result.k) / (1 - result.k);

    result.c = Math.round(result.c * 100);
    result.m = Math.round(result.m * 100);
    result.y = Math.round(result.y * 100);
    result.k = Math.round(result.k * 100);

    return result;
}

function round(num, d = 1) {
    return (Math.round(num / d) * d);
}

export function rgbToString(rgb: Rgb) {
    return `rgb(${rgb.r},${rgb.g},${rgb.b})`;
}
export function rgbaToString(rgba: Rgba) {
    return `rgba(${rgba.r},${rgba.g},${rgba.b},${round(rgba.a, 0.01)})`;
}

export function hslToString(hsl: Hsl) {
    return `hsl(${round(hsl.h)},${round(hsl.s * 100)}%,${round(hsl.l * 100)})%`;
}
export function hslaToString(hsla: Hsla) {
    return `hsla(${round(hsla.h)},${round(hsla.s * 100)}%,${round(hsla.l * 100)}%,${round(hsla.a, 0.01)})`;
}

function hex(n: number, digits: number) {
    var result = n.toString(16);
    if (digits && result.length < digits) {
        for (var i = 0; i < digits - result.length; i++) {
            result = '0' + result;
        }
    }
    return result;
}

export function rgbToHexString(rgb: Rgb) {
    return `#${hex(rgb.r, 2)}${hex(rgb.g, 2)}${hex(rgb.b, 2)}`.toUpperCase();
}

const NamedColors: { [name: string]: string } = {
    'aliceblue': '#f0f8ff',
    'antiquewhite': '#faebd7',
    'aqua': '#00ffff',
    'aquamarine': '#7fffd4',
    'azure': '#f0ffff',
    'beige': '#f5f5dc',
    'bisque': '#ffe4c4',
    'black': '#000000',
    'blanchedalmond': '#ffebcd',
    'blue': '#0000ff',
    'blueviolet': '#8a2be2',
    'brown': '#a52a2a',
    'burlywood': '#deb887',
    'cadetblue': '#5f9ea0',
    'chartreuse': '#7fff00',
    'chocolate': '#d2691e',
    'coral': '#ff7f50',
    'cornflowerblue': '#6495ed',
    'cornsilk': '#fff8dc',
    'crimson': '#dc143c',
    'cyan': '#00ffff',
    'darkblue': '#00008b',
    'darkcyan': '#008b8b',
    'darkgoldenrod': '#b8860b',
    'darkgray': '#a9a9a9',
    'darkgreen': '#006400',
    'darkgrey': '#a9a9a9',
    'darkkhaki': '#bdb76b',
    'darkmagenta': '#8b008b',
    'darkolivegreen': '#556b2f',
    'darkorange': '#ff8c00',
    'darkorchid': '#9932cc',
    'darkred': '#8b0000',
    'darksalmon': '#e9967a',
    'darkseagreen': '#8fbc8f',
    'darkslateblue': '#483d8b',
    'darkslategray': '#2f4f4f',
    'darkslategrey': '#2f4f4f',
    'darkturquoise': '#00ced1',
    'darkviolet': '#9400d3',
    'deeppink': '#ff1493',
    'deepskyblue': '#00bfff',
    'dimgray': '#696969',
    'dimgrey': '#696969',
    'dodgerblue': '#1e90ff',
    'firebrick': '#b22222',
    'floralwhite': '#fffaf0',
    'forestgreen': '#228b22',
    'fuchsia': '#ff00ff',
    'gainsboro': '#dcdcdc',
    'ghostwhite': '#f8f8ff',
    'gold': '#ffd700',
    'goldenrod': '#daa520',
    'gray': '#808080',
    'green': '#008000',
    'greenyellow': '#adff2f',
    'grey': '#808080',
    'honeydew': '#f0fff0',
    'hotpink': '#ff69b4',
    'indianred ': '#cd5c5c',
    'indigo': '#4b0082',
    'ivory': '#fffff0',
    'khaki': '#f0e68c',
    'lavender': '#e6e6fa',
    'lavenderblush': '#fff0f5',
    'lawngreen': '#7cfc00',
    'lemonchiffon': '#fffacd',
    'lightblue': '#add8e6',
    'lightcoral': '#f08080',
    'lightcyan': '#e0ffff',
    'lightgoldenrodyellow': '#fafad2',
    'lightgray': '#d3d‌​3d3',
    'lightgreen': '#90ee90',
    'lightgrey': '#d3d3d3',
    'lightpink': '#ffb6c1',
    'lightsalmon': '#ffa07a',
    'lightseagreen': '#20b2aa',
    'lightskyblue': '#87cefa',
    'lightslategray': '#778899',
    'lightslategrey': '#778899',
    'lightsteelblue': '#b0c4de',
    'lightyellow': '#ffffe0',
    'lime': '#00ff00',
    'limegreen': '#32cd32',
    'linen': '#faf0e6',
    'magenta': '#ff00ff',
    'maroon': '#800000',
    'mediumaquamarine': '#66cdaa',
    'mediumblue': '#0000cd',
    'mediumorchid': '#ba55d3',
    'mediumpurple': '#9370d8',
    'mediumseagreen': '#3cb371',
    'mediumslateblue': '#7b68ee',
    'mediumspringgreen': '#00fa9a',
    'mediumturquoise': '#48d1cc',
    'mediumvioletred': '#c71585',
    'midnightblue': '#191970',
    'mintcream': '#f5fffa',
    'mistyrose': '#ffe4e1',
    'moccasin': '#ffe4b5',
    'navajowhite': '#ffdead',
    'navy': '#000080',
    'oldlace': '#fdf5e6',
    'olive': '#808000',
    'olivedrab': '#6b8e23',
    'orange': '#ffa500',
    'orangered': '#ff4500',
    'orchid': '#da70d6',
    'palegoldenrod': '#eee8aa',
    'palegreen': '#98fb98',
    'paleturquoise': '#afeeee',
    'palevioletred': '#d87093',
    'papayawhip': '#ffefd5',
    'peachpuff': '#ffdab9',
    'peru': '#cd853f',
    'pink': '#ffc0cb',
    'plum': '#dda0dd',
    'powderblue': '#b0e0e6',
    'purple': '#800080',
    'red': '#ff0000',
    'rosybrown': '#bc8f8f',
    'royalblue': '#4169e1',
    'saddlebrown': '#8b4513',
    'salmon': '#fa8072',
    'sandybrown': '#f4a460',
    'seagreen': '#2e8b57',
    'seashell': '#fff5ee',
    'sienna': '#a0522d',
    'silver': '#c0c0c0',
    'skyblue': '#87ceeb',
    'slateblue': '#6a5acd',
    'slategray': '#708090',
    'slategrey': '#708090',
    'snow': '#fffafa',
    'springgreen': '#00ff7f',
    'steelblue': '#4682b4',
    'tan': '#d2b48c',
    'teal': '#008080',
    'thistle': '#d8bfd8',
    'tomato': '#ff6347',
    'turquoise': '#40e0d0',
    'violet': '#ee82ee',
    'wheat': '#f5deb3',
    'white': '#ffffff',
    'whitesmoke': '#f5f5f5',
    'yellow': '#ffff00',
    'yellowgreen': '#9acd32'
};