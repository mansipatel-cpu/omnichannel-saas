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
import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Loader2, Star } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Switch } from "@/shared/components/ui/switch";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
            delayChildren: 0.1,
        },
    },
};
const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.6,
            ease: [0.25, 0.4, 0.25, 1],
        },
    },
};
export function PricingSection() {
    const [, setLocation] = useLocation();
    const [isYearly, setIsYearly] = useState(false);
    const shouldReduceMotion = useReducedMotion();
    const { t } = useTranslation();
    const { data: plans, isLoading: plansLoading } = useQuery({
        queryKey: ["/api/plans"],
    });
    const { data: pluginCapabilities } = useQuery({
        queryKey: ["/api/plugins/capabilities"],
    });
    const sipPluginEnabled = pluginCapabilities?.data?.capabilities?.['sip-engine'] ?? false;
    const restApiPluginEnabled = pluginCapabilities?.data?.capabilities?.['rest-api'] ?? false;
    const handleNavigate = () => {
        setLocation("/login");
    };
    // Sort all plans: free first, then by monthly price ascending
    const sortedPlans = [...(plans || [])].sort((a, b) => {
        if (a.name === 'free')
            return -1;
        if (b.name === 'free')
            return 1;
        const priceA = parseFloat(a.monthlyPrice || '0');
        const priceB = parseFloat(b.monthlyPrice || '0');
        return priceA - priceB;
    });
    const currencySymbol = '$';
    const getPrice = (plan) => {
        const price = isYearly ? plan.yearlyPrice : plan.monthlyPrice;
        return price ? parseFloat(price).toLocaleString() : '0';
    };
    return (<section id="pricing" className="py-12 sm:py-16 md:py-24 lg:py-32" data-testid="pricing-section">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="text-center space-y-3 sm:space-y-4 mb-8 sm:mb-10 md:mb-12">
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold" data-testid="pricing-headline">
            {t('landing.pricing.title')} <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-400">{t('landing.pricing.titleHighlight')}</span> {t('landing.pricing.titleEnd')}
          </h2>
          <p className="text-sm sm:text-base md:text-lg text-muted-foreground" data-testid="pricing-subheadline">
            {t('landing.pricing.description')}
          </p>
        </motion.div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-12">
          <div className="flex items-center gap-3 bg-muted/50 rounded-full px-4 py-2">
            <span className={`text-sm font-medium transition-colors ${!isYearly ? 'text-foreground' : 'text-muted-foreground'}`}>
              {t('landing.pricing.monthly')}
            </span>
            <Switch checked={isYearly} onCheckedChange={setIsYearly} data-testid="switch-billing-period"/>
            <span className={`text-sm font-medium transition-colors ${isYearly ? 'text-foreground' : 'text-muted-foreground'}`}>
              {t('landing.pricing.yearly')}
            </span>
            {isYearly && (<Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                {t('landing.pricing.save20')}
              </Badge>)}
          </div>
        </div>

        {plansLoading ? (<div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground"/>
          </div>) : (<motion.div variants={shouldReduceMotion ? {} : containerVariants} initial="hidden" whileInView="visible" viewport={{ once: true }} className={`grid grid-cols-1 ${sortedPlans.length === 2 ? 'md:grid-cols-2' : sortedPlans.length >= 3 ? 'md:grid-cols-2 lg:grid-cols-3' : 'md:grid-cols-1'} gap-4 sm:gap-6 md:gap-8 max-w-6xl mx-auto`} data-testid="pricing-grid">
            {sortedPlans.map((plan, index) => {
                const isFree = plan.name === 'free';
                // First paid plan (index 1 if free exists, or index 0 if no free plan) is highlighted
                const isHighlighted = !isFree && (sortedPlans[0]?.name === 'free' ? index === 1 : index === 0);
                const price = getPrice(plan);
                const maxWidgets = plan.maxWidgets ?? 1;
                return (<motion.div key={plan.id} variants={shouldReduceMotion ? {} : itemVariants} data-testid={`pricing-card-${index}`}>
                  <Card className={`p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl hover-elevate transition-all h-full ${isHighlighted
                        ? "relative border-2 border-amber-500/50 dark:border-amber-400/50 bg-gradient-to-br from-amber-50/50 to-orange-50/30 dark:from-amber-900/20 dark:to-orange-900/10 shadow-xl shadow-amber-500/20"
                        : ""}`}>
                    {isHighlighted && (<Badge className="absolute -top-3 right-6 bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 shadow-lg" data-testid="popular-badge">
                        {t('landing.pricing.popular')}
                      </Badge>)}
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-2xl sm:text-3xl font-bold" data-testid={`plan-name-${index}`}>
                          {plan.displayName}
                        </h3>
                        <p className="text-sm sm:text-base text-muted-foreground mt-2" data-testid={`plan-description-${index}`}>
                          {plan.description}
                        </p>
                      </div>
                      <div className="text-3xl sm:text-4xl md:text-5xl font-bold" data-testid={`plan-price-${index}`}>
                        {parseFloat(price) === 0 ? (<span>{t('landing.pricing.free')}</span>) : (<>
                            {currencySymbol}{price}
                            <span className="text-xl font-normal text-muted-foreground">
                              {isYearly ? t('landing.pricing.perYear') : t('landing.pricing.perMonth')}
                            </span>
                          </>)}
                      </div>
                      <div className="space-y-3" data-testid={`plan-features-${index}`}>
                        {plan.maxAgents >= 999 || plan.maxAgents === -1 ? (<div className="flex items-center gap-2">
                            <Check className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0"/>
                            <span className="text-sm font-medium">{t('landing.pricing.features.unlimitedAgents')}</span>
                          </div>) : (<div className="flex items-center gap-2">
                            <Check className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0"/>
                            <span className="text-sm">{t('landing.pricing.features.aiAgent', { count: plan.maxAgents })}</span>
                          </div>)}

                        {plan.maxCampaigns >= 999 || plan.maxCampaigns === -1 ? (<div className="flex items-center gap-2">
                            <Check className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0"/>
                            <span className="text-sm font-medium">{t('landing.pricing.features.unlimitedCampaigns')}</span>
                          </div>) : (<div className="flex items-center gap-2">
                            <Check className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0"/>
                            <span className="text-sm">{t('landing.pricing.features.campaign', { count: plan.maxCampaigns })}</span>
                          </div>)}

                        {plan.maxContactsPerCampaign >= 9999 || plan.maxContactsPerCampaign === -1 ? (<div className="flex items-center gap-2">
                            <Check className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0"/>
                            <span className="text-sm font-medium">{t('landing.pricing.features.unlimitedContacts')}</span>
                          </div>) : (<div className="flex items-center gap-2">
                            <Check className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0"/>
                            <span className="text-sm">{t('landing.pricing.features.maxContacts', { count: plan.maxContactsPerCampaign })}</span>
                          </div>)}

                        {plan.canPurchaseNumbers ? (<div className="flex items-center gap-2">
                            <Check className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0"/>
                            <span className="text-sm">{t('landing.pricing.features.ownPhoneNumbers')}</span>
                          </div>) : (<div className="flex items-center gap-2">
                            <Check className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0"/>
                            <span className="text-sm">{t('landing.pricing.features.systemAssignedNumber')}</span>
                          </div>)}

                        {plan.canChooseLlm && (<div className="flex items-center gap-2">
                            <Check className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0"/>
                            <span className="text-sm">{t('landing.pricing.features.chooseLlm')}</span>
                          </div>)}

                        {plan.maxFlows !== undefined && plan.maxFlows > 0 && (<div className="flex items-center gap-2">
                            <Check className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0"/>
                            <span className={`text-sm ${plan.maxFlows >= 999 ? "font-medium" : ""}`}>
                              {plan.maxFlows >= 999 ? t('landing.pricing.features.unlimitedFlows') : t('landing.pricing.features.flowAutomation', { count: plan.maxFlows })}
                            </span>
                          </div>)}

                        {plan.maxKnowledgeBases !== undefined && plan.maxKnowledgeBases > 0 && (<div className="flex items-center gap-2">
                            <Check className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0"/>
                            <span className={`text-sm ${plan.maxKnowledgeBases >= 999 ? "font-medium" : ""}`}>
                              {plan.maxKnowledgeBases >= 999 ? t('landing.pricing.features.unlimitedKnowledgeBases') : t('landing.pricing.features.knowledgeBase', { count: plan.maxKnowledgeBases })}
                            </span>
                          </div>)}

                        {plan.maxWebhooks !== undefined && plan.maxWebhooks > 0 && (<div className="flex items-center gap-2">
                            <Check className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0"/>
                            <span className={`text-sm ${plan.maxWebhooks >= 999 ? "font-medium" : ""}`}>
                              {plan.maxWebhooks >= 999 ? t('landing.pricing.features.unlimitedWebhooks') : t('landing.pricing.features.webhook', { count: plan.maxWebhooks })}
                            </span>
                          </div>)}

                        {plan.maxPhoneNumbers !== undefined && plan.maxPhoneNumbers > 0 && (<div className="flex items-center gap-2">
                            <Check className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0"/>
                            <span className={`text-sm ${plan.maxPhoneNumbers >= 999 ? "font-medium" : ""}`}>
                              {plan.maxPhoneNumbers >= 999 ? t('landing.pricing.features.unlimitedPhoneNumbers') : t('landing.pricing.features.phoneNumber', { count: plan.maxPhoneNumbers })}
                            </span>
                          </div>)}

                        {maxWidgets > 0 && (<div className="flex items-center gap-2">
                            <Check className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0"/>
                            <span className={`text-sm ${maxWidgets >= 999 ? "font-medium" : ""}`}>
                              {maxWidgets >= 999 ? t('landing.pricing.features.unlimitedWidgets') : t('landing.pricing.features.websiteWidget', { count: maxWidgets })}
                            </span>
                          </div>)}

                        {plan.includedCredits > 0 && (<div className="flex items-center gap-2">
                            <Star className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0"/>
                            <span className="text-sm font-medium">{t('landing.pricing.features.includedCredits', { count: plan.includedCredits })}</span>
                          </div>)}

                        {!isFree && (<div className="flex items-center gap-2">
                            <Check className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0"/>
                            <span className="text-sm">{t('landing.pricing.features.prioritySupport')}</span>
                          </div>)}

                        {sipPluginEnabled && plan.sipEnabled && !isFree && (<div className="flex items-center gap-2">
                            <Check className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0"/>
                            <span className="text-sm">{t('landing.pricing.features.sipTrunkAccess')}</span>
                          </div>)}

                        {restApiPluginEnabled && plan.restApiEnabled && !isFree && (<div className="flex items-center gap-2">
                            <Check className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0"/>
                            <span className="text-sm">{t('landing.pricing.features.restApiAccess')}</span>
                          </div>)}
                      </div>
                      <Button variant={isHighlighted ? "default" : "outline"} size="lg" className={`w-full h-14 text-lg ${isHighlighted
                        ? "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0 shadow-lg shadow-amber-500/30"
                        : "border-amber-300 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20"}`} onClick={handleNavigate} data-testid={`button-plan-${index}`}>
                        {isHighlighted ? t('landing.pricing.startFreeTrial') : t('landing.pricing.getStarted')}
                      </Button>
                    </div>
                  </Card>
                </motion.div>);
            })}
          </motion.div>)}
        
        <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.5 }} className="text-center text-muted-foreground mt-8">
          {t('landing.pricing.guarantee')}
        </motion.p>
      </div>
    </section>);
}
export default PricingSection;
