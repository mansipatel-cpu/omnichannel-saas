/**
 * ============================================================
 * © 2025 Diploy — a brand of Bisht Technologies Private Limited
 * Original Author: BTPL Engineering Team
 * Website: https://diploy.in
 * Contact: cs@diploy.in
 *
 * Distributed under the Envato / CodeCanyon License Agreement.
 * Licensed to the purchaser for use as defined by the
 * Envato Market (CodeCanyon) Regular or Extended License.
 *
 * You are NOT permitted to redistribute, resell, sublicense,
 * or share this source code, in whole or in part.
 * Respect the author's rights and Envato licensing terms.
 * ============================================================
 */
export const COMMON_TIMEZONES = [
    { region: "Universal", zones: [
            { value: "UTC", label: "UTC (Coordinated Universal Time)" },
        ] },
    { region: "Americas", zones: [
            { value: "America/New_York", label: "Eastern Time (New York)" },
            { value: "America/Chicago", label: "Central Time (Chicago)" },
            { value: "America/Denver", label: "Mountain Time (Denver)" },
            { value: "America/Los_Angeles", label: "Pacific Time (Los Angeles)" },
            { value: "America/Anchorage", label: "Alaska Time (Anchorage)" },
            { value: "Pacific/Honolulu", label: "Hawaii Time (Honolulu)" },
            { value: "America/Toronto", label: "Eastern Time (Toronto)" },
            { value: "America/Vancouver", label: "Pacific Time (Vancouver)" },
            { value: "America/Mexico_City", label: "Central Time (Mexico City)" },
            { value: "America/Sao_Paulo", label: "Brasilia Time (São Paulo)" },
            { value: "America/Buenos_Aires", label: "Argentina Time (Buenos Aires)" },
        ] },
    { region: "Europe", zones: [
            { value: "Europe/London", label: "GMT/BST (London)" },
            { value: "Europe/Paris", label: "CET (Paris)" },
            { value: "Europe/Berlin", label: "CET (Berlin)" },
            { value: "Europe/Rome", label: "CET (Rome)" },
            { value: "Europe/Madrid", label: "CET (Madrid)" },
            { value: "Europe/Amsterdam", label: "CET (Amsterdam)" },
            { value: "Europe/Brussels", label: "CET (Brussels)" },
            { value: "Europe/Stockholm", label: "CET (Stockholm)" },
            { value: "Europe/Warsaw", label: "CET (Warsaw)" },
            { value: "Europe/Moscow", label: "MSK (Moscow)" },
            { value: "Europe/Istanbul", label: "TRT (Istanbul)" },
        ] },
    { region: "Asia Pacific", zones: [
            { value: "Asia/Dubai", label: "GST (Dubai)" },
            { value: "Asia/Kolkata", label: "IST (Mumbai/Delhi)" },
            { value: "Asia/Singapore", label: "SGT (Singapore)" },
            { value: "Asia/Hong_Kong", label: "HKT (Hong Kong)" },
            { value: "Asia/Shanghai", label: "CST (Shanghai/Beijing)" },
            { value: "Asia/Tokyo", label: "JST (Tokyo)" },
            { value: "Asia/Seoul", label: "KST (Seoul)" },
            { value: "Asia/Jakarta", label: "WIB (Jakarta)" },
            { value: "Asia/Bangkok", label: "ICT (Bangkok)" },
            { value: "Australia/Sydney", label: "AEST (Sydney)" },
            { value: "Australia/Melbourne", label: "AEST (Melbourne)" },
            { value: "Australia/Perth", label: "AWST (Perth)" },
            { value: "Pacific/Auckland", label: "NZST (Auckland)" },
        ] },
    { region: "Africa & Middle East", zones: [
            { value: "Africa/Cairo", label: "EET (Cairo)" },
            { value: "Africa/Johannesburg", label: "SAST (Johannesburg)" },
            { value: "Africa/Lagos", label: "WAT (Lagos)" },
            { value: "Africa/Nairobi", label: "EAT (Nairobi)" },
            { value: "Asia/Jerusalem", label: "IST (Jerusalem)" },
            { value: "Asia/Riyadh", label: "AST (Riyadh)" },
        ] },
];
export function getDetectedTimezone() {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    }
    catch {
        return "";
    }
}
export function timezoneExistsInList(timezone) {
    if (!timezone)
        return false;
    return COMMON_TIMEZONES.some((group) => group.zones.some((zone) => zone.value === timezone));
}
export function formatTimeInTimezone(date, timezone) {
    if (!timezone)
        return date.toLocaleString();
    try {
        return new Intl.DateTimeFormat(undefined, {
            timeZone: timezone,
            weekday: "short",
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        }).format(date);
    }
    catch {
        return date.toLocaleString();
    }
}
