/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */

type ClassSetValue = Record<string, boolean>;

type ClassSet = {
    add: (className: string | ClassSetValue) => ClassSet;
    invert: () => ClassSet;
    toString: () => string;
    [key: string]: boolean | ((...args: unknown[]) => unknown);
};

const proto: ClassSet = {
    add(className: string | ClassSetValue) {
        if (typeof className === 'string') {
            this[className] = true;
        } else {
            Object.assign(this, className);
        }
        return this;
    },
    invert() {
        Object.keys(this).forEach(key => {
            this[key] = !this[key];
        });
        return this;
    },
    toString() {
        return Object.keys(this)
            .filter(key => this[key])
            .join(' ');
    },
};

export function classSet(config: string | ClassSetValue): ClassSet {
    if (typeof config === 'string') {
        const key = config;
        config = { [key]: true };
    }
    return Object.assign(Object.create(proto), config) as ClassSet;
}
