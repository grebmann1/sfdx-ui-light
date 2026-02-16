/**
 * ID generation utilities
 */

export function guid() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }

    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}

export function guidFromHash(input) {
    // Generate a hash from the input string
    let hash = 0;
    if (input) {
        for (let i = 0; i < input.length; i++) {
            hash = (hash << 5) - hash + input.charCodeAt(i);
            hash |= 0; // Convert to 32-bit integer
        }
    }

    // Convert the hash to a hexadecimal string
    const hashHex = Math.abs(hash).toString(16).padStart(8, '0'); // Ensure consistent length

    // Use the existing `guid` structure, injecting part of the hash
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }

    return (
        hashHex.substring(0, 4) +
        s4() +
        '-' +
        hashHex.substring(4) +
        '-' +
        s4() +
        '-' +
        s4() +
        '-' +
        s4() +
        s4() +
        s4()
    );
}
