import { parse, rgbaToHsla, hslaToString } from '../utils/color';
import { toArray, toCamelCase } from '../utils/misc';

const STYLE_ID = 'dark-reader-style';
const defaultStyleSheet = `
html, body, button, input, textarea {
    background-color: black !important;
    color: white !important;
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

        var colorRules = toArray(r.style)
            .filter((s) => {
                return (
                    s.indexOf('color') >= 0 &&
                    ['inherit', 'transparent', 'initial'].indexOf(r.style[s]) < 0
                );
            });

        if (colorRules.length > 0) {
            var props = {};
            colorRules
                .forEach((s) => {
                    var name = toCamelCase(s);
                    var value = r.style[name];
                    var color;
                    try {
                        var rgba = parse(value);
                        var hsla = rgbaToHsla(rgba);

                        if (s.indexOf('background') >= 0) {
                            if (hsla.l > 0.5) {
                                hsla.l = (1 - hsla.l);
                            }
                            hsla.l = Math.min(0.25, hsla.l);
                        } else if (s.indexOf('border') >= 0) {
                            hsla.l = (1 - hsla.l);
                        } else {
                            if (hsla.l < 0.5) {
                                hsla.l = (1 - hsla.l);
                            }
                            hsla.l = Math.max(0.75, hsla.l);
                        }

                        color = hslaToString(hsla) + ' !important';
                    } catch (e) {
                        color = value;
                        if (color.indexOf('!important') < 0) {
                            color += ' !important';
                        }
                        console.log('Unable to parse ' + value);
                    }
                    props[s] = color;
                })

            if (Object.keys(props).length > 0) {
                var propsText = Object.keys(props).map(p => `  ${p}: ${props[p]};\n`).join('');
                cssText += `${r.selectorText} {\n${propsText}}\n`;
            }
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
