'use strict';
export const KycEngineConfig = {
    documentTypes: ['photo_id', 'company_registration', 'gst_certificate', 'authorization_letter'],
    documentLabels: {
        photo_id: 'Photo ID',
        company_registration: 'Company Registration Certificate',
        gst_certificate: 'GST Certificate',
        authorization_letter: 'Authorization Letter',
    },
    allowedMimeTypes: [
        'application/pdf',
        'image/jpeg',
        'image/jpg',
        'image/png',
    ],
    maxFileSizeMb: 10,
    storagePath: 'storage/kyc',
};
