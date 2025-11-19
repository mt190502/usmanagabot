/**
 * Utility function to mask sensitive fields in an object.
 * It replaces the values of specified fields with a masked version.
 * The fields to be masked are defined in the `fields` array.
 * If the value is a string, it masks it by keeping the first 3 and last 3 characters,
 * replacing the middle part with '\*\*\*'. If the value is not a string,
 * it replaces it with '\*\*\*'.
 * @param {T} data - The object containing sensitive fields to be masked.
 * @returns {T} - The object with masked sensitive fields.
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
