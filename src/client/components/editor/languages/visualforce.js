import { isMonacoLanguageSetup } from 'shared/utils';

const EMPTY_ELEMENTS = [
    'area',
    'base',
    'br',
    'col',
    'embed',
    'hr',
    'img',
    'input',
    'keygen',
    'link',
    'menuitem',
    'meta',
    'param',
    'source',
    'track',
    'wbr'
];

export function configureVisualforceLanguage(monaco) {
    if(isMonacoLanguageSetup('visualforce')) return;
    monaco.languages.register({ id: 'visualforce' });
	monaco.languages.setLanguageConfiguration('visualforce', {
        indentationRules: {
            increaseIndentPattern: /<(?!\?|(?:area|base|br|col|frame|hr|html|img|input|link|meta|param)\b|[^>]*\/>)([-_.A-Za-z0-9]+)(?=\s|>)\b[^>]*>(?!.*<\/\1>)|<!--(?!.*-->)|\{[^}"']*$/,
            decreaseIndentPattern: /^\s*(<\/(?!html)[-_.A-Za-z0-9]+\b[^>]*>|-->|\})/
        },
        wordPattern: /(-?\d*\.\d\w*)|([^`~!@$^&*()=+[{\]}\\|;:'",.<>/\s]+)/g,
        onEnterRules: [{
                beforeText: new RegExp(
                    `<(?!(?:${EMPTY_ELEMENTS.join(
                '|'
              )}))([_:\\w][_:\\w-.\\d]*)([^/>]*(?!/)>)[^<]*$`,
                    'i'
                ),
                afterText: /^<\/([_:\w][_:\w-.\d]*)\s*>$/i,
            },
            {
                beforeText: new RegExp(
                    `<(?!(?:${EMPTY_ELEMENTS.join(
                '|'
              )}))(\\w[\\w\\d]*)([^/>]*(?!/)>)[^<]*$`,
                    'i'
                ),
            }
        ]
    });
}
