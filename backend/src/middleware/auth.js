'use strict';
import jwt from "jsonwebtoken";
import crypto from "crypto";
const JWT_SECRET = process.env.JWT_SECRET || (() => {
    if (process.env.NODE_ENV === "production") {
        throw new Error("JWT_SECRET environment variable must be set in production");
    }
    console.warn("⚠️  WARNING: Using insecure default JWT_SECRET in development. Set JWT_SECRET environment variable for production!");
    return "insecure-dev-secret-CHANGE-ME";
})();
// Refresh token settings
const REFRESH_TOKEN_EXPIRY_DAYS = 30;
const ACTIVITY_TIMEOUT_MINUTES = 30; // Session expires after 30 mins of inactivity
export function authenticateToken(req, res, next) {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (!token) {
        return res.status(401).json({ error: "Authentication required" });
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.userId;
        req.userRole = decoded.role;
        // Also set req.user for backward compatibility with routes expecting req.user
        req.user = {
            id: decoded.userId,
            role: decoded.role
        };
        next();
    }
    catch (error) {
        return res.status(403).json({ error: "Invalid or expired token" });
    }
}
/**
 * Middleware that accepts both user JWTs and admin team session tokens.
 * Used for endpoints that can be accessed by both regular users and admin team members.
 * Sets req.userId for user JWTs, or req.adminTeamMember for admin team tokens.
 *
 * Reuses existing admin-auth helpers for DoS protection and token validation.
 */
export async function authenticateAnyToken(req, res, next) {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (!token) {
        return res.status(401).json({ error: "Authentication required" });
    }
    // First try user JWT token
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.userId;
        req.userRole = decoded.role;
        req.user = {
            id: decoded.userId,
            role: decoded.role
        };
        return next();
    }
    catch (jwtError) {
        // JWT verification failed, try admin team session token
    }
    // Try admin team session token using existing helper (includes DoS protection)
    try {
        const { tryAdminTeamToken, isValidSessionTokenFormat } = await import('./admin-auth');
        // Validate format before attempting DB lookup (DoS prevention)
        if (isValidSessionTokenFormat(token)) {
            const adminTeamMember = await tryAdminTeamToken(token);
            if (adminTeamMember) {
                req.adminTeamMember = adminTeamMember;
                return next();
            }
        }
    }
    catch (importError) {
        console.error('[Auth] Admin team token check error:', importError);
    }
    return res.status(403).json({ error: "Invalid or expired token" });
}
/**
 * Middleware factory to check if user account is active (not suspended)
 * Requires authenticateToken to run first
 * Returns 403 if user account is suspended
 */
export function checkUserActive(storage) {
    return async (req, res, next) => {
        try {
            if (!req.userId) {
                return res.status(401).json({ error: "Authentication required" });
            }
            const user = await storage.getUser(req.userId);
            if (!user) {
                return res.status(404).json({ error: "User not found" });
            }
            // Check if user account is suspended
            if (user.isActive === false) {
                console.log(`Access blocked: User ${req.userId} account is suspended`);
                return res.status(403).json({
                    error: "Your account has been suspended. Please contact support for assistance.",
                    code: "ACCOUNT_SUSPENDED"
                });
            }
            next();
        }
        catch (error) {
            console.error("User active check error:", error);
            return res.status(500).json({ error: "Failed to verify account status" });
        }
    };
}
export function requireRole(...roles) {
    return (req, res, next) => {
        // Admin role always has access to all protected routes
        if (req.userRole === 'admin') {
            return next();
        }
        if (!req.userRole || !roles.includes(req.userRole)) {
            return res.status(403).json({ error: "Insufficient permissions" });
        }
        next();
    };
}
// Cache for JWT expiry to avoid repeated DB calls
let cachedJwtExpiry = "7d";
let jwtExpiryCacheTime = 0;
const JWT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
// Preload JWT expiry from database on server startup
export async function preloadJwtExpiry(storage) {
    try {
        const setting = await storage.getGlobalSetting('jwt_expiry_days');
        const days = typeof setting?.value === 'number' ? setting.value : 7;
        cachedJwtExpiry = `${days}d`;
        jwtExpiryCacheTime = Date.now();
        console.log(`🔐 [Auth] JWT expiry preloaded: ${cachedJwtExpiry}`);
    }
    catch (error) {
        console.error('[Auth] Failed to preload jwt_expiry_days, using default 7d:', error);
    }
}
async function getJwtExpiry(storage) {
    const now = Date.now();
    if ((now - jwtExpiryCacheTime) < JWT_CACHE_TTL) {
        return cachedJwtExpiry;
    }
    try {
        const setting = await storage.getGlobalSetting('jwt_expiry_days');
        const days = typeof setting?.value === 'number' ? setting.value : 7;
        cachedJwtExpiry = `${days}d`;
        jwtExpiryCacheTime = now;
        return cachedJwtExpiry;
    }
    catch (error) {
        console.error('[Auth] Failed to fetch jwt_expiry_days, using default:', error);
        return "7d";
    }
}
export async function generateTokenAsync(userId, role, storage) {
    const expiry = await getJwtExpiry(storage);
    return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: expiry });
}
/**
 * Middleware to check if user has an active Pro membership
 * Requires authenticateToken to run first
 * Skips check in development mode for testing
 */
