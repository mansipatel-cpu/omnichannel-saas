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

import { ReactNode, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@wa/components/ui/button";
import { Input } from "@wa/components/ui/input";
import { Label } from "@wa/components/ui/label";
import { Textarea } from "@wa/components/ui/textarea";
import { Checkbox } from "@wa/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@wa/components/ui/card";
import { useAuth } from "@wa/contexts/auth-context";
import { Info, FileText, Clock, Eye, Check } from "lucide-react";
import { TemplatePickerDialog, getTemplateButtons } from "@wa/components/shared/TemplatePickerDialog";

interface CreateCampaignFormProps {
  onSubmit: (formData: any) => void;
  templates: any[];
  selectedTemplate: any;
  setSelectedTemplate: (template: any) => void;
  variableMapping: Record<string, string>;
  setVariableMapping: (mapping: Record<string, string>) => void;
  extractTemplateVariables: (template: any) => string[];
  scheduledTime: string;
  setScheduledTime: (time: string) => void;
  autoRetry: boolean;
  setAutoRetry: (retry: boolean) => void;
  isCreating: boolean;
  onCancel?: () => void;
  children: ReactNode;
  requiresHeaderImage: boolean;
  setRequiresHeaderImage: (v: boolean) => void;
  uploadedMediaId: string | null;
  setUploadedMediaId: (id: string | null) => void;
  channelId?: string;
  messagingLimit?: number | null;
  messagingTier?: string;
}

// Schema for the fields this form owns. Scheduling and auto-retry are
// parent-controlled props so they stay out of the schema; the parent runs its
// own validation for those.
const campaignFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Campaign name is required")
    .max(200, "Campaign name is too long"),
  description: z
    .string()
    .trim()
    .max(2000, "Description is too long")
    .optional()
    .or(z.literal("")),
});

type CampaignFormValues = z.infer<typeof campaignFormSchema>;

