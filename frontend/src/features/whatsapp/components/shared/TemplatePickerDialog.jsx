import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@wa/components/ui/button";
import { Input } from "@wa/components/ui/input";
import { Badge } from "@wa/components/ui/badge";
import { ScrollArea } from "@wa/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, } from "@wa/components/ui/dialog";
import { Loading } from "@wa/components/ui/loading";
import { Search, FileText, Phone, Video, Reply, ExternalLink, Clipboard, FileDown, MousePointerClick, Megaphone, Wrench, ShieldCheck, Globe, Image, } from "lucide-react";
import { api } from "@wa/lib/api";
import { apiRequestFormData } from "@wa/lib/queryClient";
import { WHATSAPP_LANGUAGES } from "@wa/lib/template-constants";
import { useToast } from "@wa/hooks/use-toast";
import { cn } from "@wa/lib/utils";
export const templateCategoryConfig = {
    MARKETING: {
        label: "Marketing",
        className: "bg-purple-50 text-purple-700 border-purple-200",
        icon: Megaphone,
    },
    UTILITY: {
        label: "Utility",
        className: "bg-blue-50 text-blue-700 border-blue-200",
        icon: Wrench,
    },
    AUTHENTICATION: {
        label: "Authentication",
        className: "bg-amber-50 text-amber-700 border-amber-200",
        icon: ShieldCheck,
    },
};
export const templateButtonTypeIcons = {
    PHONE_NUMBER: Phone,
    URL: ExternalLink,
    QUICK_REPLY: Reply,
    COPY_CODE: Clipboard,
};
const templateLanguageMap = Object.fromEntries(WHATSAPP_LANGUAGES.map((l) => [l.code, l.label]));
export function getTemplateLanguageLabel(code) {
    return templateLanguageMap[code] || templateLanguageMap[code?.replace("-", "_")] || code || "English";
}
export function getTemplateMediaIcon(mediaType) {
    switch (mediaType?.toLowerCase()) {
        case "image": return Image;
        case "video": return Video;
        case "document": return FileDown;
        default: return null;
    }
}
export function getTemplateButtons(template) {
    const buttons = [];
    if (template.buttons && Array.isArray(template.buttons)) {
        for (const btn of template.buttons) {
            buttons.push({
                type: btn.type || "QUICK_REPLY",
                text: btn.text || "",
                url: btn.url,
                phone_number: btn.phone_number,
                example: btn.example,
            });
        }
    }
    if (buttons.length === 0 && template.components && Array.isArray(template.components)) {
        for (const comp of template.components) {
            if (comp.type === "BUTTONS" && Array.isArray(comp.buttons)) {
                for (const btn of comp.buttons) {
                    buttons.push({
                        type: btn.type || "QUICK_REPLY",
                        text: btn.text || "",
                        url: btn.url,
                        phone_number: btn.phone_number,
                        example: btn.example,
                    });
                }
            }
        }
    }
    return buttons;
}
export function TemplatePickerDialog({ channelId, onSelectTemplate, trigger, submitLabel = "Send Template", categoryFilter, missingChannelMessage = "Create a WhatsApp channel before using templates.", }) {
    const [open, setOpen] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [variables, setVariables] = useState([]);
    const [buttonParams, setButtonParams] = useState({});
    const { toast } = useToast();
    const notifyMissingChannel = () => {
        toast({
            title: "No WhatsApp channel",
            description: missingChannelMessage,
            variant: "destructive",
        });
    };
    const [requiresHeaderImage, setRequiresHeaderImage] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [headerType, setHeaderType] = useState(null);
    const [uploadedMediaId, setUploadedMediaId] = useState(null);
    const [hasLimitedTimeOffer, setHasLimitedTimeOffer] = useState(false);
    const [expirationDate, setExpirationDate] = useState("");
    const [templateSearchQuery, setTemplateSearchQuery] = useState("");
    const [templateCategoryFilter, setTemplateCategoryFilter] = useState(categoryFilter || "ALL");
    const [isCarouselTemplate, setIsCarouselTemplate] = useState(false);
    const [carouselCards, setCarouselCards] = useState([]);
    const [cardMediaIds, setCardMediaIds] = useState({});
    const [cardUploadingIdx, setCardUploadingIdx] = useState(null);
    const { data: templates = [], isLoading } = useQuery({
        queryKey: ["/api/whatsapp/templates", channelId],
        queryFn: async () => {
            const response = await api.getTemplates(channelId);
            const data = await response.json();
            return Array.isArray(data.data) ? data.data : [];
        },
        enabled: !!channelId && open,
    });
    const approvedTemplates = Array.isArray(templates)
        ? templates.filter((t) => t?.status?.toLowerCase().includes("approve"))
        : [];
    const getVariableCount = (body) => {
        const matches = body.match(/\{\{\d+\}\}/g);
        return matches ? matches.length : 0;
    };
    const fetchTemplateMeta = async (templateWhatsappId) => {
        const res = await fetch(`/api/whatsapp/templates/${templateWhatsappId}/meta?channelId=${channelId}`);
        const data = await res.json();
        return data;
    };
    const handleTemplateSelect = async (template) => {
        const varCount = getVariableCount(template.body);
        setSelectedTemplate(template);
        setUploadedMediaId(null);
        setIsUploading(false);
        setHasLimitedTimeOffer(false);
        setExpirationDate("");
        setIsCarouselTemplate(false);
        setCarouselCards([]);
        setCardMediaIds({});
        setCardUploadingIdx(null);
        setVariables(Array.from({ length: varCount }, () => ({
            type: undefined,
            value: "",
        })));
        const meta = await fetchTemplateMeta(template.whatsappTemplateId);
        if (meta.hasLimitedTimeOffer) {
            setHasLimitedTimeOffer(true);
            const defaultExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
            const localIso = new Date(defaultExpiry.getTime() - defaultExpiry.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
            setExpirationDate(localIso);
        }
        const isCarousel = Array.isArray(template.carouselCards) && template.carouselCards.length > 0;
        setIsCarouselTemplate(isCarousel);
        if (isCarousel) {
            setCarouselCards(template.carouselCards);
        }
        const header = meta.headerType?.toLowerCase() ?? null;
        setHeaderType(header);
        setRequiresHeaderImage(!isCarousel && ["image", "video", "document"].includes(header));
        const MEDIA_HEADERS = ["IMAGE", "VIDEO", "DOCUMENT"];
        const hasMediaHeader = template.components?.some((c) => c.type === "HEADER" && MEDIA_HEADERS.includes(c.format));
        if (!hasMediaHeader) {
            setUploadedMediaId(null);
        }
    };
    const uploadCardMedia = async (file, cardIdx) => {
        if (!channelId)
            return;
        setCardUploadingIdx(cardIdx);
        try {
            const formData = new FormData();
            formData.append("mediaFile", file);
            formData.append("templateId", selectedTemplate?.id);
            const res = await apiRequestFormData("POST", `/api/whatsapp/channels/${channelId}/upload-image`, formData);
            if (!res.ok)
                throw new Error("Upload failed");
            const data = await res.json();
            setCardMediaIds((prev) => ({ ...prev, [cardIdx]: data.mediaId }));
            return data.mediaId;
        }
        catch (error) {
            toast({
                title: "Upload Failed",
                description: `Failed to upload media for card ${cardIdx + 1}.`,
                variant: "destructive",
            });
        }
        finally {
            setCardUploadingIdx(null);
        }
    };
    const uploadHeaderImage = async (file) => {
        if (!channelId) {
            notifyMissingChannel();
            return;
        }
        setIsUploading(true);
        setUploadedMediaId(null);
        try {
            const formData = new FormData();
            formData.append("mediaFile", file);
            formData.append("templateId", selectedTemplate?.id);
            const res = await apiRequestFormData("POST", `/api/whatsapp/channels/${channelId}/upload-image`, formData);
            if (!res.ok)
                throw new Error("Upload failed");
            const data = await res.json();
            setUploadedMediaId(data.mediaId);
            return data.mediaId;
        }
        catch (error) {
            toast({ title: "Upload Failed", description: "Failed to upload file. Please try again.", variant: "destructive" });
            throw error;
        }
        finally {
            setIsUploading(false);
        }
    };
    const getAcceptByHeaderType = (type) => {
        switch (type) {
            case "image": return "image/*";
            case "video": return "video/*";
            case "document": return ".pdf,.doc,.docx";
            default: return "";
        }
    };
    const resetState = () => {
        setSelectedTemplate(null);
        setVariables([]);
        setButtonParams({});
        setUploadedMediaId(null);
        setRequiresHeaderImage(false);
        setIsUploading(false);
        setHasLimitedTimeOffer(false);
        setExpirationDate("");
        setIsCarouselTemplate(false);
        setCarouselCards([]);
        setCardMediaIds({});
        setCardUploadingIdx(null);
    };
    const handleSend = () => {
        if (!selectedTemplate)
            return;
        if (requiresHeaderImage && !uploadedMediaId)
            return;
        if (hasLimitedTimeOffer && !expirationDate)
            return;
        const allBtns = getTemplateButtons(selectedTemplate);
        const dynamicBtnValues = [];
        allBtns.forEach((btn, idx) => {
            if (btn.type === "URL" && btn.url?.includes("{{")) {
                dynamicBtnValues.push(buttonParams[idx] || "");
            }
            else if (btn.type === "COPY_CODE") {
                dynamicBtnValues.push(buttonParams[idx] || btn.example?.[0] || "");
            }
        });
        let ltoExpirationMs;
        if (hasLimitedTimeOffer && expirationDate) {
            ltoExpirationMs = new Date(expirationDate).getTime();
        }
        const carouselMediaIds = isCarouselTemplate && Object.keys(cardMediaIds).length > 0
            ? cardMediaIds
            : undefined;
        onSelectTemplate(selectedTemplate, variables, uploadedMediaId || undefined, headerType, dynamicBtnValues.length > 0 ? dynamicBtnValues : undefined, ltoExpirationMs, carouselMediaIds);
        setOpen(false);
        resetState();
    };
    const defaultTrigger = (<Button variant="ghost" size="icon" className="h-9 w-9">
      <FileText className="h-4 w-4"/>
    </Button>);
    return (<Dialog open={open} onOpenChange={(v) => {
            if (v && !channelId) {
                notifyMissingChannel();
                return;
            }
            setOpen(v);
            if (!v) {
                setTemplateSearchQuery("");
                setTemplateCategoryFilter(categoryFilter || "ALL");
                resetState();
            }
        }}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] bg-white">
        <DialogHeader>
          <DialogTitle>
            {selectedTemplate ? "Configure Template" : "Select Template"}
          </DialogTitle>
          {!selectedTemplate && (<DialogDescription>
              Choose an approved template to send
            </DialogDescription>)}
        </DialogHeader>

        {!selectedTemplate && (<div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"/>
              <Input placeholder="Search templates..." value={templateSearchQuery} onChange={(e) => setTemplateSearchQuery(e.target.value)} className="pl-9 bg-white border-slate-200 focus-visible:ring-blue-500"/>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {[
                { key: "ALL", label: "All" },
                { key: "MARKETING", label: "Marketing", icon: Megaphone },
                { key: "UTILITY", label: "Utility", icon: Wrench },
                { key: "AUTHENTICATION", label: "Auth", icon: ShieldCheck },
            ].map((cat) => (<Button key={cat.key} variant={templateCategoryFilter === cat.key ? "default" : "outline"} size="sm" className={cn("h-7 text-xs px-2.5", templateCategoryFilter === cat.key
                    ? "bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
                    : "bg-white text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700")} onClick={() => setTemplateCategoryFilter(cat.key)}>
                  {cat.icon && <cat.icon className="w-3 h-3 mr-1"/>}
                  {cat.label}
                </Button>))}
            </div>
          </div>)}

        <ScrollArea className="h-[400px] pr-4">
          {!selectedTemplate ? ((() => {
            const filtered = approvedTemplates.filter((t) => {
                const matchesSearch = !templateSearchQuery ||
                    t.name?.toLowerCase().includes(templateSearchQuery.toLowerCase()) ||
                    t.body?.toLowerCase().includes(templateSearchQuery.toLowerCase());
                const matchesCategory = templateCategoryFilter === "ALL" ||
                    t.category?.toUpperCase() === templateCategoryFilter;
                return matchesSearch && matchesCategory;
            });
            return isLoading ? (<div className="flex items-center justify-center py-8">
                  <Loading />
                </div>) : !channelId ? (<div className="text-center py-8 text-gray-500">
                  <FileText className="mx-auto h-10 w-10 text-gray-300 mb-3"/>
                  <p className="font-medium">No WhatsApp channel</p>
                  <p className="text-sm mt-1">{missingChannelMessage}</p>
                </div>) : filtered.length === 0 ? (<div className="text-center py-8 text-gray-500">
                  <FileText className="mx-auto h-10 w-10 text-gray-300 mb-3"/>
                  <p className="font-medium">No templates found</p>
                  <p className="text-sm mt-1">
                    {templateSearchQuery || templateCategoryFilter !== "ALL"
                    ? "Try adjusting your search or filter"
                    : "No approved templates available"}
                  </p>
                </div>) : (<div className="grid gap-3 sm:grid-cols-2">
                  {filtered.map((template) => {
                    const cat = templateCategoryConfig[template.category?.toUpperCase()] || templateCategoryConfig.MARKETING;
                    const CatIcon = cat.icon;
                    const MediaIcon = getTemplateMediaIcon(template.mediaType);
                    const buttons = getTemplateButtons(template);
                    const langLabel = getTemplateLanguageLabel(template.language);
                    return (<div key={template.id} onClick={() => handleTemplateSelect(template)} className="border border-slate-200 rounded-lg p-3.5 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all bg-white group">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-semibold text-sm text-gray-900 truncate flex-1 mr-2">
                            {template.name}
                          </h4>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap mb-2">
                          <Badge variant="outline" className={`text-[11px] px-1.5 py-0 ${cat.className}`}>
                            <CatIcon className="w-3 h-3 mr-1"/>
                            {cat.label}
                          </Badge>
                          <span className="inline-flex items-center text-[11px] text-gray-500">
                            <Globe className="w-3 h-3 mr-0.5"/>
                            {langLabel}
                          </span>
                          {MediaIcon && (<span className="inline-flex items-center text-[11px] text-gray-500">
                              <MediaIcon className="w-3 h-3 mr-0.5"/>
                              {template.mediaType}
                            </span>)}
                        </div>
                        {template.header && (<p className="text-sm font-medium text-gray-800 truncate mb-0.5">
                            {template.header}
                          </p>)}
                        <p className="text-sm text-gray-600 line-clamp-2">
                          {template.body}
                        </p>
                        {template.footer && (<p className="text-xs text-gray-400 italic mt-1">{template.footer}</p>)}
                        {buttons.length > 0 && (<div className="flex flex-wrap gap-1 mt-2">
                            {buttons.map((button, idx) => {
                                const BtnIcon = templateButtonTypeIcons[button.type] || MousePointerClick;
                                return (<Badge key={idx} variant="outline" className="text-[10px] px-1.5 py-0 bg-gray-50 text-gray-600 border-gray-200">
                                  <BtnIcon className="w-2.5 h-2.5 mr-0.5"/>
                                  {button.text || button.type}
                                </Badge>);
                            })}
                          </div>)}
                      </div>);
                })}
                </div>);
        })()) : (<div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                <h4 className="font-medium">{selectedTemplate.name}</h4>
                {selectedTemplate.header && !requiresHeaderImage && (<p className="text-sm font-medium text-gray-800">{selectedTemplate.header}</p>)}
                <p className="text-sm text-gray-600">{selectedTemplate.body}</p>
                {selectedTemplate.footer && (<p className="text-xs text-gray-400 italic">{selectedTemplate.footer}</p>)}
                {(() => {
                const previewButtons = getTemplateButtons(selectedTemplate);
                if (previewButtons.length === 0)
                    return null;
                return (<div className="flex flex-wrap gap-1 pt-1 border-t border-gray-200 mt-2">
                      {previewButtons.map((btn, idx) => {
                        const BtnIcon = templateButtonTypeIcons[btn.type] || MousePointerClick;
                        return (<Badge key={idx} variant="outline" className="text-[10px] px-1.5 py-0 bg-white text-gray-600 border-gray-200">
                            <BtnIcon className="w-2.5 h-2.5 mr-0.5"/>
                            {btn.text || btn.type}
                          </Badge>);
                    })}
                    </div>);
            })()}
              </div>

              {requiresHeaderImage && (<div className="space-y-2">
                  <label className="text-sm font-medium text-red-600">
                    Header {headerType} (Required) *
                  </label>
                  <input type="file" accept={getAcceptByHeaderType(headerType)} required className="w-full p-2 border rounded-md" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file)
                        return;
                    toast({
                        title: `Uploading ${headerType}...`,
                        description: "Please wait while we upload your file.",
                    });
                    await uploadHeaderImage(file);
                    toast({
                        title: "Upload successful",
                        description: `Header ${headerType} uploaded successfully.`,
                    });
                }}/>
                  {uploadedMediaId && (<p className="text-xs text-green-600">
                      ✓ {headerType} uploaded successfully (ID: {uploadedMediaId})
                    </p>)}
                </div>)}

              {isCarouselTemplate && carouselCards.length > 0 && (<div className="space-y-3">
                  <label className="text-sm font-medium text-gray-700 block">
                    Carousel Cards ({carouselCards.length} cards)
                  </label>
                  <p className="text-xs text-gray-500">
                    Upload images/videos for each card. The media from template creation will be used if you don't upload new ones.
                  </p>
                  {carouselCards.map((card, cardIdx) => {
                    const cardMediaType = (card.mediaType || "image").toLowerCase();
                    return (<div key={cardIdx} className="border rounded-lg p-3 space-y-2 bg-gray-50">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">Card {cardIdx + 1}</span>
                          <Badge variant="outline" className="text-[10px]">{cardMediaType}</Badge>
                        </div>
                        {card.body && (<p className="text-xs text-gray-600">{card.body}</p>)}
                        {Array.isArray(card.buttons) && card.buttons.length > 0 && (<div className="flex flex-wrap gap-1">
                            {card.buttons.map((btn, bi) => (<Badge key={bi} variant="outline" className="text-[10px] px-1.5 py-0 bg-white">
                                {btn.text || btn.type}
                              </Badge>))}
                          </div>)}
                        <div>
                          <input type="file" accept={cardMediaType === "video" ? "video/*" : "image/*"} className="w-full text-xs p-1 border rounded" onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file)
                                return;
                            toast({ title: `Uploading card ${cardIdx + 1} media...` });
                            const result = await uploadCardMedia(file, cardIdx);
                            if (result) {
                                toast({ title: "Upload successful", description: `Card ${cardIdx + 1} media uploaded.` });
                            }
                        }}/>
                          {cardMediaIds[cardIdx] && (<p className="text-xs text-green-600 mt-1">✓ Uploaded (ID: {cardMediaIds[cardIdx]})</p>)}
                          {cardUploadingIdx === cardIdx && (<p className="text-xs text-blue-600 mt-1">Uploading...</p>)}
                          {!cardMediaIds[cardIdx] && cardUploadingIdx !== cardIdx && (<p className="text-xs text-gray-400 mt-1">Optional — template example media will be used if not provided</p>)}
                        </div>
                      </div>);
                })}
                </div>)}

              {hasLimitedTimeOffer && (<div className="space-y-2">
                  <label className="text-sm font-medium text-orange-600 block">
                    Offer Expiration (Required) *
                  </label>
                  <input type="datetime-local" className="w-full p-2 border rounded-md text-sm" value={expirationDate} min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)} onChange={(e) => setExpirationDate(e.target.value)}/>
                  <p className="text-xs text-gray-500">
                    Set when the limited time offer expires. The countdown timer will be shown to the recipient.
                  </p>
                </div>)}

              {variables.map((v, index) => {
                const sampleValue = selectedTemplate?.variables?.[index];
                return (<div key={index} className="space-y-2">
                    <label className="text-sm font-medium block">
                      Value for {"{{" + (index + 1) + "}}"}
                    </label>
                    <select className="w-full border rounded-md px-3 py-2 text-sm" value={v.type ?? ""} onChange={(e) => {
                        const updated = [...variables];
                        updated[index] = {
                            type: e.target.value,
                            value: "",
                        };
                        setVariables(updated);
                    }}>
                      <option value="" disabled>Select value type</option>
                      <option value="fullName">Full Name</option>
                      <option value="phone">Phone</option>
                      <option value="custom">Custom</option>
                    </select>
                    {v.type === "custom" && (<Input placeholder={`Enter value for {{${index + 1}}}`} value={v.value || ""} onChange={(e) => {
                            const updated = [...variables];
                            updated[index] = { ...updated[index], value: e.target.value };
                            setVariables(updated);
                        }}/>)}
                    {sampleValue && (<p className="text-xs text-gray-500">
                        Sample: <span className="font-medium">{sampleValue}</span>
                      </p>)}
                  </div>);
            })}

              {(() => {
                const allButtons = getTemplateButtons(selectedTemplate);
                if (allButtons.length === 0)
                    return null;
                return (<div className="space-y-3">
                    <label className="text-sm font-medium text-gray-700 block">Buttons</label>
                    {allButtons.map((button, i) => {
                        if (button.type === "URL" && button.url?.includes("{{")) {
                            return (<div key={`btn-${i}`} className="space-y-2 pl-3 border-l-2 border-blue-200">
                            <label className="text-sm font-medium block">
                              URL parameter for <strong>{button.text}</strong>
                            </label>
                            <Input placeholder={button.example?.[0] || "e.g. tracking-id"} value={buttonParams[i] || ""} onChange={(e) => setButtonParams({ ...buttonParams, [i]: e.target.value })}/>
                            <p className="text-xs text-gray-500">
                              URL: <span className="font-medium">{button.url}</span>
                            </p>
                          </div>);
                        }
                        if (button.type === "COPY_CODE") {
                            return (<div key={`btn-${i}`} className="space-y-2 pl-3 border-l-2 border-blue-200">
                            <label className="text-sm font-medium block">
                              Coupon Code for <strong>{button.text || "Copy Code"}</strong>
                            </label>
                            <Input placeholder={button.example?.[0] || "e.g. SAVE20"} value={buttonParams[i] || ""} onChange={(e) => setButtonParams({ ...buttonParams, [i]: e.target.value })}/>
                          </div>);
                        }
                        if (button.type === "URL") {
                            return (<div key={`btn-${i}`} className="pl-3 border-l-2 border-gray-200">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <ExternalLink className="w-3.5 h-3.5"/>
                              <span className="font-medium">{button.text}</span>
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5 ml-5">{button.url}</p>
                          </div>);
                        }
                        if (button.type === "PHONE_NUMBER") {
                            return (<div key={`btn-${i}`} className="pl-3 border-l-2 border-gray-200">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Phone className="w-3.5 h-3.5"/>
                              <span className="font-medium">{button.text}</span>
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5 ml-5">{button.phone_number}</p>
                          </div>);
                        }
                        if (button.type === "QUICK_REPLY") {
                            return (<div key={`btn-${i}`} className="pl-3 border-l-2 border-gray-200">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Reply className="w-3.5 h-3.5"/>
                              <span className="font-medium">{button.text}</span>
                            </div>
                          </div>);
                        }
                        return null;
                    })}
                  </div>);
            })()}

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => resetState()}>
                  Back
                </Button>
                <Button onClick={handleSend} disabled={variables.some((v) => !v.type || (v.type === "custom" && !v.value?.trim())) ||
                isUploading ||
                (requiresHeaderImage && !uploadedMediaId) ||
                (hasLimitedTimeOffer && !expirationDate) ||
                cardUploadingIdx !== null}>
                  {isUploading ? "Uploading..." : submitLabel}
                </Button>
              </div>
            </div>)}
        </ScrollArea>
      </DialogContent>
    </Dialog>);
}