export function checkActiveMembership(storage) {
    return async (req, res, next) => {
        // Skip in development mode for testing
        if (process.env.NODE_ENV === 'development') {
            console.log('Development mode: Bypassing membership check');
            return next();
        }
        try {
            const user = await storage.getUser(req.userId);
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            // Bypass membership check for admin/superadmin
            if (user.role === 'admin' || req.userRole === 'admin') {
                console.log(`Bypassing membership check for admin/superadmin user ${req.userId}`);
                return next();
            }
            // Method 1: Check if user has an active subscription in userSubscriptions table
            const subscription = await storage.getUserSubscription(req.userId);
            if (subscription && subscription.status === 'active' && new Date(subscription.currentPeriodEnd) > new Date()) {
                console.log(`User ${req.userId} has active subscription via userSubscriptions table`);
                return next();
            }
            // Method 2: Check user's planType and planExpiresAt fields (fallback)
            if (user.planType !== 'free' && user.planExpiresAt && new Date(user.planExpiresAt) > new Date()) {
                console.log(`User ${req.userId} has active membership via users table`);
                return next();
            }
            // No active membership found
            console.log(`User ${req.userId} does not have active Pro membership. planType=${user.planType}, planExpiresAt=${user.planExpiresAt}, subscription=${subscription?.status}`);
            return res.status(403).json({
                error: 'Active Pro membership required. Please subscribe to a plan to access this feature.'
            });
        }
        catch (error) {
            console.error('Membership check error:', error);
            return res.status(500).json({ error: 'Failed to verify membership status' });
        }
    };
}
/**
 * Generate a secure refresh token
 */
export function generateRefreshToken() {
    return crypto.randomBytes(64).toString('hex');
}
/**
 * Hash a refresh token for secure storage
 */
export function hashRefreshToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}
/**
 * Get refresh token expiry date
 */
export function getRefreshTokenExpiry() {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);
    return expiry;
}
/**
 * Get activity timeout setting in milliseconds
 */
export function getActivityTimeoutMs() {
    return ACTIVITY_TIMEOUT_MINUTES * 60 * 1000;
}
/**
 * Check if a timestamp is within the activity timeout window
 */
export function isWithinActivityTimeout(lastActivityAt) {
    if (!lastActivityAt)
        return false;
    const now = Date.now();
    const lastActivity = new Date(lastActivityAt).getTime();
    return (now - lastActivity) < getActivityTimeoutMs();
}
/**
 * Create refresh token data for storage
 */
export function createRefreshTokenData(userId, userAgent, ipAddress) {
    const token = generateRefreshToken();
    return {
        userId,
        token,
        hashedToken: hashRefreshToken(token),
        expiresAt: getRefreshTokenExpiry(),
        userAgent,
        ipAddress
    };
}
/**
 * Generate short-lived access token (15 minutes)
 */
export function generateShortAccessToken(userId, role) {
    return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: '15m' });
}
/**
 * Verify access token and return decoded payload
 */
export function verifyAccessToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    }
    catch (error) {
        return null;
    }
}
/**
 * Cookie name for refresh token
 */
export const REFRESH_TOKEN_COOKIE = 'refresh_token';
/**
 * Set refresh token as HttpOnly, Secure cookie
 * This prevents XSS attacks from stealing the refresh token
 */
export function setRefreshTokenCookie(res, token) {
    const isProduction = process.env.NODE_ENV === 'production';
    const maxAge = REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000; // Convert days to milliseconds
    res.cookie(REFRESH_TOKEN_COOKIE, token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict',
        maxAge: maxAge,
        path: '/api/auth',
    });
}
/**
 * Clear refresh token cookie on logout
 */
export function clearRefreshTokenCookie(res) {
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie(REFRESH_TOKEN_COOKIE, '', {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict',
        maxAge: 0,
        path: '/api/auth',
    });
}
/**
 * Get refresh token from cookie
 */
export function getRefreshTokenFromCookie(req) {
    return req.cookies?.[REFRESH_TOKEN_COOKIE];
}
/**
 * Export constants for use elsewhere
 */
export const AUTH_CONSTANTS = {
    REFRESH_TOKEN_EXPIRY_DAYS,
    ACTIVITY_TIMEOUT_MINUTES,
    ACCESS_TOKEN_EXPIRY_MINUTES: 15
};