export function CreateCampaignForm({
  onSubmit,
  selectedTemplate,
  setSelectedTemplate,
  variableMapping,
  scheduledTime,
  setScheduledTime,
  autoRetry,
  setAutoRetry,
  isCreating,
  onCancel,
  children,
  setRequiresHeaderImage,
  setUploadedMediaId,
  channelId,
  messagingLimit,
  messagingTier,
}: CreateCampaignFormProps) {
  const [templateConfig, setTemplateConfig] = useState<{
    variables: { type?: string; value?: string }[];
    mediaId?: string;
    headerType?: string | null;
    buttonParameters?: string[];
    expirationTimeMs?: number;
    carouselCardMediaIds?: Record<number, string>;
  } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: { name: "", description: "" },
    mode: "onBlur",
  });

  const buildVariableMapping = () => {
    if (!templateConfig) return variableMapping;

    const mapping: Record<string, any> = {};

    if (templateConfig.variables) {
      templateConfig.variables.forEach((v, i) => {
        mapping[String(i + 1)] = v;
      });
    }

    if (templateConfig.buttonParameters && templateConfig.buttonParameters.length > 0) {
      const buttonsMap: Record<number, { type: string; value: string }> = {};
      const allButtons = selectedTemplate ? getTemplateButtons(selectedTemplate) : [];
      let paramIdx = 0;
      allButtons.forEach((btn, idx) => {
        if (btn.type === "COPY_CODE" || (btn.type === "URL" && btn.url?.includes("{{"))) {
          buttonsMap[idx] = { type: "custom", value: templateConfig.buttonParameters![paramIdx] || "" };
          paramIdx++;
        }
      });
      mapping.buttons = buttonsMap;
    }

    if (templateConfig.mediaId) {
      mapping.uploadedMediaId = templateConfig.mediaId;
    }
    if (templateConfig.headerType) {
      mapping.headerType = templateConfig.headerType;
    }
    if (templateConfig.expirationTimeMs) {
      mapping.expirationTimeMs = templateConfig.expirationTimeMs;
    }
    if (templateConfig.carouselCardMediaIds && Object.keys(templateConfig.carouselCardMediaIds).length > 0) {
      mapping.carouselCardMediaIds = Object.fromEntries(
        Object.entries(templateConfig.carouselCardMediaIds).map(([k, v]) => [String(k), v])
      );
    }

    return mapping;
  };

  const onValid = (values: CampaignFormValues) => {
    onSubmit({
      name: values.name,
      description: values.description ?? "",
      variableMapping: buildVariableMapping(),
    });
  };

  const handleSelectTemplate = (
    template: any,
    variables: { type?: string; value?: string }[],
    mediaId?: string,
    headerType?: string | null,
    buttonParameters?: string[],
    expirationTimeMs?: number,
    carouselCardMediaIds?: Record<number, string>,
  ) => {
    setSelectedTemplate(template);
    setTemplateConfig({
      variables,
      mediaId,
      headerType,
      buttonParameters,
      expirationTimeMs,
      carouselCardMediaIds,
    });
    if (mediaId) {
      setUploadedMediaId(mediaId);
    }
    setRequiresHeaderImage(
      !!headerType && ["image", "video", "document"].includes(headerType)
    );
  };

  const { user } = useAuth();

  const limitLabel =
    messagingLimit == null || messagingLimit === Infinity
      ? "Unlimited"
      : messagingLimit.toLocaleString();

  return (
    <form onSubmit={handleSubmit(onValid)} className="space-y-4" noValidate>
      <Card className="rounded-xl border-slate-200 bg-white shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <FileText className="h-4 w-4 text-slate-500" />
            Campaign Info
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-sm font-medium text-slate-800">
              Campaign Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              placeholder="e.g. Summer Sale Announcement"
              aria-invalid={!!errors.name}
              className={`h-11 bg-white border-slate-200 ${
                errors.name ? "border-red-400 focus-visible:ring-red-400" : ""
              }`}
              {...register("name")}
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-500" role="alert">
                {errors.name.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-sm font-medium text-slate-800">
              Description
            </Label>
            <Textarea
              id="description"
              placeholder="Campaign objectives and notes..."
              rows={3}
              aria-invalid={!!errors.description}
              className="bg-white border-slate-200 min-h-[88px]"
              {...register("description")}
            />
            {errors.description && (
              <p className="mt-1 text-xs text-red-500" role="alert">
                {errors.description.message}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-slate-200 bg-white shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Eye className="h-4 w-4 text-slate-500" />
            Template
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <TemplatePickerDialog
              channelId={channelId}
              onSelectTemplate={handleSelectTemplate}
              submitLabel="Use Template"
              categoryFilter="MARKETING"
              trigger={
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 gap-2 bg-white border-slate-200 text-slate-800"
                >
                  <FileText className="h-4 w-4" />
                  {selectedTemplate ? "Change Template" : "Select Template"}
                </Button>
              }
            />
            {selectedTemplate && (
              <div className="flex items-center gap-2 text-sm text-emerald-700">
                <Check className="h-4 w-4" />
                <span className="font-medium">{selectedTemplate.name}</span>
              </div>
            )}
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5 text-sm text-blue-800">
            <Info className="h-4 w-4 mt-0.5 shrink-0 text-blue-500" />
            <span>
              Your channel&apos;s WhatsApp messaging limit is{" "}
              <strong>{limitLabel}</strong>
              {messagingLimit != null && messagingLimit !== Infinity
                ? " messages per 24 hours"
                : ""}
              {messagingTier ? ` (${messagingTier})` : ""}.
            </span>
          </div>

          {selectedTemplate && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-1.5">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Preview
              </p>
              {selectedTemplate.headerType === "text" && selectedTemplate.headerText && (
                <div className="font-semibold text-sm">{selectedTemplate.headerText}</div>
              )}
              <div className="whitespace-pre-wrap text-sm text-slate-800">
                {selectedTemplate.body}
              </div>
              {selectedTemplate.footerText && (
                <div className="text-xs text-slate-500">{selectedTemplate.footerText}</div>
              )}
              {templateConfig && (
                <div className="mt-2 pt-2 border-t border-slate-200 space-y-1">
                  {templateConfig.variables.length > 0 && (
                    <p className="text-xs text-slate-500">
                      {templateConfig.variables.length} variable(s) configured
                    </p>
                  )}
                  {templateConfig.mediaId && (
                    <p className="text-xs text-emerald-600">Header media uploaded</p>
                  )}
                  {templateConfig.buttonParameters &&
                    templateConfig.buttonParameters.length > 0 && (
                      <p className="text-xs text-slate-500">
                        {templateConfig.buttonParameters.length} button parameter(s) set
                      </p>
                    )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-xl border-slate-200 bg-white shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Clock className="h-4 w-4 text-slate-500" />
            Scheduling
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="scheduledTime" className="text-sm font-medium text-slate-800">
              Schedule Campaign (Optional)
            </Label>
            <Input
              id="scheduledTime"
              type="datetime-local"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              className="h-11 bg-white border-slate-200"
            />
          </div>
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="autoRetry"
                checked={autoRetry}
                onCheckedChange={(checked) => setAutoRetry(!!checked)}
              />
              <Label htmlFor="autoRetry" className="font-normal text-sm text-slate-800">
                Enable auto-retry for failed messages
              </Label>
            </div>
            <p className="text-xs text-slate-500 pl-6">
              Automatically retries failed dispatches via alternative SMS or Voice fallback after
              15 mins.
            </p>
          </div>
        </CardContent>
      </Card>

      {children}

      <div className="flex flex-col items-end gap-1.5 pt-1">
        {!selectedTemplate && (
          <p className="text-xs text-slate-500">Select a template to enable Start Campaign</p>
        )}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="h-10 min-w-[100px] bg-white border-slate-200"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={user?.username === "demouser" ? true : isCreating || !selectedTemplate}
            className="h-10 min-w-[140px] bg-[#007BFF] hover:bg-[#0069d9] text-white"
          >
            {isCreating ? "Starting..." : "Start Campaign"}
          </Button>
        </div>
      </div>
    </form>
  );
}
