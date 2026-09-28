import path from "path";

export const STORAGE_ROOT = path.resolve(process.cwd(), "storage");

export function storagePath(...segments) {
    return path.join(STORAGE_ROOT, ...segments);
}

export const STORAGE_UPLOADS = storagePath("uploads");
export const STORAGE_LOGS = storagePath("logs");
export const STORAGE_KYC = storagePath("kyc");
export const STORAGE_EXPORTS = storagePath("exports");
export const STORAGE_DATA = storagePath("data");
