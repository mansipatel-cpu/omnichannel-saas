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
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@wa/components/ui/dialog";
import { Input } from "@wa/components/ui/input";
import { Label } from "@wa/components/ui/label";
import { Button } from "@wa/components/ui/button";
import { Textarea } from "@wa/components/ui/textarea";
import { useToast } from "@wa/hooks/use-toast";
import { apiRequest } from "@wa/lib/queryClient";
import { Pencil } from "lucide-react";

interface TestMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelId: string | null;
}

const inputClass =
  "h-10 rounded-md border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus-visible:ring-[#007BFF] focus-visible:ring-offset-0 focus-visible:border-[#007BFF]";

export function TestMessageDialog({ open, onOpenChange, channelId }: TestMessageDialogProps) {
  const [testPhoneNumber, setTestPhoneNumber] = useState("919310797700");
  const [testMessage, setTestMessage] = useState("Hello! This is a test message from WhatsWay.");
  const { toast } = useToast();

  const testMessageMutation = useMutation({
    mutationFn: async () => {
      if (!channelId) throw new Error("No channel selected");

      let formattedPhone = testPhoneNumber.replace(/\D/g, "");
      if (!formattedPhone.startsWith("+")) {
        formattedPhone = "+" + formattedPhone;
      }

      return await apiRequest("POST", `/api/whatsapp/channels/${channelId}/test`, {
        phoneNumber: formattedPhone,
        message: testMessage,
      });
    },
    onSuccess: () => {
      toast({
        title: "Test message sent",
        description: "The test message has been sent successfully.",
      });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Failed to send test message",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSendTest = () => {
    if (!testPhoneNumber || !testMessage) {
      toast({
        title: "Missing information",
        description: "Please provide both phone number and message",
        variant: "destructive",
      });
      return;
    }
    testMessageMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-0 gap-0 rounded-xl border-slate-200">
        <DialogHeader className="px-6 pt-6 pb-4 space-y-1.5 text-left">
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold text-slate-900">
            <Pencil className="h-5 w-5 text-slate-700" />
            Send Test Message
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500">
            Send a test WhatsApp message to verify your channel configuration
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="testPhone" className="text-sm font-semibold text-slate-800">
              Phone Number
            </Label>
            <Input
              id="testPhone"
              placeholder="919310797700"
              value={testPhoneNumber}
              onChange={(e) => setTestPhoneNumber(e.target.value)}
              className={inputClass}
            />
            <p className="text-xs text-slate-400">
              Enter without + or spaces (e.g., 919310797700)
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="testMessage" className="text-sm font-semibold text-slate-800">
              Message
            </Label>
            <Textarea
              id="testMessage"
              placeholder="Enter your test message..."
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              rows={4}
              className="min-h-[100px] rounded-md border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus-visible:ring-[#007BFF] focus-visible:ring-offset-0 focus-visible:border-[#007BFF]"
            />
          </div>
        </div>

        <DialogFooter className="px-6 py-5 gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-10 bg-white border-slate-200 text-slate-700 shadow-none"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSendTest}
            disabled={testMessageMutation.isPending}
            className="h-10 bg-[#007BFF] hover:bg-[#0069d9] text-white border-transparent shadow-none"
          >
            {testMessageMutation.isPending ? "Sending..." : "Send Test Message"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
