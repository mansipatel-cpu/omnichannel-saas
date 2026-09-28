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
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/shared/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Switch } from "@/shared/components/ui/switch";
import { useToast } from "@/shared/hooks/use-toast";
import { useState, useMemo } from "react";
import { Loader2, Trash2, AlertTriangle } from "lucide-react";
import { InfoTooltip } from "@/shared/components/ui/info-tooltip";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from "@/shared/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/shared/components/ui/select";
import { useTranslation } from "react-i18next";
export default function PlanManagement() {
    const { t } = useTranslation();
    const { toast } = useToast();
    const [editingPlan, setEditingPlan] = useState(null);
    const [planForms, setPlanForms] = useState({});
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [deletingPlan, setDeletingPlan] = useState(null);
    const [migrationState, setMigrationState] = useState(null);
    const [newPlanForm, setNewPlanForm] = useState({
        name: "",
        displayName: "",
        description: "",
        monthlyPrice: 0,
        yearlyPrice: 0,
        razorpayMonthlyPrice: 0,
        razorpayYearlyPrice: 0,
        paypalMonthlyPrice: 0,
        paypalYearlyPrice: 0,
        paystackMonthlyPrice: 0,
        paystackYearlyPrice: 0,
        mercadopagoMonthlyPrice: 0,
        mercadopagoYearlyPrice: 0,
        yookassaMonthlyPrice: 0,
        yookassaYearlyPrice: 0,
        maxAgents: 1,
        maxCampaigns: 1,
        maxContactsPerCampaign: 5,
        maxWebhooks: 3,
        maxKnowledgeBases: 5,
        maxFlows: 3,
        maxPhoneNumbers: 1,
        maxWidgets: 1,
        includedCredits: 100,
        canChooseLlm: false,
        canPurchaseNumbers: false,
        useSystemPool: false,
        sipEnabled: false,
        maxConcurrentSipCalls: 1,
        restApiEnabled: false,
        isActive: true
    });
    const { data: plans, isLoading, isError } = useQuery({
        queryKey: ["/api/admin/plans"],
    });
    const { data: adminSettings } = useQuery({
        queryKey: ["/api/admin/settings"],
    });
    // Fetch plugin capabilities to conditionally show plugin-related options
    const { data: pluginCapabilities } = useQuery({
        queryKey: ["/api/plugins/capabilities"],
    });
    // Check if SIP Engine and REST API plugins are installed
    const sipPluginInstalled = useMemo(() => {
        return pluginCapabilities?.data?.capabilities?.['sip-engine'] ?? false;
    }, [pluginCapabilities]);
    const restApiPluginInstalled = useMemo(() => {
        return pluginCapabilities?.data?.capabilities?.['rest-api'] ?? false;
    }, [pluginCapabilities]);
    // Get the Stripe currency (defaults to USD if not set)
    const stripeCurrency = adminSettings?.stripe_currency || "USD";
    const getCurrencySymbol = (currency) => {
        const symbols = {
            USD: "$",
            EUR: "€",
            GBP: "£",
            INR: "₹",
            AUD: "A$",
            CAD: "C$",
            JPY: "¥",
            CNY: "¥",
            NGN: "₦",
            GHS: "₵",
            ZAR: "R",
            KES: "KSh",
            BRL: "R$",
            MXN: "MX$",
            ARS: "AR$",
            CLP: "CLP$",
            COP: "COP$",
            RUB: "₽",
        };
        return symbols[currency] || currency + " ";
    };
    const stripeCurrencySymbol = getCurrencySymbol(stripeCurrency);
    const createPlan = useMutation({
        mutationFn: async (planData) => {
            return apiRequest("POST", "/api/admin/plans", planData);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/admin/plans"] });
            toast({ title: t("adminDashboard.plans.planCreated") });
            setShowCreateForm(false);
            setNewPlanForm({
                name: "",
                displayName: "",
                description: "",
                monthlyPrice: 0,
                yearlyPrice: 0,
                razorpayMonthlyPrice: 0,
                razorpayYearlyPrice: 0,
                paypalMonthlyPrice: 0,
                paypalYearlyPrice: 0,
                paystackMonthlyPrice: 0,
                paystackYearlyPrice: 0,
                mercadopagoMonthlyPrice: 0,
                mercadopagoYearlyPrice: 0,
                yookassaMonthlyPrice: 0,
                yookassaYearlyPrice: 0,
                maxAgents: 1,
                maxCampaigns: 1,
                maxContactsPerCampaign: 5,
                maxWebhooks: 3,
                maxKnowledgeBases: 5,
                maxFlows: 3,
                maxPhoneNumbers: 1,
                maxWidgets: 1,
                includedCredits: 100,
                canChooseLlm: false,
                canPurchaseNumbers: false,
                useSystemPool: false,
                sipEnabled: false,
                maxConcurrentSipCalls: 1,
                restApiEnabled: false,
                isActive: true
            });
        },
        onError: (error) => {
            toast({
                title: t("adminDashboard.plans.createFailed"),
                description: error.message,
                variant: "destructive"
            });
        }
    });
    const updatePlan = useMutation({
        mutationFn: async ({ planId, updates }) => {
            return apiRequest("PATCH", `/api/admin/plans/${planId}`, updates);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/admin/plans"] });
            toast({ title: t("adminDashboard.plans.planUpdated") });
            setEditingPlan(null);
        },
        onError: (error) => {
            toast({
                title: t("adminDashboard.plans.updateFailed"),
                description: error.message,
                variant: "destructive"
            });
        }
    });
    const deletePlan = useMutation({
        mutationFn: async (planId) => {
            const response = await apiRequest("DELETE", `/api/admin/plans/${planId}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw { response: { json: () => Promise.resolve(errorData) }, ...errorData };
            }
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/admin/plans"] });
            toast({ title: t("adminDashboard.plans.planDeleted") });
            setDeletingPlan(null);
            setMigrationState(null);
        },
        onError: async (error) => {
            // Check if this is a migration required error
            if (error.error === 'USERS_NEED_MIGRATION' && deletingPlan) {
                // Show migration dialog
                setMigrationState({
                    plan: deletingPlan,
                    userCount: error.userCount || 0,
                    targetPlanId: ''
                });
                setDeletingPlan(null);
                return;
            }
            toast({
                title: error?.error || t("adminDashboard.plans.deleteFailed"),
                description: error?.message || 'Failed to delete plan',
                variant: "destructive"
            });
            setDeletingPlan(null);
        }
    });
    const migrateUsers = useMutation({
        mutationFn: async ({ planId, targetPlanId }) => {
            const response = await apiRequest("POST", `/api/admin/plans/${planId}/migrate`, { targetPlanId });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Migration failed');
            }
            return response.json();
        },
        onSuccess: (data) => {
            toast({
                title: t("adminDashboard.plans.usersMigrated"),
                description: t("adminDashboard.plans.usersMigratedDesc", {
                    count: data.migratedCount,
                    plan: data.targetPlanName
                })
            });
            // Now delete the plan
            if (migrationState) {
                deletePlan.mutate(migrationState.plan.id);
            }
        },
        onError: (error) => {
            toast({
                title: t("adminDashboard.plans.migrationFailed"),
                description: error.message,
                variant: "destructive"
            });
        }
    });
    const handleEdit = (plan) => {
        setEditingPlan(plan.id);
        setPlanForms({
            ...planForms,
            [plan.id]: { ...plan }
        });
    };
    const handleSave = (planId) => {
        const updates = planForms[planId];
        if (!updates)
            return;
        // Normalize price fields to handle NaN and empty values
        const normalizedUpdates = { ...updates };
        // Handle USD price fields (must be numbers, default to 0)
        if (normalizedUpdates.monthlyPrice !== undefined) {
            const val = normalizedUpdates.monthlyPrice;
            if (typeof val === 'number' && isNaN(val)) {
                normalizedUpdates.monthlyPrice = 0;
            }
        }
        if (normalizedUpdates.yearlyPrice !== undefined) {
            const val = normalizedUpdates.yearlyPrice;
            if (typeof val === 'number' && isNaN(val)) {
                normalizedUpdates.yearlyPrice = 0;
            }
        }
        // Handle gateway price fields (can be null, treat NaN and 0 as null)
        // Razorpay
        if (normalizedUpdates.razorpayMonthlyPrice !== undefined) {
            const val = normalizedUpdates.razorpayMonthlyPrice;
            if (val === null || (typeof val === 'number' && (isNaN(val) || val === 0))) {
                normalizedUpdates.razorpayMonthlyPrice = null;
            }
        }
        if (normalizedUpdates.razorpayYearlyPrice !== undefined) {
            const val = normalizedUpdates.razorpayYearlyPrice;
            if (val === null || (typeof val === 'number' && (isNaN(val) || val === 0))) {
                normalizedUpdates.razorpayYearlyPrice = null;
            }
        }
        // PayPal
        if (normalizedUpdates.paypalMonthlyPrice !== undefined) {
            const val = normalizedUpdates.paypalMonthlyPrice;
            if (val === null || (typeof val === 'number' && (isNaN(val) || val === 0))) {
                normalizedUpdates.paypalMonthlyPrice = null;
            }
        }
        if (normalizedUpdates.paypalYearlyPrice !== undefined) {
            const val = normalizedUpdates.paypalYearlyPrice;
            if (val === null || (typeof val === 'number' && (isNaN(val) || val === 0))) {
                normalizedUpdates.paypalYearlyPrice = null;
            }
        }
        // Paystack
        if (normalizedUpdates.paystackMonthlyPrice !== undefined) {
            const val = normalizedUpdates.paystackMonthlyPrice;
            if (val === null || (typeof val === 'number' && (isNaN(val) || val === 0))) {
                normalizedUpdates.paystackMonthlyPrice = null;
            }
        }
        if (normalizedUpdates.paystackYearlyPrice !== undefined) {
            const val = normalizedUpdates.paystackYearlyPrice;
            if (val === null || (typeof val === 'number' && (isNaN(val) || val === 0))) {
                normalizedUpdates.paystackYearlyPrice = null;
            }
        }
        // MercadoPago
        if (normalizedUpdates.mercadopagoMonthlyPrice !== undefined) {
            const val = normalizedUpdates.mercadopagoMonthlyPrice;
            if (val === null || (typeof val === 'number' && (isNaN(val) || val === 0))) {
                normalizedUpdates.mercadopagoMonthlyPrice = null;
            }
        }
        if (normalizedUpdates.mercadopagoYearlyPrice !== undefined) {
            const val = normalizedUpdates.mercadopagoYearlyPrice;
            if (val === null || (typeof val === 'number' && (isNaN(val) || val === 0))) {
                normalizedUpdates.mercadopagoYearlyPrice = null;
            }
        }
        // YooKassa
        if (normalizedUpdates.yookassaMonthlyPrice !== undefined) {
            const val = normalizedUpdates.yookassaMonthlyPrice;
            if (val === null || (typeof val === 'number' && (isNaN(val) || val === 0))) {
                normalizedUpdates.yookassaMonthlyPrice = null;
            }
        }
        if (normalizedUpdates.yookassaYearlyPrice !== undefined) {
            const val = normalizedUpdates.yookassaYearlyPrice;
            if (val === null || (typeof val === 'number' && (isNaN(val) || val === 0))) {
                normalizedUpdates.yookassaYearlyPrice = null;
            }
        }
        updatePlan.mutate({ planId, updates: normalizedUpdates });
    };
    const handleCancel = () => {
        setEditingPlan(null);
    };
    const updateField = (planId, field, value) => {
        setPlanForms({
            ...planForms,
            [planId]: {
                ...planForms[planId],
                [field]: value
            }
        });
    };
    const updateNewPlanField = (field, value) => {
        setNewPlanForm({
            ...newPlanForm,
            [field]: value
        });
    };
    const handleCreatePlan = () => {
        createPlan.mutate(newPlanForm);
    };
    if (isLoading) {
        return (<div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin"/>
      </div>);
    }
    return (<div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl md:text-2xl font-bold">{t("adminDashboard.plans.title")}</h2>
          <p className="text-muted-foreground text-sm md:text-base">
            {t("adminDashboard.plans.description")}
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(!showCreateForm)} data-testid="button-toggle-create-plan">
          {showCreateForm ? t("common.cancel") : t("adminDashboard.plans.addNewPlan")}
        </Button>
      </div>

      {showCreateForm && (<Card>
          <CardHeader>
            <CardTitle>{t("adminDashboard.plans.createNewPlan")}</CardTitle>
            <CardDescription>{t("adminDashboard.plans.createDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>{t("adminDashboard.plans.planName")}</Label>
                <Input type="text" placeholder={t("adminDashboard.plans.planNamePlaceholder")} value={newPlanForm.name} onChange={(e) => updateNewPlanField("name", e.target.value)} data-testid="input-new-plan-name"/>
              </div>
              <div>
                <Label>{t("adminDashboard.plans.displayName")}</Label>
                <Input type="text" placeholder={t("adminDashboard.plans.displayNamePlaceholder")} value={newPlanForm.displayName} onChange={(e) => updateNewPlanField("displayName", e.target.value)} data-testid="input-new-plan-display-name"/>
              </div>
            </div>

            <div>
              <Label>{t("adminDashboard.plans.descriptionLabel")}</Label>
              <Input type="text" placeholder={t("adminDashboard.plans.descriptionPlaceholder")} value={newPlanForm.description} onChange={(e) => updateNewPlanField("description", e.target.value)} data-testid="input-new-plan-description"/>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Monthly Price ({stripeCurrency})</Label>
                  <Input type="number" step="0.01" value={newPlanForm.monthlyPrice} onChange={(e) => updateNewPlanField("monthlyPrice", parseFloat(e.target.value))} data-testid="input-new-plan-monthly"/>
                </div>
                <div>
                  <Label>Yearly Price ({stripeCurrency})</Label>
                  <Input type="number" step="0.01" value={newPlanForm.yearlyPrice} onChange={(e) => updateNewPlanField("yearlyPrice", parseFloat(e.target.value))} data-testid="input-new-plan-yearly"/>
                </div>
              </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="flex items-center">
                  <Label>{t("adminDashboard.plans.maxAgents")}</Label>
                  <InfoTooltip content="Use -1 for unlimited"/>
                </div>
                <Input type="number" value={newPlanForm.maxAgents} onChange={(e) => updateNewPlanField("maxAgents", parseInt(e.target.value, 10))} data-testid="input-new-plan-agents"/>
              </div>
              <div>
                <div className="flex items-center">
                  <Label>{t("adminDashboard.plans.maxCampaigns")}</Label>
                  <InfoTooltip content="Use -1 for unlimited"/>
                </div>
                <Input type="number" value={newPlanForm.maxCampaigns} onChange={(e) => updateNewPlanField("maxCampaigns", parseInt(e.target.value, 10))} data-testid="input-new-plan-campaigns"/>
              </div>
              <div>
                <div className="flex items-center">
                  <Label>{t("adminDashboard.plans.maxContacts")}</Label>
                  <InfoTooltip content="Use -1 for unlimited"/>
                </div>
                <Input type="number" value={newPlanForm.maxContactsPerCampaign} onChange={(e) => updateNewPlanField("maxContactsPerCampaign", parseInt(e.target.value, 10))} data-testid="input-new-plan-contacts"/>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div>
                <div className="flex items-center">
                  <Label>{t("adminDashboard.plans.maxWebhooks", "Max Webhooks")}</Label>
                  <InfoTooltip content="Use -1 for unlimited"/>
                </div>
                <Input type="number" value={newPlanForm.maxWebhooks} onChange={(e) => updateNewPlanField("maxWebhooks", parseInt(e.target.value, 10))} data-testid="input-new-plan-webhooks"/>
              </div>
              <div>
                <div className="flex items-center">
                  <Label>{t("adminDashboard.plans.maxKnowledgeBases", "Max KBs")}</Label>
                  <InfoTooltip content="Use -1 for unlimited"/>
                </div>
                <Input type="number" value={newPlanForm.maxKnowledgeBases} onChange={(e) => updateNewPlanField("maxKnowledgeBases", parseInt(e.target.value, 10))} data-testid="input-new-plan-kbs"/>
              </div>
              <div>
                <div className="flex items-center">
                  <Label>{t("adminDashboard.plans.maxFlows", "Max Flows")}</Label>
                  <InfoTooltip content="Use -1 for unlimited"/>
                </div>
                <Input type="number" value={newPlanForm.maxFlows} onChange={(e) => updateNewPlanField("maxFlows", parseInt(e.target.value, 10))} data-testid="input-new-plan-flows"/>
              </div>
              <div>
                <div className="flex items-center">
                  <Label>{t("adminDashboard.plans.maxPhoneNumbers", "Max Phone #s")}</Label>
                  <InfoTooltip content="Use -1 for unlimited"/>
                </div>
                <Input type="number" value={newPlanForm.maxPhoneNumbers} onChange={(e) => updateNewPlanField("maxPhoneNumbers", parseInt(e.target.value, 10))} data-testid="input-new-plan-phones"/>
              </div>
              <div>
                <div className="flex items-center">
                  <Label>{t("adminDashboard.plans.maxWidgets", "Max Widgets")}</Label>
                  <InfoTooltip content="Use -1 for unlimited"/>
                </div>
                <Input type="number" value={newPlanForm.maxWidgets} onChange={(e) => updateNewPlanField("maxWidgets", parseInt(e.target.value, 10))} data-testid="input-new-plan-widgets"/>
              </div>
            </div>

            <div>
              <div className="flex items-center">
                <Label>{t("adminDashboard.plans.includedCredits")}</Label>
                <InfoTooltip content="Credits included with plan (0 for none)"/>
              </div>
              <Input type="number" value={newPlanForm.includedCredits} onChange={(e) => updateNewPlanField("includedCredits", parseInt(e.target.value, 10))} data-testid="input-new-plan-credits"/>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t("adminDashboard.plans.canChooseLlm")}</Label>
                <Switch checked={newPlanForm.canChooseLlm} onCheckedChange={(checked) => updateNewPlanField("canChooseLlm", checked)} data-testid="switch-new-plan-llm"/>
              </div>
              <div className="flex items-center justify-between">
                <Label>{t("adminDashboard.plans.canPurchaseNumbers")}</Label>
                <Switch checked={newPlanForm.canPurchaseNumbers} onCheckedChange={(checked) => updateNewPlanField("canPurchaseNumbers", checked)} data-testid="switch-new-plan-numbers"/>
              </div>
              <div className="flex items-center justify-between">
                <Label>{t("adminDashboard.plans.useSystemPool")}</Label>
                <Switch checked={newPlanForm.useSystemPool} onCheckedChange={(checked) => updateNewPlanField("useSystemPool", checked)} data-testid="switch-new-plan-pool"/>
              </div>
              {sipPluginInstalled && (<div className="flex items-center justify-between">
                  <Label>SIP Trunk Access</Label>
                  <Switch checked={newPlanForm.sipEnabled} onCheckedChange={(checked) => updateNewPlanField("sipEnabled", checked)} data-testid="switch-new-plan-sip"/>
                </div>)}
              {sipPluginInstalled && newPlanForm.sipEnabled && (<div className="flex items-center justify-between">
                  <Label>Max Concurrent SIP Calls</Label>
                  <Input type="number" min={1} value={newPlanForm.maxConcurrentSipCalls ?? 1} onChange={(e) => updateNewPlanField("maxConcurrentSipCalls", parseInt(e.target.value, 10) || 1)} className="w-24 text-right" data-testid="input-new-plan-max-concurrent-sip"/>
                </div>)}
              {restApiPluginInstalled && (<div className="flex items-center justify-between">
                  <Label>REST API Access</Label>
                  <Switch checked={newPlanForm.restApiEnabled} onCheckedChange={(checked) => updateNewPlanField("restApiEnabled", checked)} data-testid="switch-new-plan-restapi"/>
                </div>)}
              <div className="flex items-center justify-between">
                <Label>{t("adminDashboard.plans.activeLabel")}</Label>
                <Switch checked={newPlanForm.isActive} onCheckedChange={(checked) => updateNewPlanField("isActive", checked)} data-testid="switch-new-plan-active"/>
              </div>
            </div>

            <Button onClick={handleCreatePlan} disabled={createPlan.isPending} data-testid="button-create-plan">
              {createPlan.isPending ? (<>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                  {t("adminDashboard.plans.creating")}
                </>) : (t("adminDashboard.plans.createPlan"))}
            </Button>
          </CardContent>
        </Card>)}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {plans?.map((plan) => {
            const isEditing = editingPlan === plan.id;
            const formData = planForms[plan.id] || plan;
            return (<Card key={plan.id}>
              <CardHeader>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <CardTitle className="text-xl">
                    {plan.displayName}
                  </CardTitle>
                </div>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isEditing ? (<>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Monthly Price ({stripeCurrency})</Label>
                          <Input type="number" step="0.01" value={formData.monthlyPrice} onChange={(e) => updateField(plan.id, "monthlyPrice", parseFloat(e.target.value))} data-testid={`input-plan-monthly-${plan.id}`}/>
                        </div>
                        <div>
                          <Label>Yearly Price ({stripeCurrency})</Label>
                          <Input type="number" step="0.01" value={formData.yearlyPrice} onChange={(e) => updateField(plan.id, "yearlyPrice", parseFloat(e.target.value))} data-testid={`input-plan-yearly-${plan.id}`}/>
                        </div>
                      </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="flex items-center">
                          <Label>{t("adminDashboard.plans.maxAgents")}</Label>
                          <InfoTooltip content="Use -1 for unlimited"/>
                        </div>
                        <Input type="number" value={formData.maxAgents} onChange={(e) => updateField(plan.id, "maxAgents", parseInt(e.target.value, 10))} data-testid={`input-plan-agents-${plan.id}`}/>
                      </div>
                      <div>
                        <div className="flex items-center">
                          <Label>{t("adminDashboard.plans.maxCampaigns")}</Label>
                          <InfoTooltip content="Use -1 for unlimited"/>
                        </div>
                        <Input type="number" value={formData.maxCampaigns} onChange={(e) => updateField(plan.id, "maxCampaigns", parseInt(e.target.value, 10))} data-testid={`input-plan-campaigns-${plan.id}`}/>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="flex items-center">
                          <Label>{t("adminDashboard.plans.maxContactsPerCampaign")}</Label>
                          <InfoTooltip content="Use -1 for unlimited"/>
                        </div>
                        <Input type="number" value={formData.maxContactsPerCampaign} onChange={(e) => updateField(plan.id, "maxContactsPerCampaign", parseInt(e.target.value, 10))} data-testid={`input-plan-contacts-${plan.id}`}/>
                      </div>
                      <div>
                        <div className="flex items-center">
                          <Label>{t("adminDashboard.plans.includedCredits")}</Label>
                          <InfoTooltip content="Credits included with plan (0 for none)"/>
                        </div>
                        <Input type="number" value={formData.includedCredits} onChange={(e) => updateField(plan.id, "includedCredits", parseInt(e.target.value, 10))} data-testid={`input-plan-credits-${plan.id}`}/>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <div className="flex items-center">
                          <Label>{t("adminDashboard.plans.maxWebhooks", "Max Webhooks")}</Label>
                          <InfoTooltip content="Use -1 for unlimited"/>
                        </div>
                        <Input type="number" value={formData.maxWebhooks ?? 3} onChange={(e) => updateField(plan.id, "maxWebhooks", parseInt(e.target.value, 10))} data-testid={`input-plan-webhooks-${plan.id}`}/>
                      </div>
                      <div>
                        <div className="flex items-center">
                          <Label>{t("adminDashboard.plans.maxKnowledgeBases", "Max KBs")}</Label>
                          <InfoTooltip content="Use -1 for unlimited"/>
                        </div>
                        <Input type="number" value={formData.maxKnowledgeBases ?? 5} onChange={(e) => updateField(plan.id, "maxKnowledgeBases", parseInt(e.target.value, 10))} data-testid={`input-plan-kbs-${plan.id}`}/>
                      </div>
                      <div>
                        <div className="flex items-center">
                          <Label>{t("adminDashboard.plans.maxFlows", "Max Flows")}</Label>
                          <InfoTooltip content="Use -1 for unlimited"/>
                        </div>
                        <Input type="number" value={formData.maxFlows ?? 3} onChange={(e) => updateField(plan.id, "maxFlows", parseInt(e.target.value, 10))} data-testid={`input-plan-flows-${plan.id}`}/>
                      </div>
                      <div>
                        <div className="flex items-center">
                          <Label>{t("adminDashboard.plans.maxPhoneNumbers", "Max Phone #s")}</Label>
                          <InfoTooltip content="Use -1 for unlimited"/>
                        </div>
                        <Input type="number" value={formData.maxPhoneNumbers ?? 1} onChange={(e) => updateField(plan.id, "maxPhoneNumbers", parseInt(e.target.value, 10))} data-testid={`input-plan-phones-${plan.id}`}/>
                      </div>
                      <div>
                        <div className="flex items-center">
                          <Label>{t("adminDashboard.plans.maxWidgets", "Max Widgets")}</Label>
                          <InfoTooltip content="Use -1 for unlimited"/>
                        </div>
                        <Input type="number" value={formData.maxWidgets ?? 1} onChange={(e) => updateField(plan.id, "maxWidgets", parseInt(e.target.value, 10))} data-testid={`input-plan-widgets-${plan.id}`}/>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>{t("adminDashboard.plans.canChooseLlm")}</Label>
                        <Switch checked={formData.canChooseLlm} onCheckedChange={(checked) => updateField(plan.id, "canChooseLlm", checked)}/>
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>{t("adminDashboard.plans.canPurchaseNumbers")}</Label>
                        <Switch checked={formData.canPurchaseNumbers} onCheckedChange={(checked) => updateField(plan.id, "canPurchaseNumbers", checked)}/>
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>{t("adminDashboard.plans.useSystemPool")}</Label>
                        <Switch checked={formData.useSystemPool} onCheckedChange={(checked) => updateField(plan.id, "useSystemPool", checked)}/>
                      </div>
                      {sipPluginInstalled && (<div className="flex items-center justify-between">
                          <Label>SIP Trunk Access</Label>
                          <Switch checked={formData.sipEnabled} onCheckedChange={(checked) => updateField(plan.id, "sipEnabled", checked)}/>
                        </div>)}
                      {sipPluginInstalled && formData.sipEnabled && (<div className="flex items-center justify-between">
                          <Label>Max Concurrent SIP Calls</Label>
                          <Input type="number" min={1} value={formData.maxConcurrentSipCalls ?? plan.maxConcurrentSipCalls ?? 1} onChange={(e) => updateField(plan.id, "maxConcurrentSipCalls", parseInt(e.target.value, 10) || 1)} className="w-24 text-right" data-testid={`input-plan-max-concurrent-sip-${plan.id}`}/>
                        </div>)}
                      {restApiPluginInstalled && (<div className="flex items-center justify-between">
                          <Label>REST API Access</Label>
                          <Switch checked={formData.restApiEnabled} onCheckedChange={(checked) => updateField(plan.id, "restApiEnabled", checked)}/>
                        </div>)}
                    </div>

                    <div className="flex gap-2">
                      <Button onClick={() => handleSave(plan.id)} disabled={updatePlan.isPending} data-testid={`button-save-plan-${plan.id}`}>
                        {updatePlan.isPending ? (<>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                            {t("common.saving")}
                          </>) : (t("common.saveChanges"))}
                      </Button>
                      <Button variant="outline" onClick={handleCancel} disabled={updatePlan.isPending}>
                        {t("common.cancel")}
                      </Button>
                    </div>
                  </>) : (<>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                          <span className="text-muted-foreground">Pricing ({stripeCurrency})</span>
                          <span>{stripeCurrencySymbol}{plan.monthlyPrice}{t("adminDashboard.plans.perMonth")} {t("adminDashboard.plans.or")} {stripeCurrencySymbol}{plan.yearlyPrice}{t("adminDashboard.plans.perYear")}</span>
                        </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("adminDashboard.plans.maxAgents")}:</span>
                        <span>{plan.maxAgents === 999 ? t("adminDashboard.plans.unlimited") : plan.maxAgents}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("adminDashboard.plans.maxCampaigns")}:</span>
                        <span>{plan.maxCampaigns === 999 ? t("adminDashboard.plans.unlimited") : plan.maxCampaigns}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("adminDashboard.plans.maxContacts")}:</span>
                        <span>{plan.maxContactsPerCampaign === 999999 ? t("adminDashboard.plans.unlimited") : plan.maxContactsPerCampaign}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("adminDashboard.plans.maxWebhooks", "Max Webhooks")}:</span>
                        <span>{plan.maxWebhooks === 999 ? t("adminDashboard.plans.unlimited") : (plan.maxWebhooks ?? 3)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("adminDashboard.plans.maxKnowledgeBases", "Max KBs")}:</span>
                        <span>{plan.maxKnowledgeBases === 999 ? t("adminDashboard.plans.unlimited") : (plan.maxKnowledgeBases ?? 5)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("adminDashboard.plans.maxFlows", "Max Flows")}:</span>
                        <span>{plan.maxFlows === 999 ? t("adminDashboard.plans.unlimited") : (plan.maxFlows ?? 3)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("adminDashboard.plans.maxPhoneNumbers", "Max Phone #s")}:</span>
                        <span>{plan.maxPhoneNumbers === 999 ? t("adminDashboard.plans.unlimited") : (plan.maxPhoneNumbers ?? 1)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("adminDashboard.plans.maxWidgets", "Max Widgets")}:</span>
                        <span>{plan.maxWidgets === 999 ? t("adminDashboard.plans.unlimited") : (plan.maxWidgets ?? 1)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("adminDashboard.plans.includedCredits")}:</span>
                        <span>{plan.includedCredits}</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button onClick={() => handleEdit(plan)} data-testid={`button-edit-plan-${plan.id}`} variant="outline" className="flex-1">
                        {t("adminDashboard.plans.editPlan")}
                      </Button>
                      <Button onClick={() => setDeletingPlan(plan)} data-testid={`button-delete-plan-${plan.id}`} variant="destructive">
                        <Trash2 className="h-4 w-4"/>
                      </Button>
                    </div>
                  </>)}
              </CardContent>
            </Card>);
        })}
      </div>

      <AlertDialog open={!!deletingPlan} onOpenChange={(open) => !open && setDeletingPlan(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("adminDashboard.plans.deletePlan")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("adminDashboard.plans.deletePlanConfirm", { name: deletingPlan?.displayName })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePlan.isPending}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingPlan && deletePlan.mutate(deletingPlan.id)} disabled={deletePlan.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deletePlan.isPending ? (<>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin"/>
                  {t("common.deleting")}
                </>) : (t("adminDashboard.plans.deletePlan"))}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Migration Dialog - shown when trying to delete a plan with active users */}
      <AlertDialog open={!!migrationState} onOpenChange={(open) => !open && setMigrationState(null)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500"/>
              {t("adminDashboard.plans.migrationRequired")}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>
                  {t("adminDashboard.plans.migrationRequiredDesc", {
            count: migrationState?.userCount || 0,
            plan: migrationState?.plan?.displayName
        })}
                </p>
                
                {/* Check if there are other plans available */}
                {plans && plans.filter(p => p.id !== migrationState?.plan?.id).length > 0 ? (<div className="space-y-2">
                    <Label>{t("adminDashboard.plans.selectTargetPlan")}</Label>
                    <Select value={migrationState?.targetPlanId || ''} onValueChange={(value) => setMigrationState(prev => prev ? { ...prev, targetPlanId: value } : null)}>
                      <SelectTrigger data-testid="select-migration-target">
                        <SelectValue placeholder={t("adminDashboard.plans.selectPlan")}/>
                      </SelectTrigger>
                      <SelectContent>
                        {plans
                .filter(p => p.id !== migrationState?.plan?.id)
                .map(p => (<SelectItem key={p.id} value={p.id} data-testid={`option-plan-${p.id}`}>
                              {p.displayName} (${Number(p.monthlyPrice).toFixed(2)}/mo)
                            </SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>) : (<div className="p-3 rounded-md bg-amber-500/10 border border-amber-500/20">
                    <p className="text-sm text-amber-600 dark:text-amber-400">
                      {t("adminDashboard.plans.noOtherPlansAvailable")}
                    </p>
                  </div>)}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={migrateUsers.isPending || deletePlan.isPending}>
              {t("common.cancel")}
            </AlertDialogCancel>
            {plans && plans.filter(p => p.id !== migrationState?.plan?.id).length > 0 && (<Button onClick={() => {
                if (migrationState && migrationState.targetPlanId) {
                    migrateUsers.mutate({
                        planId: migrationState.plan.id,
                        targetPlanId: migrationState.targetPlanId
                    });
                }
            }} disabled={!migrationState?.targetPlanId || migrateUsers.isPending || deletePlan.isPending} data-testid="button-migrate-and-delete">
                {migrateUsers.isPending || deletePlan.isPending ? (<>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin"/>
                    {t("adminDashboard.plans.migratingUsers")}
                  </>) : (t("adminDashboard.plans.migrateAndDelete"))}
              </Button>)}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>);
}
