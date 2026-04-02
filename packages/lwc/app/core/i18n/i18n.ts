import en, { type MessageKey } from './messages/en';

const I18N_MESSAGES: Record<string, Record<MessageKey, string>> = { en };

type Constructor<T = {}> = new (...args: any[]) => T;

const I18nMixin = <TBase extends Constructor>(base: TBase) =>
    class I18nElement extends base {
        get i18n(): Record<MessageKey, string> {
            const language = window.navigator.language;
            const langPrefix = language.replace(/_.*/, '');
            return Object.assign(
                {},
                I18N_MESSAGES.en,
                I18N_MESSAGES[langPrefix],
                I18N_MESSAGES[language]
            );
        }
    };

export { I18nMixin };
