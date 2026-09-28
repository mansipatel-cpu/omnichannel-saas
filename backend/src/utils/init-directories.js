import fs from 'fs';
import path from 'path';
import { STORAGE_ROOT } from './storage-paths';

const REQUIRED_DIRECTORIES = [
    'storage',
    'storage/kyc',
    'storage/exports',
    'storage/data',
    'storage/data/invoices',
    'storage/data/refund-notes',
    'storage/logs',
    'storage/uploads',
    'storage/uploads/profile-photos',
    'storage/uploads/media',
    'storage/uploads/widgets',
    'frontend/public/images',
    'frontend/public/audio',
    'frontend/public/uploads',
];

export function initializeDirectories() {
    for (const dir of REQUIRED_DIRECTORIES) {
        const fullPath = path.resolve(process.cwd(), dir);
        if (!fs.existsSync(fullPath)) {
            fs.mkdirSync(fullPath, { recursive: true });
            console.log(`[init] Created directory: ${dir}`);
        }
    }
    if (!fs.existsSync(STORAGE_ROOT)) {
        fs.mkdirSync(STORAGE_ROOT, { recursive: true });
    }
}
