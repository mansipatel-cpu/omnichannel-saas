import { Button } from "@wa/components/ui/button";
import { useTranslation } from "@wa/lib/i18n";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, } from "@wa/components/ui/dialog";
import { Phone, FileText } from "lucide-react";
import { TemplatePickerDialog } from "@wa/components/shared/TemplatePickerDialog";
export function TemplateMessageDialog({ showMessageDialog, setShowMessageDialog, selectedContact, activeChannel, sendMessageMutation, user, headerType, setHeaderType, }) {
    const { t } = useTranslation();
    const handleSelectTemplate = (template, variables, mediaId, pickerHeaderType, buttonParameters, expirationTimeMs, carouselCardMediaIds) => {
        if (!selectedContact || !activeChannel)
            return;
        setHeaderType(pickerHeaderType ?? null);
        sendMessageMutation.mutate({
            phone: selectedContact.phone,
            type: "template",
            templateName: template.name,
            templateLanguage: template.language || "en_US",
            templateVariables: variables,
            headerMediaId: mediaId || undefined,
            headerType: pickerHeaderType,
            buttonParameters: buttonParameters && buttonParameters.length > 0 ? buttonParameters : undefined,
            expirationTimeMs,
            ...(carouselCardMediaIds && Object.keys(carouselCardMediaIds).length > 0
                ? { carouselCardMediaIds }
                : {}),
        });
    };
    return (<Dialog open={showMessageDialog} onOpenChange={setShowMessageDialog}>
      <DialogContent className="max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t("contacts.sendMessage.title")}</DialogTitle>
          <DialogDescription>
            {t("contacts.sendMessage.description")} {selectedContact?.name} (
            {selectedContact?.phone})
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-4 py-4 px-1">
          {activeChannel && (<div className="p-3 bg-gray-50 rounded-md border border-gray-200">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-gray-600"/>
                <div className="text-sm">
                  <span className="font-medium">
                    {t("contacts.sendMessage.activeChannel")}
                  </span>{" "}
                  <span className="text-gray-700">{activeChannel.name}</span>
                </div>
              </div>
            </div>)}

          {!activeChannel && (<div className="p-3 bg-yellow-50 rounded-md border border-yellow-200">
              <p className="text-sm text-yellow-800">
                {t("contacts.sendMessage.noChannel")}
              </p>
            </div>)}

          <div className="flex flex-col items-center gap-3 py-4">
            <p className="text-sm text-gray-600 text-center">
              Select a template to send to this contact
            </p>
            <TemplatePickerDialog channelId={activeChannel?.id} onSelectTemplate={handleSelectTemplate} submitLabel="Send Template" missingChannelMessage="Create a WhatsApp channel before sending a template." trigger={<Button variant="outline" className="gap-2" disabled={!activeChannel || user?.username === "demouser"}>
                  <FileText className="h-4 w-4"/>
                  Choose & Send Template
                </Button>}/>
          </div>

          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={() => setShowMessageDialog(false)}>
              {t("contacts.addContact.cancel")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>);
}
