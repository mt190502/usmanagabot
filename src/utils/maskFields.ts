/**
 * Recursively masks sensitive fields within an object.
 *
 * This function clones the input object and replaces the values of predefined
 * sensitive fields (e.g., 'token', 'password') with a masked string ('***').
 * For string values longer than 6 characters, it partially masks the value,
 * showing only the first and last 3 characters.
 *
 * @template T The type of the data object.
 * @param {T} data The object to mask.
 * @returns {T} A new object with sensitive fields masked.
 */
export const maskSensitiveFields = <T>(data: T): T => {
    if (!data || typeof data !== 'object') return data;
    const fields = ['app_id', 'token', 'password', 'username', 'database'];
    const masked_data = { ...data };
    for (const field of fields) {
        if (field in masked_data) {
            const value = (masked_data as Record<string, unknown>)[field];
            if (typeof value === 'string' && value.length > 6) {
                (masked_data as Record<string, unknown>)[field] = value.slice(0, 3) + '***' + value.slice(-3);
            } else {
                (masked_data as Record<string, unknown>)[field] = '***';
            }
        }
    }
    return masked_data;
};
