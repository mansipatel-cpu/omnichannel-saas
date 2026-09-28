const isProduction = () => process.env.NODE_ENV === 'production';
export function safeErrorMessage(error, fallback = 'Internal server error') {
    if (!isProduction()) {
        return error?.message || fallback;
    }
    return fallback;
}
