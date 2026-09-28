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
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/shared/lib/queryClient";
import { AuthStorage } from "@/shared/lib/auth-storage";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useToast } from "@/shared/hooks/use-toast";
import { Search, Sparkles, CheckCircle2, ChevronLeft, ChevronRight, BookOpen, } from "lucide-react";
import { cn } from "@/shared/lib/utils";
const CATEGORIES = [
    { value: "all", label: "All Templates" },
    { value: "agent_preset", label: "Agent Presets" },
    { value: "sales", label: "Sales" },
    { value: "support", label: "Support" },
    { value: "appointment", label: "Appointment" },
    { value: "survey", label: "Survey" },
    { value: "general", label: "General" },
];
const ITEMS_PER_PAGE = 6;
export default function PromptTemplatesLibrary({ onSelectTemplate, }) {
    const { toast } = useToast();
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("agent_preset");
    const [variableDialogOpen, setVariableDialogOpen] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [variableValues, setVariableValues] = useState({});
    const [currentPage, setCurrentPage] = useState(1);
    const { data: templates = [], isLoading } = useQuery({
        queryKey: ["/api/prompt-templates"],
        queryFn: async () => {
            const headers = {};
            const authHeader = AuthStorage.getAuthHeader();
            if (authHeader) {
                headers["Authorization"] = authHeader;
            }
            const res = await fetch("/api/prompt-templates", { headers });
            if (!res.ok)
                throw new Error("Failed to fetch templates");
            return res.json();
        },
    });
    const useMutation_template = useMutation({
        mutationFn: async ({ id, variableValues, }) => {
            const res = await apiRequest("POST", `/api/prompt-templates/${id}/use`, { variableValues });
            return res.json();
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["/api/prompt-templates"] });
            if (onSelectTemplate) {
                onSelectTemplate({
                    systemPrompt: data.systemPrompt,
                    firstMessage: data.firstMessage || undefined,
                    suggestedVoiceTone: data.suggestedVoiceTone || undefined,
                    suggestedPersonality: data.suggestedPersonality || undefined,
                });
            }
            setVariableDialogOpen(false);
            setSelectedTemplate(null);
            setVariableValues({});
            toast({ title: "Template applied successfully" });
        },
        onError: (error) => {
            toast({
                title: "Failed to apply template",
                description: error.message,
                variant: "destructive",
            });
        },
    });
    const filteredTemplates = templates.filter((t) => {
        const matchesCategory = selectedCategory === "all" || t.category === selectedCategory;
        const matchesSearch = !searchQuery ||
            t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.description?.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });
    const totalPages = Math.ceil(filteredTemplates.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedTemplates = filteredTemplates.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    const handleSearchChange = (value) => {
        setSearchQuery(value);
        setCurrentPage(1);
    };
    const handleCategoryChange = (value) => {
        setSelectedCategory(value);
        setCurrentPage(1);
    };
    const handleSelectTemplate = (template) => {
        if (template.variables && template.variables.length > 0) {
            setSelectedTemplate(template);
            setVariableValues({});
            setVariableDialogOpen(true);
        }
        else {
            useMutation_template.mutate({ id: template.id, variableValues: {} });
        }
    };
    return (<div className="space-y-5">
      <div className="flex flex-col xl:flex-row xl:items-center gap-3">
        <div className="relative w-full xl:max-w-xs shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"/>
          <Input placeholder="Search templates by name..." value={searchQuery} onChange={(e) => handleSearchChange(e.target.value)} className="pl-10 h-10 rounded-lg border-slate-200 bg-white" data-testid="input-template-search"/>
        </div>

        <div className="flex flex-wrap items-center gap-2 flex-1">
          {CATEGORIES.filter((cat) => cat.value !== "general").map((cat) => {
            const active = selectedCategory === cat.value;
            return (<button key={cat.value} type="button" onClick={() => handleCategoryChange(cat.value)} data-testid={`tab-category-${cat.value}`} className={cn("inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors border", active
                    ? "bg-[#2F6BFF] text-white border-[#2F6BFF] shadow-sm"
                    : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50")}>
                {cat.value === "agent_preset" && (<Sparkles className={cn("h-3.5 w-3.5", active ? "text-white" : "text-[#2F6BFF]")}/>)}
                {cat.value === "all" ? `All Templates (${templates.length})` : cat.label}
              </button>);
        })}
        </div>
      </div>

      {isLoading ? (<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (<Card key={i} className="overflow-hidden rounded-xl border-slate-200">
              <CardHeader className="p-4 space-y-2">
                <Skeleton className="h-5 w-24"/>
                <Skeleton className="h-5 w-40"/>
                <Skeleton className="h-12 w-full"/>
              </CardHeader>
              <CardFooter className="p-4 pt-0">
                <Skeleton className="h-10 w-full"/>
              </CardFooter>
            </Card>))}
        </div>) : filteredTemplates.length === 0 ? (<Card className="border-dashed border-slate-200 rounded-xl">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <BookOpen className="h-8 w-8 text-slate-400"/>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">
              {searchQuery ? "No templates found" : "No templates available"}
            </h3>
            <p className="text-sm text-slate-500 text-center max-w-sm">
              {searchQuery
                ? "Try adjusting your search query or browse different categories"
                : "Manage templates from the Templates page"}
            </p>
          </CardContent>
        </Card>) : (<>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {paginatedTemplates.map((template) => {
                const styleParts = [template.suggestedVoiceTone, template.suggestedPersonality].filter(Boolean);
                const styleText = styleParts.length ? styleParts.join(", ") : null;
                return (<Card key={template.id} className="group flex flex-col overflow-hidden rounded-xl border-slate-200 shadow-sm hover:shadow-md transition-shadow" data-testid={`card-template-${template.id}`}>
                  <CardHeader className="p-4 pb-2 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-medium rounded-md bg-slate-100 text-slate-600 border-slate-200">
                          {template.category}
                        </Badge>
                        {template.isSystemTemplate && (<Badge className="text-[10px] px-1.5 py-0 font-medium rounded-md bg-[#2F6BFF]/10 text-[#2F6BFF] border-0 hover:bg-[#2F6BFF]/10">
                            System
                          </Badge>)}
                      </div>
                      <span className="text-[11px] text-slate-400 shrink-0">
                        {template.usageCount}x used
                      </span>
                    </div>

                    <CardTitle className="text-[15px] font-semibold leading-snug text-slate-900">
                      {template.name}
                    </CardTitle>
                    <CardDescription className="text-sm text-slate-500 leading-relaxed line-clamp-3">
                      {template.description ||
                        template.systemPrompt.substring(0, 140) +
                            (template.systemPrompt.length > 140 ? "..." : "")}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="p-4 pt-2 space-y-2.5 flex-1">
                    {template.variables && template.variables.length > 0 && (<div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-semibold text-slate-800">Variables:</span>
                        {template.variables.slice(0, 3).map((v) => (<Badge key={v} variant="outline" className="text-[11px] px-1.5 py-0 font-mono rounded-md bg-slate-50 text-slate-600 border-slate-200">
                            {`{{${v}}}`}
                          </Badge>))}
                        {template.variables.length > 3 && (<Badge variant="outline" className="text-[11px] px-1.5 py-0 rounded-md">
                            +{template.variables.length - 3}
                          </Badge>)}
                      </div>)}

                    {styleText && (<div className="text-sm text-slate-600">
                        <span className="font-semibold text-slate-800">Style:</span>{" "}
                        <span>{styleText}</span>
                      </div>)}
                  </CardContent>

                  <CardFooter className="p-4 pt-0 flex flex-col gap-2">
                    {onSelectTemplate && (<Button type="button" variant="outline" className="w-full h-10 rounded-lg border-slate-200 text-slate-800 hover:bg-slate-50 hover:text-slate-900 gap-2" onClick={() => handleSelectTemplate(template)} data-testid={`button-use-template-${template.id}`}>
                        <CheckCircle2 className="h-4 w-4 text-slate-500"/>
                        Use Template
                      </Button>)}
                  </CardFooter>
                </Card>);
            })}
          </div>

          {totalPages > 1 && (<div className="flex items-center justify-between pt-2">
              <p className="text-sm text-slate-500">
                Showing {startIndex + 1}-
                {Math.min(startIndex + ITEMS_PER_PAGE, filteredTemplates.length)} of{" "}
                {filteredTemplates.length} templates
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} data-testid="button-prev-page">
                  <ChevronLeft className="h-4 w-4 mr-1"/>
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (<Button key={page} variant={currentPage === page ? "default" : "outline"} size="sm" className={cn("w-8 h-8 p-0", currentPage === page && "bg-[#2F6BFF] hover:bg-[#2558d9] text-white border-transparent")} onClick={() => setCurrentPage(page)} data-testid={`button-page-${page}`}>
                      {page}
                    </Button>))}
                </div>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} data-testid="button-next-page">
                  Next
                  <ChevronRight className="h-4 w-4 ml-1"/>
                </Button>
              </div>
            </div>)}
        </>)}

      <Dialog open={variableDialogOpen} onOpenChange={setVariableDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#2F6BFF]"/>
              Fill in Variables
            </DialogTitle>
            <DialogDescription>
              This template uses variables. Fill in the values below to customize the prompt.
            </DialogDescription>
          </DialogHeader>
          {selectedTemplate && selectedTemplate.variables && (<div className="space-y-4 py-4">
              {selectedTemplate.variables.map((variable) => (<div key={variable} className="space-y-2">
                  <Label htmlFor={`var-${variable}`} className="font-mono text-sm font-medium">
                    {`{{${variable}}}`}
                  </Label>
                  <Input id={`var-${variable}`} placeholder={`Enter ${variable}...`} value={variableValues[variable] || ""} onChange={(e) => setVariableValues((prev) => ({ ...prev, [variable]: e.target.value }))} className="h-11" data-testid={`input-variable-${variable}`}/>
                </div>))}
            </div>)}
          <DialogFooter>
            <Button variant="outline" onClick={() => setVariableDialogOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-[#2F6BFF] hover:bg-[#2558d9] text-white border-transparent" onClick={() => {
            if (selectedTemplate) {
                useMutation_template.mutate({ id: selectedTemplate.id, variableValues });
            }
        }} disabled={useMutation_template.isPending} data-testid="button-apply-template">
              {useMutation_template.isPending ? "Applying..." : "Apply Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>);
}
