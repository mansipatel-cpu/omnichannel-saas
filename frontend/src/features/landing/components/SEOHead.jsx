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
import { useEffect } from "react";
import { useBranding } from "@/shared/components/BrandingProvider";
const DEFAULT_OG_IMAGE = "/og-image.png";
const DEFAULT_TWITTER_CARD = "summary_large_image";
function getDefaultStructuredData(siteName) {
    return {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: siteName,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description: "AI-powered voice agents for automated calling, lead qualification, and 24/7 customer support.",
        offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "USD",
            name: "Free Tier",
            description: "Get started with AI voice agents for free"
        },
        author: {
            "@type": "Organization",
            name: siteName
        }
    };
}
function createOrUpdateMetaTag(attributeType, attributeValue, content) {
    let element = document.querySelector(`meta[${attributeType}="${attributeValue}"]`);
    if (!element) {
        element = document.createElement("meta");
        element.setAttribute(attributeType, attributeValue);
        document.head.appendChild(element);
    }
    element.setAttribute("content", content);
}
function createOrUpdateLinkTag(rel, href) {
    let element = document.querySelector(`link[rel="${rel}"]`);
    if (!element) {
        element = document.createElement("link");
        element.setAttribute("rel", rel);
        document.head.appendChild(element);
    }
    element.setAttribute("href", href);
}
function removeMetaTag(attributeType, attributeValue) {
    const element = document.querySelector(`meta[${attributeType}="${attributeValue}"]`);
    if (element) {
        element.remove();
    }
}
function removeLinkTag(rel) {
    const element = document.querySelector(`link[rel="${rel}"]`);
    if (element) {
        element.remove();
    }
}
function getOrCreateJsonLdScript() {
    let script = document.querySelector('script[type="application/ld+json"][data-seo-head]');
    if (!script) {
        script = document.createElement("script");
        script.type = "application/ld+json";
        script.setAttribute("data-seo-head", "true");
        document.head.appendChild(script);
    }
    return script;
}
function removeJsonLdScript() {
    const script = document.querySelector('script[type="application/ld+json"][data-seo-head]');
    if (script) {
        script.remove();
    }
}
// Helper to create additional JSON-LD scripts for Organization, FAQ, Product schemas
function getOrCreateJsonLdScriptById(id) {
    let script = document.querySelector(`script[type="application/ld+json"][data-seo-id="${id}"]`);
    if (!script) {
        script = document.createElement("script");
        script.type = "application/ld+json";
        script.setAttribute("data-seo-id", id);
        document.head.appendChild(script);
    }
    return script;
}
function removeJsonLdScriptById(id) {
    const script = document.querySelector(`script[type="application/ld+json"][data-seo-id="${id}"]`);
    if (script) {
        script.remove();
    }
}
export function SEOHead({ title, description, canonicalUrl, ogImage = DEFAULT_OG_IMAGE, keywords = [], structuredData, twitterCard = DEFAULT_TWITTER_CARD, twitterSite, twitterCreator, ogType = "website", ogSiteName, noIndex = false, noFollow = false, additionalMetaTags = [], googleVerification, bingVerification, facebookAppId, structuredDataOrg, structuredDataFaq, structuredDataProduct }) {
    const { branding } = useBranding();
    const effectiveSiteName = ogSiteName || branding.app_name || "AI Platform";
    useEffect(() => {
        // Build the branding base title (what BrandingProvider sets)
        const brandingTitle = branding.app_tagline
            ? `${effectiveSiteName} - ${branding.app_tagline}`
            : effectiveSiteName;
        // If title is just the app name or matches branding title, don't override - let BrandingProvider handle it
        const isDefaultTitle = title === effectiveSiteName ||
            title === brandingTitle ||
            title.toLowerCase() === effectiveSiteName.toLowerCase();
        let formattedTitle;
        if (isDefaultTitle) {
            // Don't change document.title - BrandingProvider already set it correctly
            formattedTitle = brandingTitle;
        }
        else if (title.includes(effectiveSiteName)) {
            // Title already contains site name, use as-is
            formattedTitle = title;
            document.title = formattedTitle;
        }
        else {
            // Page-specific title: format as "Page Title | AppName"
            formattedTitle = `${title} | ${effectiveSiteName}`;
            document.title = formattedTitle;
        }
        createOrUpdateMetaTag("name", "description", description);
        if (keywords.length > 0) {
            createOrUpdateMetaTag("name", "keywords", keywords.join(", "));
        }
        const robotsContent = [
            noIndex ? "noindex" : "index",
            noFollow ? "nofollow" : "follow"
        ].join(", ");
        createOrUpdateMetaTag("name", "robots", robotsContent);
        // Google and Bing verification meta tags
        if (googleVerification) {
            createOrUpdateMetaTag("name", "google-site-verification", googleVerification);
        }
        if (bingVerification) {
            createOrUpdateMetaTag("name", "msvalidate.01", bingVerification);
        }
        // Facebook App ID
        if (facebookAppId) {
            createOrUpdateMetaTag("property", "fb:app_id", facebookAppId);
        }
        createOrUpdateMetaTag("property", "og:title", formattedTitle);
        createOrUpdateMetaTag("property", "og:description", description);
        createOrUpdateMetaTag("property", "og:type", ogType);
        createOrUpdateMetaTag("property", "og:site_name", effectiveSiteName);
        if (ogImage) {
            const absoluteOgImage = ogImage.startsWith("http")
                ? ogImage
                : `${window.location.origin}${ogImage}`;
            createOrUpdateMetaTag("property", "og:image", absoluteOgImage);
            createOrUpdateMetaTag("property", "og:image:alt", title);
            createOrUpdateMetaTag("property", "og:image:width", "1200");
            createOrUpdateMetaTag("property", "og:image:height", "630");
            const ogImageExt = ogImage.toLowerCase().split('.').pop()?.split('?')[0] || 'png';
            const ogImageType = ['jpg', 'jpeg'].includes(ogImageExt) ? 'image/jpeg'
                : ogImageExt === 'gif' ? 'image/gif'
                    : ogImageExt === 'webp' ? 'image/webp'
                        : 'image/png';
            createOrUpdateMetaTag("property", "og:image:type", ogImageType);
        }
        createOrUpdateMetaTag("property", "og:locale", "en_US");
        if (canonicalUrl) {
            createOrUpdateMetaTag("property", "og:url", canonicalUrl);
            createOrUpdateLinkTag("canonical", canonicalUrl);
        }
        createOrUpdateMetaTag("name", "twitter:card", twitterCard);
        createOrUpdateMetaTag("name", "twitter:title", formattedTitle);
        createOrUpdateMetaTag("name", "twitter:description", description);
        if (ogImage) {
            const absoluteOgImage = ogImage.startsWith("http")
                ? ogImage
                : `${window.location.origin}${ogImage}`;
            createOrUpdateMetaTag("name", "twitter:image", absoluteOgImage);
            createOrUpdateMetaTag("name", "twitter:image:alt", title);
        }
        if (twitterSite) {
            createOrUpdateMetaTag("name", "twitter:site", twitterSite);
        }
        if (twitterCreator) {
            createOrUpdateMetaTag("name", "twitter:creator", twitterCreator);
        }
        additionalMetaTags.forEach(tag => {
            if (tag.name) {
                createOrUpdateMetaTag("name", tag.name, tag.content);
            }
            else if (tag.property) {
                createOrUpdateMetaTag("property", tag.property, tag.content);
            }
        });
        // Default SoftwareApplication structured data
        const defaultData = getDefaultStructuredData(effectiveSiteName);
        const mergedStructuredData = {
            ...defaultData,
            ...structuredData,
            url: canonicalUrl || structuredData?.url || window.location.origin,
            description: structuredData?.description || description
        };
        const jsonLdScript = getOrCreateJsonLdScript();
        jsonLdScript.textContent = JSON.stringify(mergedStructuredData, null, 2);
        // Organization structured data from SEO settings
        if (structuredDataOrg && Object.keys(structuredDataOrg).length > 0) {
            const orgSchema = {
                "@context": "https://schema.org",
                "@type": "Organization",
                name: structuredDataOrg.name || effectiveSiteName,
                url: structuredDataOrg.url || window.location.origin,
                ...(structuredDataOrg.logo && { logo: structuredDataOrg.logo }),
                ...(structuredDataOrg.description && { description: structuredDataOrg.description }),
                ...(structuredDataOrg.contactPoint && {
                    contactPoint: {
                        "@type": "ContactPoint",
                        ...structuredDataOrg.contactPoint
                    }
                }),
                ...(structuredDataOrg.sameAs && structuredDataOrg.sameAs.length > 0 && {
                    sameAs: structuredDataOrg.sameAs
                })
            };
            const orgScript = getOrCreateJsonLdScriptById("org");
            orgScript.textContent = JSON.stringify(orgSchema, null, 2);
        }
        // FAQ structured data from SEO settings
        if (structuredDataFaq && structuredDataFaq.length > 0) {
            const faqSchema = {
                "@context": "https://schema.org",
                "@type": "FAQPage",
                mainEntity: structuredDataFaq.map(item => ({
                    "@type": "Question",
                    name: item.question,
                    acceptedAnswer: {
                        "@type": "Answer",
                        text: item.answer
                    }
                }))
            };
            const faqScript = getOrCreateJsonLdScriptById("faq");
            faqScript.textContent = JSON.stringify(faqSchema, null, 2);
        }
        // Product structured data from SEO settings
        if (structuredDataProduct && structuredDataProduct.name) {
            // Map availability to schema.org URL format
            const availabilityMap = {
                'InStock': 'https://schema.org/InStock',
                'OutOfStock': 'https://schema.org/OutOfStock',
                'PreOrder': 'https://schema.org/PreOrder',
                'Discontinued': 'https://schema.org/Discontinued'
            };
            const productSchema = {
                "@context": "https://schema.org",
                "@type": "Product",
                name: structuredDataProduct.name
            };
            if (structuredDataProduct.description) {
                productSchema.description = structuredDataProduct.description;
            }
            if (structuredDataProduct.image) {
                productSchema.image = structuredDataProduct.image;
            }
            if (structuredDataProduct.sku) {
                productSchema.sku = structuredDataProduct.sku;
            }
            if (structuredDataProduct.url) {
                productSchema.url = structuredDataProduct.url;
            }
            if (structuredDataProduct.brand) {
                productSchema.brand = {
                    "@type": "Brand",
                    name: structuredDataProduct.brand
                };
            }
            // Add offers with price and availability
            if (structuredDataProduct.price || structuredDataProduct.availability) {
                const offers = {
                    "@type": "Offer"
                };
                if (structuredDataProduct.price) {
                    offers.price = structuredDataProduct.price;
                }
                if (structuredDataProduct.priceCurrency) {
                    offers.priceCurrency = structuredDataProduct.priceCurrency;
                }
                if (structuredDataProduct.availability && availabilityMap[structuredDataProduct.availability]) {
                    offers.availability = availabilityMap[structuredDataProduct.availability];
                }
                if (structuredDataProduct.url) {
                    offers.url = structuredDataProduct.url;
                }
                productSchema.offers = offers;
            }
            // Add aggregate rating if provided
            if (structuredDataProduct.ratingValue && structuredDataProduct.ratingCount) {
                productSchema.aggregateRating = {
                    "@type": "AggregateRating",
                    ratingValue: structuredDataProduct.ratingValue,
                    reviewCount: structuredDataProduct.ratingCount
                };
            }
            const productScript = getOrCreateJsonLdScriptById("product");
            productScript.textContent = JSON.stringify(productSchema, null, 2);
        }
        return () => {
            // Restore to branding title on cleanup
            document.title = branding.app_tagline
                ? `${effectiveSiteName} - ${branding.app_tagline}`
                : effectiveSiteName;
            removeMetaTag("name", "description");
            removeMetaTag("name", "keywords");
            removeMetaTag("name", "robots");
            removeMetaTag("name", "google-site-verification");
            removeMetaTag("name", "msvalidate.01");
            removeMetaTag("property", "fb:app_id");
            removeMetaTag("property", "og:title");
            removeMetaTag("property", "og:description");
            removeMetaTag("property", "og:type");
            removeMetaTag("property", "og:site_name");
            removeMetaTag("property", "og:image");
            removeMetaTag("property", "og:image:alt");
            removeMetaTag("property", "og:image:width");
            removeMetaTag("property", "og:image:height");
            removeMetaTag("property", "og:image:type");
            removeMetaTag("property", "og:locale");
            removeMetaTag("property", "og:url");
            removeMetaTag("name", "twitter:card");
            removeMetaTag("name", "twitter:title");
            removeMetaTag("name", "twitter:description");
            removeMetaTag("name", "twitter:image");
            removeMetaTag("name", "twitter:image:alt");
            removeMetaTag("name", "twitter:site");
            removeMetaTag("name", "twitter:creator");
            removeLinkTag("canonical");
            additionalMetaTags.forEach(tag => {
                if (tag.name) {
                    removeMetaTag("name", tag.name);
                }
                else if (tag.property) {
                    removeMetaTag("property", tag.property);
                }
            });
            removeJsonLdScript();
            removeJsonLdScriptById("org");
            removeJsonLdScriptById("faq");
            removeJsonLdScriptById("product");
        };
    }, [
        title,
        description,
        canonicalUrl,
        ogImage,
        keywords,
        structuredData,
        twitterCard,
        twitterSite,
        twitterCreator,
        ogType,
        effectiveSiteName,
        branding.app_tagline,
        noIndex,
        noFollow,
        additionalMetaTags,
        googleVerification,
        bingVerification,
        facebookAppId,
        structuredDataOrg,
        structuredDataFaq,
        structuredDataProduct
    ]);
    return null;
}
