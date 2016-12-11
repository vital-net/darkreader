import { parse, rgbaToHsla, hslaToString, Hsla } from '../utils/color';
import { toArray, toCamelCase } from '../utils/misc';

const STYLE_ID = 'dark-reader-style';
const defaultStyleSheet = `
html, body, button, input, textarea {
    background-color: black !important;
    color: white !important;
}
input::placeholder {
    color: rgba(255, 255, 255, 0.75);
}
`;

function iterateRules(callback: (r: CSSPageRule) => void, ) {
    toArray(document.styleSheets)
        .filter((d) => Boolean((<any>d).rules))
        .forEach((d) => {
            toArray((<any>d).rules).forEach(callback);
        });
}

function iterateMissingStyleSheets(callback: (s: CSSStyleSheet) => void) {
    toArray(document.styleSheets)
        .filter((d) => !(<any>d).rule && d.href)
        .forEach(callback);
}

function modifyBackgroundColor(hsla: Hsla) {
    if (hsla.l > 0.5) {
        hsla.l = (1 - hsla.l);
    }
    hsla.l = Math.min(0.25, hsla.l);
}

function modifyBorderColor(hsla: Hsla) {
    hsla.l = (1 - hsla.l);
}

function modifyTextColor(hsla: Hsla) {
    if (hsla.l < 0.5) {
        hsla.l = (1 - hsla.l);
    }
    hsla.l = Math.max(0.75, hsla.l);
}

function getColorStyleValue(prop: string, value: string) {
    var result = value;
    if ([
        'inherit',
        'transparent',
        'initial',
        'currentcolor'
    ].indexOf(value.toLowerCase()) < 0) {
        try {
            var rgba = parse(value);
            var hsla = rgbaToHsla(rgba);

            if (prop.indexOf('background') >= 0) {
                modifyBackgroundColor(hsla);
            } else if (prop.indexOf('border') >= 0) {
                modifyBorderColor(hsla);
            } else {
                modifyTextColor(hsla);
            }

            result = hslaToString(hsla);
        } catch (e) {
            console.log((<Error>e).message);
        }
    }
    result += ' !important';
    return result;
}

function getGradientValue(prop: string, value: string) {
    var result = value;
    try {
        var match = /(^.*?gradient\s*\(\s*)(.*?)(\s*\)\s*$)/.exec(value);
        if (match && match.length === 4) {
            var result = match[1] + match[2]
                .split(/,(?!\s*\d)/g)
                .map((s) => {
                    s = s.trim();
                    if (s.indexOf('to ') === 0 || s.indexOf('deg') > 0) {
                        return s;
                    }
                    var parts = s.replace(/\,\s+/g, ',').split(/\s+/);
                    var value = parts[0];

                    var rgba = parse(value);
                    var hsla = rgbaToHsla(rgba);

                    modifyBackgroundColor(hsla);

                    parts[0] = hslaToString(hsla);

                    return parts.join(' ');
                }).join(', ') + match[3];
        }
    } catch (e) {
        console.log((<Error>e).message);
    }
    result += ' !important';
    return result;
}

function insertStyleSheet() {
    var style = <HTMLStyleElement>document.getElementById(STYLE_ID);
    if (!style) {
        style = document.createElement('style');
        style.type = 'text/css';
        style.id = STYLE_ID;
    }
    style.textContent = '';
    var cssText = defaultStyleSheet;
    iterateRules((r) => {
        var props = {};

        toArray(r.style)
            .forEach((s) => {
                var name = toCamelCase(s);
                var value = r.style[name];
                if (s.indexOf('color') >= 0) {
                    props[s] = getColorStyleValue(s, value);
                }
                if (s.indexOf('background') >= 0 && value.indexOf('gradient') >= 0) {
                    props[s] = getGradientValue(s, value);
                }
            });

        if (Object.keys(props).length > 0) {
            var propsText = Object.keys(props).map(p => `  ${p}: ${props[p]};\n`).join('');
            cssText += `${r.selectorText} {\n${propsText}}\n`;
        }
    });
    style.textContent = cssText;
    document.head.appendChild(style);

    iterateMissingStyleSheets((s) => {
        if (document.head.querySelectorAll(`[data-url="${s.href}"]`).length === 0) {
            chrome.runtime.sendMessage({
                missingStyleSheetUrl: s.href
            }, (response) => {
                console.log('response', response.error);
                if (response.styleSheet) {
                    var style = document.createElement('style');
                    style.type = 'text/css';
                    style.dataset['url'] = s.href;
                    style.textContent = response.styleSheet;
                    document.head.appendChild(style);
                    console.log('Added missing style', s.href);
                }
            });
        }
    });

    console.log('invert');
}

var onReady = () => {
    insertStyleSheet();
    var observer = new MutationObserver((mutations) => {
        if ((mutations.filter((m) => {
            return toArray(m.addedNodes)
                .concat(toArray(m.removedNodes))
                .some((n: Element) => {
                    return (
                        (
                            (n instanceof HTMLStyleElement) ||
                            (n instanceof HTMLLinkElement && n.rel === 'stylesheet')
                        )
                        &&
                        (n.id !== STYLE_ID)
                    );
                });
        }).length > 0)) {
            insertStyleSheet();
        }
    });
    observer.observe(document.head, {
        childList: true
    });
};

if (document.head) {
    onReady();
} else {
    var headObserver = new MutationObserver((mutations) => {
        if (document.head) {
            headObserver.disconnect();
            onReady();
        }
    });
    headObserver.observe(document, { childList: true, subtree: true });
}
