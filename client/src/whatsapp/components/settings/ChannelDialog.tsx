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
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@wa/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@wa/components/ui/form";
import { Input } from "@wa/components/ui/input";
import { Button } from "@wa/components/ui/button";
import { useToast } from "@wa/hooks/use-toast";
import { apiRequest, queryClient } from "@wa/lib/queryClient";
import type { Channel } from "@shared/whatsapp-schema";
import { useAuth } from "@wa/contexts/auth-context";

const channelFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phoneNumber: z.string().min(10, "Valid phone number required"),
  phoneNumberId: z.string().min(1, "Phone Number ID is required"),
  wabaId: z.string().min(1, "Business Account ID is required"),
  appId: z.string().min(1, "App ID is required"),
  accessToken: z.string().min(1, "Access Token is required"),
  businessAccountId: z.string().optional(),
  mmLiteEnabled: z.boolean().default(false),
  mmLiteApiUrl: z.string().optional(),
  mmLiteApiKey: z.string().optional(),
});

interface ChannelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingChannel: Channel | null;
  onSuccess: (channel?: Channel | null) => void;
}

const inputClass =
  "h-10 rounded-md border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus-visible:ring-[#007BFF] focus-visible:ring-offset-0 focus-visible:border-[#007BFF]";

export function ChannelDialog({ open, onOpenChange, editingChannel, onSuccess }: ChannelDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const channelForm = useForm<z.infer<typeof channelFormSchema>>({
    resolver: zodResolver(channelFormSchema),
    defaultValues: {
      name: "",
      phoneNumber: "",
      phoneNumberId: "",
      wabaId: "",
      appId: "",
      accessToken: "",
      businessAccountId: "",
      mmLiteEnabled: false,
      mmLiteApiUrl: "",
      mmLiteApiKey: "",
    },
  });

  useEffect(() => {
    if (editingChannel) {
      channelForm.reset({
        name: editingChannel.name,
        phoneNumber: editingChannel.phoneNumber || "",
        phoneNumberId: editingChannel.phoneNumberId,
        wabaId: editingChannel.whatsappBusinessAccountId || "",
        appId: editingChannel.appId || "",
        accessToken: editingChannel.accessToken,
        businessAccountId: "",
        mmLiteEnabled: editingChannel.mmLiteEnabled || false,
        mmLiteApiUrl: editingChannel.mmLiteApiUrl || "",
        mmLiteApiKey: editingChannel.mmLiteApiKey || "",
      });
    } else {
      channelForm.reset({
        name: "",
        phoneNumber: "",
        phoneNumberId: "",
        wabaId: "",
        appId: "",
        accessToken: "",
        businessAccountId: "",
        mmLiteEnabled: false,
        mmLiteApiUrl: "",
        mmLiteApiKey: "",
      });
    }
  }, [editingChannel, open, channelForm]);

  const createChannelMutation = useMutation({
    mutationFn: async (data: z.infer<typeof channelFormSchema>) => {
      const payload = {
        name: data.name,
        phoneNumber: data.phoneNumber,
        phoneNumberId: data.phoneNumberId,
        whatsappBusinessAccountId: data.wabaId,
        appId: data.appId,
        businessAccountId: data.businessAccountId,
        accessToken: data.accessToken,
        mmLiteEnabled: data.mmLiteEnabled,
        mmLiteApiUrl: data.mmLiteApiUrl,
        mmLiteApiKey: data.mmLiteApiKey,
        isActive: true,
      };

      const res = editingChannel
        ? await apiRequest("PUT", `/api/whatsapp/channels/${editingChannel.id}`, payload)
        : await apiRequest("POST", "/api/whatsapp/channels", payload);
      return await res.json();
    },
    onSuccess: async (created: any) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/channels"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/channels/active"] });

      if (!editingChannel && created?.healthStatus) {
        if (created.healthStatus === "healthy") {
          toast({
            title: "Channel created successfully",
            description: "Your channel is connected and healthy!",
          });
        } else if (created.healthStatus === "error") {
          toast({
            title: "Channel created with issues",
            description:
              created.healthDetails?.error ||
              "Channel was created but has connection issues. Please check your credentials.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Channel created",
            description: "Your new channel has been added successfully.",
          });
        }
      } else {
        toast({
          title: editingChannel ? "Channel updated" : "Channel created",
          description: editingChannel
            ? "Your channel has been updated successfully."
            : "Your new channel has been added successfully.",
        });
      }
      onSuccess(created);
    },
    onError: (error: any) => {
      let errorData = error?.response?.data;

      if (!errorData && typeof error?.message === "string") {
        try {
          const match = error.message.match(/\{.*\}/);
          if (match) {
            errorData = JSON.parse(match[0]);
          }
        } catch {
          // ignore parse errors
        }
      }

      toast({
        title: "Error",
        description:
          errorData?.error ||
          errorData?.message ||
          error?.message ||
          "Something went wrong while saving the channel.",
        variant: "destructive",
      });
    },
  });

  const handleChannelSubmit = (data: z.infer<typeof channelFormSchema>) => {
    createChannelMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto p-0 gap-0 rounded-xl border-slate-200">
        <DialogHeader className="px-6 pt-6 pb-4 space-y-1.5 text-left">
          <DialogTitle className="text-xl font-semibold text-slate-900">
            {editingChannel ? "Edit WhatsApp Channel" : "Add New WhatsApp Channel"}
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500">
            Configure your WhatsApp Business API credentials and settings.
          </DialogDescription>
        </DialogHeader>

        <Form {...channelForm}>
          <form onSubmit={channelForm.handleSubmit(handleChannelSubmit)} className="px-6 pb-6 space-y-5">
            <FormField
              control={channelForm.control}
              name="name"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel className="text-sm font-semibold text-slate-800">Channel Name</FormLabel>
                  <FormControl>
                    <Input placeholder="My Business" className={inputClass} {...field} />
                  </FormControl>
                  <FormDescription className="text-xs text-slate-400">
                    A friendly name to identify this channel
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={channelForm.control}
              name="phoneNumber"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel className="text-sm font-semibold text-slate-800">Phone Number</FormLabel>
                  <FormControl>
                    <Input placeholder="+1234567890" className={inputClass} {...field} />
                  </FormControl>
                  <FormDescription className="text-xs text-slate-400">
                    The WhatsApp Business phone number
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={channelForm.control}
              name="appId"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel className="text-sm font-semibold text-slate-800">Meta App ID</FormLabel>
                  <FormControl>
                    <Input placeholder="123456789012345" className={inputClass} {...field} />
                  </FormControl>
                  <FormDescription className="text-xs text-slate-400">
                    Your Meta (Facebook) App ID
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={channelForm.control}
              name="phoneNumberId"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel className="text-sm font-semibold text-slate-800">Phone Number ID</FormLabel>
                  <FormControl>
                    <Input placeholder="123456789012345" className={inputClass} {...field} />
                  </FormControl>
                  <FormDescription className="text-xs text-slate-400">
                    Found in Meta Business Suite under WhatsApp settings
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={channelForm.control}
              name="wabaId"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel className="text-sm font-semibold text-slate-800">
                    WhatsApp Business Account ID
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="123456789012345" className={inputClass} {...field} />
                  </FormControl>
                  <FormDescription className="text-xs text-slate-400">
                    Your WhatsApp Business Account ID from Meta
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={channelForm.control}
              name="accessToken"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel className="text-sm font-semibold text-slate-800">Access Token</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Your access token"
                      className={inputClass}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription className="text-xs text-slate-400">
                    Your permanent access token from Meta
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={channelForm.control}
              name="businessAccountId"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel className="text-sm font-semibold text-slate-800">
                    Business Account ID{" "}
                    <span className="font-normal text-slate-400">(Optional)</span>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="123456789012345" className={inputClass} {...field} />
                  </FormControl>
                  <FormDescription className="text-xs text-slate-400">
                    Your Meta Business Account ID (optional)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-2 gap-2 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="h-10 bg-white border-slate-200 text-slate-700 shadow-none"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={user?.username === "demouser" || createChannelMutation.isPending}
                className="h-10 bg-[#007BFF] hover:bg-[#0069d9] text-white border-transparent shadow-none"
              >
                {createChannelMutation.isPending
                  ? "Saving..."
                  : editingChannel
                    ? "Update Channel"
                    : "Create Channel"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
