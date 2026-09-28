/**
 * Authenticated product routes live at /name, not /app/name.
 * /app/* remains as a redirect so old bookmarks still work.
 */
const AUTH_PREFIXES = [
    "/dashboard",
    "/app",
    "/campaigns",
    "/calls",
    "/contacts",
    "/analytics",
    "/crm",
    "/tools",
    "/knowledge-base",
    "/agents",
    "/conversations",
    "/templates",
    "/prompt-templates",
    "/incoming-connections",
    "/voices",
    "/phone-numbers",
    "/google-callback",
    "/flows",
    "/settings",
    "/account",
    "/message",
    "/whatsapp",
];
export function isUserAppPath(path) {
    const pathname = path.split("?")[0];
    if (pathname === "/team/login" || pathname.startsWith("/team/login/"))
        return false;
    return AUTH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
export function stripAppPrefix(path) {
    const [pathname, query] = path.split("?");
    if (pathname === "/app" || pathname === "/app/") {
        return `/dashboard${query ? `?${query}` : ""}`;
    }
    if (pathname.startsWith("/app/")) {
        return `/${pathname.slice(5)}${query ? `?${query}` : ""}`;
    }
    return path;
}
