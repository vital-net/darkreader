module DarkReader {

    /**
     * Chrome extension.
     * Extension uses CSS generator to process opened web pages.
     */
    export class Extension extends xp.Model {

        protected generator: FilterCssGenerator;
        enabled: boolean;
        config: ObservableFilterConfig;
        fonts: string[];

        /**
         * Creates a chrome extensions.
         * @param generator CSS-generator.
         */
        constructor(generator: FilterCssGenerator) {
            super();
            this.generator = generator;

            // Define properties
            xp.Model.property(this, 'enabled', false);
            xp.Model.property(this, 'config', null);
            xp.Model.property(this, 'fonts', []);

            // Handle config changes
            var changeReg = new xp.EventRegistrar();
            this.onPropertyChanged.addHandler((prop) => {
                if (prop === 'enabled') {
                    this.onAppToggle();
                }
                if (prop === 'config') {
                    changeReg.unsubscribeAll();
                    changeReg.subscribe(this.config.onPropertyChanged, this.onConfigPropChanged, this);
                    changeReg.subscribe(this.config.siteList.onCollectionChanged, this.onConfigPropChanged, this);
                    this.onConfigPropChanged();
                }
            });

            // Default icon
            chrome.browserAction.setIcon({
                path: {
                    '19': ICON_PATHS.inactive_19,
                    '38': ICON_PATHS.inactive_38
                }
            });

            // Load user settings from Chrome storage
            this.loadUserSettings();

            // Subscribe on keyboard shortcut
            chrome.commands.onCommand.addListener((command) => {
                if (command === 'toggle') {
                    console.log('Toggle command entered');
                    this.enabled = !this.enabled;
                }
                if (command === 'addSite') {
                    console.log('Add Site command entered');
                    this.toggleCurrentSite();
                }
            });

            // Load font list
            this.getFontList((fonts) => this.fonts = fonts);

            // TODO: Try to remove CSS before ext disabling or removal.
            window.addEventListener('unload', () => {
                chrome.tabs.query({}, (tabs) => {
                    tabs.forEach(this.removeStyleFromTab, this);
                })
            });
        }

        /**
         * Returns info of active tab
         * of last focused window.
         */
        getActiveTabInfo(callback: (info: TabInfo) => void) {
            chrome.tabs.query({
                active: true,
                lastFocusedWindow: true
            }, (tabs) => {
                if (tabs.length === 1) {
                    var url = tabs[0].url;
                    var host = url.match(/^(.*?:\/{2,3})?(.+?)(\/|$)/)[2];
                    var info: TabInfo = {
                        url: url,
                        host: host,
                        isChromePage: (url.indexOf('chrome') === 0 || url.indexOf('https://chrome.google.com/webstore') === 0),
                        isInDarkList: isUrlInList(url, DARK_SITES)
                    };
                    callback(info);
                } else {
                    if (DEBUG) {
                        throw new Error('Unexpected tabs count.');
                    }
                    console.error('Unexpected tabs count.');
                    callback({ url: '', host: '', isChromePage: false, isInDarkList: false });
                }
            });
        }

        /**
         * Adds host name of last focused tab
         * into Sites List (or removes).
         */
        toggleCurrentSite() {
            this.getActiveTabInfo((info) => {
                if (info.host) {
                    var index = this.config.siteList.indexOf(info.host);
                    if (index < 0) {
                        this.config.siteList.push(info.host);
                    } else {
                        // Remove site from list
                        this.config.siteList.splice(index, 1);
                    }
                }
            });
        }


        //------------------------------------
        //
        //       Handle config changes
        //

        protected onAppToggle() {
            if (this.enabled) {
                //
                // Switch ON

                // Change icon
                chrome.browserAction.setIcon({
                    path: {
                        '19': ICON_PATHS.active_19,
                        '38': ICON_PATHS.active_38
                    }
                });

                // Subscribe to tab updates
                this.addTabListeners();

                // Set style for active tabs
                chrome.tabs.query({ active: true }, (tabs) => {
                    tabs.forEach(this.addStyleToTab, this);
                });

                // Update style for other tabs
                chrome.tabs.query({ active: false }, (tabs) => {
                    tabs.forEach((tab) => {
                        setTimeout(() => this.addStyleToTab(tab), 0);
                    });
                });
            }
            else {
                //
                // Switch OFF

                // Change icon
                chrome.browserAction.setIcon({
                    path: {
                        '19': ICON_PATHS.inactive_19,
                        '38': ICON_PATHS.inactive_38
                    }
                });

                // Unsubscribe from tab updates
                this.removeTabListeners();

                // Remove style from active tabs
                chrome.tabs.query({ active: true }, (tabs) => {
                    tabs.forEach(this.removeStyleFromTab, this);
                });

                // Remove style from other tabs
                chrome.tabs.query({ active: false }, (tabs) => {
                    tabs.forEach((tab) => {
                        setTimeout(() => this.removeStyleFromTab(tab), 0);
                    });
                });
            }
            this.saveUserSettings();
        }

        protected onConfigPropChanged() {
            if (this.enabled) {
                // Update style for active tabs
                chrome.tabs.query({ active: true }, (tabs) => {
                    tabs.forEach(this.addStyleToTab, this);
                });

                // Update style for other tabs
                chrome.tabs.query({ active: false }, (tabs) => {
                    tabs.forEach((tab) => {
                        setTimeout(() => this.addStyleToTab(tab), 0);
                    });
                });
            }
            this.saveUserSettings();
        }


        //-------------------------
        //
        // Working with chrome tabs
        //
        //-------------------------

        protected addTabListeners() {
            if (!chrome.tabs.onUpdated.hasListener(this.tabUpdateListener)) {
                chrome.tabs.onUpdated.addListener(this.tabUpdateListener);
            }
            // Replace fires instead of update when page loaded from cache
            // https://bugs.chromium.org/p/chromium/issues/detail?id=109557
            // https://bugs.chromium.org/p/chromium/issues/detail?id=116379
            if (!chrome.tabs.onReplaced.hasListener(this.tabReplaceListener)) {
                chrome.tabs.onReplaced.addListener(this.tabReplaceListener);
            }
        }

        protected removeTabListeners() {
            chrome.tabs.onUpdated.removeListener(this.tabUpdateListener);
            chrome.tabs.onReplaced.removeListener(this.tabReplaceListener);
        }

        protected tabUpdateListener = (tabId: number, info: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => {
            console.log(`Tab updated: ${tab.id}, status: ${info.status}`);
            this.addStyleToTab(tab);
        }

        protected tabReplaceListener = (addedTabId: number, replacedTabId: number) => {
            console.log(`Tab ${replacedTabId} replaced with ${addedTabId}`);
            chrome.tabs.get(addedTabId, (tab) => this.addStyleToTab(tab));
        }


        //----------------------
        //
        // Add/remove css to tab
        //
        //----------------------

        protected canInjectScript(tab: chrome.tabs.Tab) {
            // Prevent throwing errors on specific chrome adresses
            return (tab
                && tab.url
                && tab.url.indexOf('chrome') !== 0
                && tab.url.indexOf('https://chrome.google.com/webstore') !== 0
            );
        }

        /**
         * Adds style to tab.
         */
        protected addStyleToTab(tab: chrome.tabs.Tab) {
            if (!this.canInjectScript(tab)) {
                return;
            }
            chrome.tabs.executeScript(tab.id, {
                code: this.getCode_addStyle(tab.url),
                runAt: 'document_start'
            });
        }

        /**
         * Removes style from tab.
         */
        protected removeStyleFromTab(tab: chrome.tabs.Tab) {
            if (!this.canInjectScript(tab)) {
                return;
            }
            chrome.tabs.executeScript(tab.id, {
                code: this.getCode_removeStyle()
            });
        }

        protected getCode_addStyle(url?: string) {
            var css = this.generator.createCssCode(this.config, url);
            var svg = this.generator.createSvgCode(this.config);
            var code = `
${DEBUG ? `console.log('Executing DR script (add)...');` : ``}
function createNodeAsSoonAsPossible(
    selector,
    creator,
    changePredicate,
    targetSelector,
    targetCreator,
    targetMutationPredicate
) {
    var target = targetSelector();
    if (target) {
        var node = creator();
        var prev = selector();
        if (!prev) {
            target.appendChild(node);
            ${DEBUG ? `console.log('Added DR node.');` : ``}
        } else if (changePredicate(node, prev)) {
            prev.parentElement.removeChild(prev);
            target.appendChild(node);
            ${DEBUG ? `console.log('Updated DR node.');` : ``}
        }
    } else {
        var observer = new MutationObserver(function (mutations) {
            for (var i = 0; i < mutations.length; i++) {
                if (targetMutationPredicate(mutations[i])) {
                    observer.disconnect();
                    document.removeEventListener('readystatechange', onReady);
                    var prev = selector();
                    if (!prev) {
                        var node = creator();
                        var target = targetSelector();
                        target.appendChild(node);
                        ${DEBUG ? `console.log('Added DR node using observer.');` : ``}
                    }
                    break;
                }
            }
        });
        observer.observe(document, { childList: true, subtree: true });
        var onReady = function() {
            if (document.readyState !== 'complete') { 
                return;
            }
            observer.disconnect();
            document.removeEventListener('readystatechange', onReady);
            var target = targetSelector();
            if (!target) {
                target = targetCreator();
            }
            var prev = selector();
            if (!prev) {
                var node = creator();
                target.appendChild(style);
                ${DEBUG ? `console.log('Added DR node on document ready.');` : ``}
            }
        };
        document.addEventListener('readystatechange', onReady);
        if (document.readyState === 'complete') { 
            onReady();
        }
    }
}

createNodeAsSoonAsPossible(
    function () {
        return document.getElementById('dark-reader-style');
    },
    function () {
        var css = '${css}';
        var style = document.createElement('style');
        style.setAttribute('id', 'dark-reader-style');
        style.type = 'text/css';
        style.appendChild(document.createTextNode(css));
        return style;
    },
    function (node, prev) {
        var nodeText = node.textContent.replace(/^\\s*/gm, '');
        var prevText = prev.textContent.replace(/^\\s*/gm, '');
        return nodeText !== prevText;
    },
    function () {
        return document.head;
    },
    function () {
        var head = document.createElement('head');
        document.documentElement.insertBefore(head, document.documentElement.firstElementChild);
        return head;
    },
    function (mutation) {
        return mutation.target.nodeName === 'HEAD';
    }
);

createNodeAsSoonAsPossible(
    function () {
        return document.getElementById('dark-reader-svg');
    },
    function () {
        var div = document.createElement('div');
        div.innerHTML = '${svg}';
        var svg = div.firstElementChild;
        svg.id = 'dark-reader-svg';
        svg.style.display = 'none';
        return svg;
    },
    function (node, prev) {
        var nodeValues = node.querySelector('#DarkReader_Filter feColorMatrix').getAttribute('values');
        var prevValues = prev.querySelector('#DarkReader_Filter feColorMatrix').getAttribute('values');
        return nodeValues !== prevValues;
    },
    function () {
        return document.head;
    },
    function () {
        var head = document.createElement('head');
        document.documentElement.insertBefore(head, document.documentElement.firstElementChild);
        return head;
    },
    function (mutation) {
        return mutation.target.nodeName === 'HEAD';
    }
);
`;
            return code;
        }

        protected getCode_removeStyle() {
            var code = `
${DEBUG ? `console.log('Executing DR script (remove)...');` : ``}
var style = document.getElementById('dark-reader-style');
var svg = document.getElementById('dark-reader-svg');
style && style.parentElement.removeChild(style);
svg && svg.parentElement.removeChild(svg);
`;
            return code;
        }


        //-------------------------------------
        //
        //       Configuration management
        //
        //-------------------------------------

        /**
         * Loads configuration from Chrome storage.
         */
        protected loadUserSettings() {
            var defaultFilterConfig = xp.clone(DEFAULT_FILTER_CONFIG);
            var defaultStore: AppConfigStore = {
                enabled: true,
                config: defaultFilterConfig
            };
            chrome.storage.sync.get(defaultStore, (store: AppConfigStore) => {
                if (!store.config) {
                    store.config = defaultFilterConfig;
                }
                if (!Array.isArray(store.config.siteList)) {
                    var arr = [];
                    for (var key in store.config.siteList) {
                        arr[key] = store.config.siteList[key];
                    }
                    store.config.siteList = arr;
                }
                this.config = <ObservableFilterConfig>xp.observable(store.config);
                this.enabled = store.enabled;
                console.log('loaded', store);
            });
        }

        /**
         * Saves configuration to Chrome storage.
         */
        protected saveUserSettings() {
            // NOTE: Debounce config saving.
            if (this.savedTimeout) {
                clearTimeout(this.savedTimeout);
            }
            this.savedTimeout = setTimeout(() => {
                var store: AppConfigStore = {
                    enabled: this.enabled,
                    config: this.config
                };
                chrome.storage.sync.set(store, () => {
                    console.log('saved', store);
                    this.savedTimeout = null;
                });
            }, SAVE_CONFIG_TIMEOUT);
        }
        private savedTimeout: number;

        /**
         * Returns the list of fonts
         * installed in system.
         */
        protected getFontList(onReturned: (fonts: string[]) => void) {
            chrome.fontSettings.getFontList((res) => {
                // id or name?
                var fonts = res.map((r) => r.fontId);
                onReturned(fonts);
            });
        }
    }

    //
    // ---------- Constants --------------------

    var ICON_PATHS = {
        active_19: '../img/dr_active_19.png',
        active_38: '../img/dr_active_38.png',
        inactive_19: '../img/dr_inactive_19.png',
        inactive_38: '../img/dr_inactive_38.png'
    };

    var SAVE_CONFIG_TIMEOUT = 1000;


    //
    // --------- Interfaces --------------

    interface AppConfigStore {
        enabled: boolean;
        config: FilterConfig;
    }

    export interface ObservableFilterConfig extends FilterConfig, xp.Notifier {
        siteList: xp.ObservableCollection<string>;
    }

    export interface TabInfo {
        url: string;
        host: string;
        isChromePage: boolean;
        isInDarkList: boolean;
    }
}
