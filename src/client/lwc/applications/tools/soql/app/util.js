export const escapeCsvValue = (separator, value) => {
    if (value == null) return ''; // Handle null or undefined values
    const stringValue = String(value); // Convert to string
    if (
        stringValue.includes(separator) ||
        stringValue.includes('"') ||
        stringValue.includes('\n')
    ) {
        // Escape double quotes by doubling them
        return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
};

export const formatQueryWithComment = query => {
    return query
        .split('\n')
        .map(line => {
            const commentIndex = line.indexOf('//');
            if (commentIndex !== -1) {
                // Include everything before `//`, excluding the comment
                return line.slice(0, commentIndex).trim();
            }
            // Include the entire line if no `//` is found
            return line.trim();
        })
        .filter(line => line.length > 0) // Exclude empty lines
        .join(' '); // Join back into a single query string
};
