import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/shared/lib/queryClient";
import { useToast } from "@/shared/hooks/use-toast";
import { usePluginStatus } from "@/shared/hooks/use-plugin-status";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { Switch } from "@/shared/components/ui/switch";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/shared/components/ui/select";
import { InfoTooltip } from "@/shared/components/ui/info-tooltip";
import { Settings2, Bot, Clock, FilePlus2, Upload, Download, Info, } from "lucide-react";
const fieldClass = "h-11 bg-[#EEF4FF] border-transparent rounded-lg text-slate-800 placeholder:text-slate-400 focus-visible:ring-[#007BFF]";
const textareaClass = "bg-[#EEF4FF] border-transparent rounded-lg text-slate-800 placeholder:text-slate-400 focus-visible:ring-[#007BFF] min-h-[96px]";
const selectTriggerClass = "h-11 bg-[#EEF4FF] border-transparent rounded-lg text-slate-800 focus:ring-[#007BFF]";
const DAYS = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
];
const DAY_LABELS = {
    monday: "Monday",
    tuesday: "Tuesday",
    wednesday: "Wednesday",
    thursday: "Thursday",
    friday: "Friday",
    saturday: "Saturday",
    sunday: "Sunday",
};
const CAMPAIGN_TYPES = [
    "Lead Qualification",
    "Feedback Collection",
    "Promotional",
    "Payment Reminder",
    "Event Promotion",
    "Survey",
];
function getEngineLabel(provider) {
    switch (provider) {
        case "plivo":
        case "plivo_openai":
            return "Plivo+OpenAI";
        case "twilio_openai":
            return "Twilio+OpenAI";
        case "elevenlabs-sip":
            return "ElevenLabs SIP";
        case "openai-sip":
            return "OpenAI SIP";
        case "custom-voice-engine":
            return "Custom Voice Engine";
        default:
            return "Twilio+ElevenLabs";
    }
}
function SectionCard({ icon, title, action, children, }) {
    return (<div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-blue-50 text-[#007BFF] flex items-center justify-center">
            {icon}
          </div>
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        </div>
        {action}
      </div>
      <div className="px-5 sm:px-6 py-5 space-y-5">{children}</div>
    </div>);
}
function FieldLabel({ htmlFor, children, required, tip, }) {
    return (<div className="flex items-center gap-1.5 mb-1.5">
      <Label htmlFor={htmlFor} className="text-sm font-medium text-slate-700">
        {children}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {tip ? (<InfoTooltip content={tip}/>) : null}
    </div>);
}
export function CreateCallingCampaignForm() {
    const { toast } = useToast();
    const [, setLocation] = useLocation();
    const { isSipPluginEnabled } = usePluginStatus();
    const fileInputRef = useRef(null);
    const [formData, setFormData] = useState({
        name: "",
        type: "Lead Qualification",
        goal: "",
        script: "",
        flowId: "",
        agentId: "",
        phoneNumberId: "",
        sipPhoneNumberId: "",
        plivoPhoneNumberId: "",
        scheduleEnabled: true,
        scheduleTimeStart: "09:00",
        scheduleTimeEnd: "17:00",
        scheduleDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
        scheduleTimezone: "America/New_York",
    });
    const [csvFile, setCsvFile] = useState(null);
    const [showErrors, setShowErrors] = useState(false);
    const { data: userData } = useQuery({
        queryKey: ["/api/auth/me"],
    });
    useEffect(() => {
        if (userData?.timezone) {
            setFormData((prev) => ({ ...prev, scheduleTimezone: userData.timezone }));
        }
    }, [userData?.timezone]);
    const { data: agents = [] } = useQuery({
        queryKey: ["/api/agents"],
    });
    const { data: phoneNumbers = [] } = useQuery({
        queryKey: ["/api/phone-numbers"],
    });
    const { data: sipPhoneNumbersResponse } = useQuery({
        queryKey: ["/api/sip/phone-numbers"],
        enabled: isSipPluginEnabled,
    });
    const sipPhoneNumbers = sipPhoneNumbersResponse?.data || [];
    const { data: plivoPhoneNumbers = [] } = useQuery({
        queryKey: ["/api/plivo/phone-numbers"],
    });
    const { data: userSipPhoneNumbersResponse } = useQuery({
        queryKey: ["/api/user/sip-phone-numbers"],
    });
    const userSipPhoneNumbers = userSipPhoneNumbersResponse?.data || [];
    const { data: flows = [] } = useQuery({
        queryKey: ["/api/flow-automation/flows"],
    });
    const selectedAgent = agents.find((a) => a.id === formData.agentId);
    const isElevenLabsSipAgent = selectedAgent?.telephonyProvider === "elevenlabs-sip";
    const isPlivoAgent = selectedAgent?.telephonyProvider === "plivo" ||
        selectedAgent?.telephonyProvider === "plivo_openai";
    const isCustomVoiceAgent = selectedAgent?.telephonyProvider === "custom-voice-engine";
    const availableAgents = useMemo(() => agents
        .filter((agent) => agent.telephonyProvider === "custom-voice-engine" || agent.type !== "incoming")
        .filter((agent) => {
        if (agent.telephonyProvider === "openai-sip")
            return false;
        if (agent.telephonyProvider === "elevenlabs-sip" && !isSipPluginEnabled)
            return false;
        return true;
    }), [agents, isSipPluginEnabled]);
    const update = (key, value) => {
        setFormData((prev) => ({ ...prev, [key]: value }));
    };
    const createMutation = useMutation({
        mutationFn: async () => {
            setShowErrors(true);
            if (!formData.name.trim())
                throw new Error("Campaign name is required");
            if (!formData.agentId)
                throw new Error("Please select an agent");
            if (isElevenLabsSipAgent) {
                if (!isSipPluginEnabled)
                    throw new Error("SIP Plugin is disabled");
                if (!formData.sipPhoneNumberId)
                    throw new Error("Please select a phone number");
            }
            else if (isPlivoAgent) {
                if (!formData.plivoPhoneNumberId)
                    throw new Error("Please select a phone number");
            }
            else if (!isCustomVoiceAgent) {
                if (!formData.phoneNumberId)
                    throw new Error("Please select a phone number");
            }
            else if (!formData.sipPhoneNumberId) {
                throw new Error("Please select a phone number");
            }
            if (formData.scheduleEnabled && formData.scheduleDays.length === 0) {
                throw new Error("Select at least one day for scheduling");
            }
            const payload = {
                ...formData,
                name: formData.name.trim(),
                script: formData.flowId ? "" : formData.script,
            };
            const res = await apiRequest("POST", "/api/campaigns", payload);
            const campaign = await res.json();
            if (csvFile && campaign?.id) {
                const uploadData = new FormData();
                uploadData.append("file", csvFile);
                const authHeader = (await import("@/shared/lib/auth-storage")).AuthStorage.getAuthHeader();
                const uploadRes = await fetch(`/api/campaigns/${campaign.id}/contacts/upload`, {
                    method: "POST",
                    credentials: "include",
                    headers: authHeader ? { Authorization: authHeader } : {},
                    body: uploadData,
                });
                if (!uploadRes.ok) {
                    const err = await uploadRes.json().catch(() => ({}));
                    throw new Error(err.error || "Campaign created, but CSV upload failed");
                }
            }
            return campaign;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
            toast({
                title: "Campaign created",
                description: "Your outbound calling campaign has been created successfully",
            });
            setLocation("/campaigns");
        },
        onError: (error) => {
            toast({
                title: "Failed to create campaign",
                description: error.message || "Please try again",
                variant: "destructive",
            });
        },
    });
    const phoneSelector = (() => {
        if (!formData.agentId) {
            return (<Select disabled>
          <SelectTrigger className={selectTriggerClass}>
            <SelectValue placeholder="Please select an agent first"/>
          </SelectTrigger>
        </Select>);
        }
        if (isElevenLabsSipAgent && !isSipPluginEnabled) {
            return (<div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          SIP Plugin is disabled. Choose a different agent or contact your administrator.
        </div>);
        }
        if (isElevenLabsSipAgent) {
            return (<Select value={formData.sipPhoneNumberId} onValueChange={(value) => update("sipPhoneNumberId", value)}>
          <SelectTrigger className={selectTriggerClass} data-testid="select-phone">
            <SelectValue placeholder={sipPhoneNumbers.filter((p) => p.engine === "elevenlabs-sip").length === 0
                    ? "No ElevenLabs SIP numbers available"
                    : "Select phone number"}/>
          </SelectTrigger>
          <SelectContent>
            {sipPhoneNumbers
                    .filter((phone) => phone.engine === "elevenlabs-sip")
                    .map((phone) => (<SelectItem key={phone.id} value={phone.id}>
                  {phone.label || phone.phoneNumber}
                </SelectItem>))}
          </SelectContent>
        </Select>);
        }
        if (isPlivoAgent) {
            return (<Select value={formData.plivoPhoneNumberId} onValueChange={(value) => update("plivoPhoneNumberId", value)}>
          <SelectTrigger className={selectTriggerClass} data-testid="select-phone">
            <SelectValue placeholder={plivoPhoneNumbers.length === 0
                    ? "No Plivo numbers available"
                    : "Select phone number"}/>
          </SelectTrigger>
          <SelectContent>
            {plivoPhoneNumbers.map((phone) => (<SelectItem key={phone.id} value={phone.id}>
                {phone.friendlyName || phone.phoneNumber}
              </SelectItem>))}
          </SelectContent>
        </Select>);
        }
        if (isCustomVoiceAgent) {
            return (<Select value={formData.sipPhoneNumberId} onValueChange={(value) => setFormData((prev) => ({
                    ...prev,
                    sipPhoneNumberId: value,
                    phoneNumberId: "",
                    plivoPhoneNumberId: "",
                }))}>
          <SelectTrigger className={selectTriggerClass} data-testid="select-phone">
            <SelectValue placeholder={userSipPhoneNumbers.length === 0
                    ? "No Custom SIP numbers available"
                    : "Select phone number"}/>
          </SelectTrigger>
          <SelectContent>
            {userSipPhoneNumbers.map((phone) => (<SelectItem key={phone.id} value={phone.id}>
                {phone.phone_number}
                {phone.label ? ` (${phone.label})` : ""}
                {phone.gateway_name ? ` via ${phone.gateway_name}` : ""}
              </SelectItem>))}
          </SelectContent>
        </Select>);
        }
        return (<Select value={formData.phoneNumberId} onValueChange={(value) => update("phoneNumberId", value)}>
        <SelectTrigger className={selectTriggerClass} data-testid="select-phone">
          <SelectValue placeholder={phoneNumbers.length === 0 ? "No phone numbers available" : "Select phone number"}/>
        </SelectTrigger>
        <SelectContent>
          {phoneNumbers.map((phone) => (<SelectItem key={phone.id} value={phone.id}>
              {phone.friendlyName
                    ? `${phone.phoneNumber} (${phone.friendlyName})`
                    : phone.phoneNumber}
            </SelectItem>))}
        </SelectContent>
      </Select>);
    })();
    return (<div className="space-y-5 pb-8">
      <SectionCard icon={<Settings2 className="h-4 w-4"/>} title="Campaign Details">
        <div className="space-y-1.5">
          <FieldLabel htmlFor="campaign-name" required>
            Campaign Name
          </FieldLabel>
          <Input id="campaign-name" value={formData.name} onChange={(e) => update("name", e.target.value)} placeholder="e.g. Q1 Inbound Lead Outreach" className={fieldClass} data-testid="input-campaign-name"/>
          {showErrors && !formData.name.trim() && (<p className="text-xs text-red-500">Campaign name is required</p>)}
        </div>

        <div className="space-y-1.5">
          <FieldLabel tip="Choose the primary purpose of this outbound calling campaign.">
            Campaign Type
          </FieldLabel>
          <Select value={formData.type} onValueChange={(value) => update("type", value)}>
            <SelectTrigger className={selectTriggerClass} data-testid="select-campaign-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CAMPAIGN_TYPES.map((type) => (<SelectItem key={type} value={type}>
                  {type}
                </SelectItem>))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <FieldLabel htmlFor="campaign-goal" tip="Describe what success looks like for this campaign.">
            Campaign Goal (Optional)
          </FieldLabel>
          <Textarea id="campaign-goal" value={formData.goal} onChange={(e) => update("goal", e.target.value)} placeholder="Enter the campaign objective (e.g. qualify prospective enterprise clients for the Q2 product rollout)..." className={textareaClass} rows={3} data-testid="input-campaign-goal"/>
        </div>
      </SectionCard>

      <SectionCard icon={<Bot className="h-4 w-4"/>} title="AI Configuration">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <FieldLabel required>Select Agent</FieldLabel>
            <Select value={formData.agentId} onValueChange={(value) => setFormData((prev) => ({
            ...prev,
            agentId: value,
            phoneNumberId: "",
            sipPhoneNumberId: "",
            plivoPhoneNumberId: "",
        }))}>
              <SelectTrigger className={selectTriggerClass} data-testid="select-agent">
                <SelectValue placeholder={availableAgents.length === 0
            ? "No agents available"
            : "Select an agent"}/>
              </SelectTrigger>
              <SelectContent>
                {availableAgents.map((agent) => (<SelectItem key={agent.id} value={agent.id}>
                    {agent.name}
                    {agent.personality ? ` - ${agent.personality}` : ""} [
                    {getEngineLabel(agent.telephonyProvider)}]
                  </SelectItem>))}
              </SelectContent>
            </Select>
            {showErrors && !formData.agentId && (<p className="text-xs text-red-500">Please select an agent</p>)}
            {availableAgents.length === 0 && (<p className="text-xs text-slate-500">Create an agent first from the Agents page.</p>)}
          </div>

          <div className="space-y-1.5">
            <FieldLabel required>Phone Number</FieldLabel>
            {phoneSelector}
            {showErrors &&
            formData.agentId &&
            ((isElevenLabsSipAgent && !formData.sipPhoneNumberId) ||
                (isPlivoAgent && !formData.plivoPhoneNumberId) ||
                (isCustomVoiceAgent && !formData.sipPhoneNumberId) ||
                (!isElevenLabsSipAgent &&
                    !isPlivoAgent &&
                    !isCustomVoiceAgent &&
                    !formData.phoneNumberId)) && (<p className="text-xs text-red-500">Please select a phone number</p>)}
          </div>
        </div>

        {selectedAgent?.type !== "flow" && (<>
            <div className="space-y-1.5">
              <FieldLabel tip="Optionally attach a visual conversation flow instead of a freeform script.">
                Visual Flow (Advanced, Optional)
              </FieldLabel>
              <Select value={formData.flowId || "none"} onValueChange={(value) => setFormData((prev) => ({
                ...prev,
                flowId: value === "none" ? "" : value,
                script: value === "none" ? prev.script : "",
            }))}>
                <SelectTrigger className={selectTriggerClass} data-testid="select-flow">
                  <SelectValue placeholder={flows.length === 0 ? "No flows available" : "Select a visual flow"}/>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None — use agent / custom script</SelectItem>
                  {flows.map((flow) => (<SelectItem key={flow.id} value={flow.id}>
                      {flow.name}
                      {flow.description ? ` - ${flow.description}` : ""}
                    </SelectItem>))}
                </SelectContent>
              </Select>
            </div>

            {!formData.flowId && (<div className="space-y-1.5">
                <FieldLabel htmlFor="campaign-script" tip="Use {name}, {company}, and other CSV columns as variables.">
                  Custom Script (Optional)
                </FieldLabel>
                <Textarea id="campaign-script" value={formData.script} onChange={(e) => update("script", e.target.value)} placeholder='Hello {name}, this is Maya calling from {company}. I noticed your team requested information...' className={textareaClass} rows={4} data-testid="input-campaign-script"/>
              </div>)}
          </>)}
      </SectionCard>

      <SectionCard icon={<Clock className="h-4 w-4"/>} title="Call Scheduling (Optional)" action={<div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">Enable Scheduling</span>
            <Switch checked={formData.scheduleEnabled} onCheckedChange={(checked) => update("scheduleEnabled", checked)} data-testid="switch-schedule-enabled"/>
          </div>}>
        <p className="text-sm text-slate-500 -mt-1">
          Control when calls are made to ensure you reach contacts at appropriate times.
        </p>

        {formData.scheduleEnabled && (<div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <FieldLabel htmlFor="schedule-start">Start Time</FieldLabel>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"/>
                  <Input id="schedule-start" type="time" value={formData.scheduleTimeStart} onChange={(e) => update("scheduleTimeStart", e.target.value)} className={`${fieldClass} pl-9`} data-testid="input-schedule-time-start"/>
                </div>
              </div>
              <div className="space-y-1.5">
                <FieldLabel htmlFor="schedule-end">End Time</FieldLabel>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"/>
                  <Input id="schedule-end" type="time" value={formData.scheduleTimeEnd} onChange={(e) => update("scheduleTimeEnd", e.target.value)} className={`${fieldClass} pl-9`} data-testid="input-schedule-time-end"/>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <FieldLabel tip="Calls will only be placed on selected days.">Days of Week</FieldLabel>
              <div className="grid grid-cols-2 gap-2.5">
                {DAYS.map((day) => (<label key={day} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={formData.scheduleDays.includes(day)} onCheckedChange={(checked) => {
                    if (checked) {
                        update("scheduleDays", [...formData.scheduleDays, day]);
                    }
                    else {
                        update("scheduleDays", formData.scheduleDays.filter((d) => d !== day));
                    }
                }} data-testid={`checkbox-day-${day}`}/>
                    <span className="text-sm text-slate-700">{DAY_LABELS[day]}</span>
                  </label>))}
              </div>
              {showErrors && formData.scheduleDays.length === 0 && (<p className="text-xs text-red-500">Select at least one day</p>)}
            </div>

            <div className="space-y-1.5">
              <FieldLabel tip="Timezone used for start/end times and day rules.">
                Timezone
              </FieldLabel>
              <Select value={formData.scheduleTimezone} onValueChange={(value) => update("scheduleTimezone", value)}>
                <SelectTrigger className={selectTriggerClass} data-testid="select-schedule-timezone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTC">UTC (Coordinated Universal Time)</SelectItem>
                  <SelectItem value="America/New_York">America/New_York (EST, UTC-5)</SelectItem>
                  <SelectItem value="America/Chicago">America/Chicago (CST, UTC-6)</SelectItem>
                  <SelectItem value="America/Denver">America/Denver (MST, UTC-7)</SelectItem>
                  <SelectItem value="America/Los_Angeles">America/Los_Angeles (PST, UTC-8)</SelectItem>
                  <SelectItem value="Europe/London">Europe/London</SelectItem>
                  <SelectItem value="Europe/Paris">Europe/Paris</SelectItem>
                  <SelectItem value="Asia/Kolkata">Asia/Kolkata (IST, UTC+5:30)</SelectItem>
                  <SelectItem value="Asia/Dubai">Asia/Dubai</SelectItem>
                  <SelectItem value="Asia/Singapore">Asia/Singapore</SelectItem>
                  <SelectItem value="Asia/Tokyo">Asia/Tokyo</SelectItem>
                  <SelectItem value="Australia/Sydney">Australia/Sydney</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>)}
      </SectionCard>

      <SectionCard icon={<FilePlus2 className="h-4 w-4"/>} title="Add Contacts">
        <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={(e) => setCsvFile(e.target.files?.[0] || null)} data-testid="input-csv-file"/>

        <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full rounded-xl border-2 border-dashed border-blue-200 bg-[#F5F9FF] px-4 py-10 text-center hover:bg-blue-50/70 transition-colors">
          <Upload className="h-10 w-10 mx-auto mb-3 text-[#007BFF]"/>
          {csvFile ? (<p className="text-sm font-semibold text-slate-800">{csvFile.name}</p>) : (<>
              <p className="text-sm font-semibold text-slate-800">Click to upload CSV file</p>
              <p className="text-xs text-slate-500 mt-1">
                Required: phone_number. Optional: name, email, and custom fields
              </p>
            </>)}
        </button>

        <div className="rounded-xl border border-slate-200 bg-slate-50/70 overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200">
            <p className="text-sm font-semibold text-slate-800">CSV Format Example</p>
            <a href="/campaign_template.csv" download="campaign_template.csv" className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-[#007BFF] text-[#007BFF] text-xs font-medium bg-white hover:bg-blue-50">
              <Download className="h-3.5 w-3.5"/>
              Download Template
            </a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#EEF4FF] text-left text-slate-600">
                  <th className="px-4 py-2.5 font-medium">phone_number</th>
                  <th className="px-4 py-2.5 font-medium">name</th>
                  <th className="px-4 py-2.5 font-medium">email</th>
                  <th className="px-4 py-2.5 font-medium">company</th>
                </tr>
              </thead>
              <tbody className="bg-white text-slate-700">
                <tr className="border-t border-slate-100">
                  <td className="px-4 py-2.5">+15551234567</td>
                  <td className="px-4 py-2.5">John Doe</td>
                  <td className="px-4 py-2.5">john@example.com</td>
                  <td className="px-4 py-2.5">Acme Inc</td>
                </tr>
                <tr className="border-t border-slate-100">
                  <td className="px-4 py-2.5">+15559876543</td>
                  <td className="px-4 py-2.5">Jane Smith</td>
                  <td className="px-4 py-2.5">jane@example.com</td>
                  <td className="px-4 py-2.5">TechCorp</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="flex items-start gap-2 px-4 py-3 text-xs text-slate-500 border-t border-slate-200">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-slate-400"/>
            <p>
              Ensure your file is UTF-8 encoded. Any extra columns will be preserved as custom
              variables in agent scripts.
            </p>
          </div>
        </div>

        <p className="text-xs italic text-slate-400">
          You can skip this step and add contacts later from the campaign details page
        </p>
      </SectionCard>

      <div className="flex items-center justify-end gap-3 pt-1">
        <Button type="button" variant="outline" onClick={() => setLocation("/campaigns")} className="h-10 min-w-[110px] bg-white border-slate-200" data-testid="button-cancel-campaign">
          Cancel
        </Button>
        <Button type="button" onClick={() => createMutation.mutate()} disabled={createMutation.isPending} className="h-10 min-w-[150px] bg-[#007BFF] hover:bg-[#0069d9] text-white border-transparent" data-testid="button-submit-campaign">
          {createMutation.isPending ? "Creating..." : "Create Campaign"}
        </Button>
      </div>
    </div>);
}
