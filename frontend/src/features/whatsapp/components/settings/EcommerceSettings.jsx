import { Card, CardContent, CardDescription, CardHeader, CardTitle, } from "@wa/components/ui/card";
import { Button } from "@wa/components/ui/button";
import { Input } from "@wa/components/ui/input";
import { Label } from "@wa/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger, } from "@wa/components/ui/tabs";
import { Store, Save, CheckCircle, } from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@wa/lib/queryClient";
import { useToast } from "@wa/hooks/use-toast";
export default function EcommerceSettings() {
    const { toast } = useToast();
    const [shopifySettings, setShopifySettings] = useState({
        clientId: "",
        clientSecret: "",
        appUrl: "",
        callbackUrl: "",
        webhookUrl: "",
        // scopes: "",
    });
    const { data: settingsData, isLoading } = useQuery({
        queryKey: [
            "/api/whatsapp/ecommerce/settings/shopify",
        ],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/whatsapp/ecommerce/settings/shopify");
            return res.json();
        },
    });
    useEffect(() => {
        if (settingsData?.data) {
            setShopifySettings({
                clientId: settingsData.data.clientId || "",
                clientSecret: settingsData.data.clientSecret || "",
                appUrl: settingsData.data.appUrl || "",
                callbackUrl: settingsData.data.callbackUrl || "",
                webhookUrl: settingsData.data.webhookUrl || ""
                // scopes: settingsData.data.scopes || "",
            });
        }
    }, [settingsData]);
    const saveMutation = useMutation({
        mutationFn: async () => {
            const res = await apiRequest("POST", "/api/whatsapp/ecommerce/settings/shopify", shopifySettings);
            return res.json();
        },
        onSuccess: () => {
            toast({
                title: "Success",
                description: "Settings saved successfully",
            });
        },
        onError: () => {
            toast({
                title: "Error",
                description: "Failed to save settings",
                variant: "destructive",
            });
        },
    });
    const testConnectionMutation = useMutation({
        mutationFn: async () => {
            const res = await apiRequest("POST", "/api/whatsapp/ecommerce/settings/shopify/test");
            return res.json();
        },
        onSuccess: () => {
            toast({
                title: "Success",
                description: "Connection successful",
            });
        },
        onError: () => {
            toast({
                title: "Error",
                description: "Connection failed",
                variant: "destructive",
            });
        },
    });
    return (<div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">
          E-Commerce Integrations
        </h2>
        <p className="text-muted-foreground">
          Configure and manage your e-commerce platform integrations.
        </p>
      </div>

      {/*
          🔧 WooCommerce tab removed: unlike Shopify (which needs one
          superadmin-level OAuth app — Client ID/Secret shared across ALL
          users), WooCommerce has no such app-level config. Each user enters
          their own store's Consumer Key/Secret directly on the Stores page
          when connecting — there's nothing for a superadmin to configure
          here.
        */}
      <Tabs defaultValue="shopify" className="space-y-6 min-w-0">
        <TabsList>
          <TabsTrigger value="shopify">
            <Store className="mr-2 h-4 w-4"/>
            Shopify
          </TabsTrigger>

          {/* <TabsTrigger value="magento">
          <Globe className="mr-2 h-4 w-4" />
          Magento
        </TabsTrigger> */}
        </TabsList>

        {/* SHOPIFY */}
        <TabsContent value="shopify" className="min-w-0">
          <Card>
            <CardHeader>
              <CardTitle>
                Shopify Integration
              </CardTitle>

              <CardDescription>
                Configure Shopify OAuth,
                Webhooks and Store
                Connection Settings
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6 overflow-hidden">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 min-w-0">
                <div className="min-w-0">
                  <Label>
                    Client ID
                  </Label>

                  

                  <Input placeholder="Shopify Client ID" className="w-full min-w-0" value={shopifySettings.clientId} onChange={(e) => setShopifySettings((prev) => ({
            ...prev,
            clientId: e.target.value,
        }))}/>
                </div>

                <div className="min-w-0">
                  <Label>
                    Client Secret
                  </Label>

                  <Input type="password" placeholder="Shopify Client Secret" className="w-full min-w-0" value={shopifySettings.clientSecret} onChange={(e) => setShopifySettings((prev) => ({
            ...prev,
            clientSecret: e.target.value,
        }))}/>
                </div>

                <div className="min-w-0">
                  <Label>
                    App URL
                  </Label>

                 

                  <Input placeholder={window.location.origin} className="w-full min-w-0" value={shopifySettings.appUrl} onChange={(e) => setShopifySettings((prev) => ({
            ...prev,
            appUrl: e.target.value,
        }))}/>
                </div>

                <div className="min-w-0">
                  <Label>
                    Callback URL
                  </Label>

                  <Input placeholder={`${window.location.origin}/api/ecommerce/shopify/callback`} className="w-full min-w-0" value={shopifySettings.callbackUrl} onChange={(e) => setShopifySettings((prev) => ({
            ...prev,
            callbackUrl: e.target.value,
        }))}/>
                </div>

                <div className="min-w-0">
                  <Label>
                    Webhook URL
                  </Label>

                  <Input placeholder={`${window.location.origin}/api/ecommerce/shopify/webhooks`} className="w-full min-w-0" value={shopifySettings.webhookUrl} onChange={(e) => setShopifySettings((prev) => ({
            ...prev,
            webhookUrl: e.target.value,
        }))}/>
                </div>

                {/* <div className="min-w-0">
          <Label>
            Scopes
          </Label>

          <Input
            placeholder="read_customers,read_orders,read_products"
            className="w-full min-w-0"
             value={shopifySettings.scopes}
onChange={(e) =>
setShopifySettings((prev) => ({
...prev,
scopes: e.target.value,
}))
}
          />
        </div> */}
              </div>

           <div className="rounded-lg border bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900 p-5">
  <h4 className="text-base font-semibold text-blue-900 dark:text-blue-300">
    Shopify App Configuration Guide
  </h4>

  <p className="text-sm text-muted-foreground mt-1">
    Complete the following steps in your <strong>Shopify Partner Dashboard</strong> before users connect their Shopify stores.
  </p>

  <ol className="mt-4 space-y-3 text-sm list-decimal ml-5">
    <li>
      Open <strong>Shopify Partner Dashboard</strong> and select your Shopify App.
    </li>

    <li>
      Navigate to <strong>Configuration</strong>.
    </li>

    <li>
      Copy the <strong>App URL</strong> from above and paste it into the
      <strong> App URL</strong> field in Shopify.
    </li>

    <li>
      Copy the <strong>Callback URL</strong> and add it under
      <strong> Allowed redirection URL(s)</strong>.
    </li>

    <li>
      Save the configuration.
    </li>

    {/* <li>
          Go to <strong>API Access → Configure Admin API Scopes</strong> and ensure the following scopes are enabled:
          <ul className="list-disc ml-5 mt-2 space-y-1">
            <li>read_orders</li>
            <li>read_customers</li>
            <li>read_products</li>
            <li>read_inventory</li>
          </ul>
        </li>
    
        <li>
          Click <strong>Save</strong> and install (or reinstall) the app if Shopify asks you to update permissions.
        </li>
    
        <li>
          After completing the above steps, return to Whatsway and connect the Shopify store from
          <strong> E-Commerce → Stores</strong>.
        </li> */}
  </ol>

  <div className="mt-4 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 p-3">
    <p className="text-sm">
      <strong>Note:</strong> Webhooks are registered automatically when a user connects their Shopify store. No manual webhook configuration is required.
    </p>
  </div>
    </div>

              <div className="flex gap-3 flex-wrap">
                {/* <Button variant="outline">
          Test Connection
        </Button>

        <Button>
          <Save className="mr-2 h-4 w-4" />
          Save Settings
        </Button> */}

                <Button variant="outline" onClick={() => testConnectionMutation.mutate()} disabled={testConnectionMutation.isPending}>
  Test Connection
    </Button>

    <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
  <Save className="mr-2 h-4 w-4"/>
  {saveMutation.isPending
            ? "Saving..."
            : "Save Settings"}
    </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* MAGENTO */}
        <TabsContent value="magento" className="min-w-0">
          <Card>
            <CardHeader>
              <CardTitle>
                Magento Integration
              </CardTitle>

              <CardDescription>
                Configure Magento API
                Credentials
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6 overflow-hidden">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 min-w-0">
                <div className="min-w-0">
                  <Label>
                    Store URL
                  </Label>

                  <Input placeholder="https://store.com" className="w-full min-w-0"/>
                </div>

                <div className="min-w-0">
                  <Label>
                    Access Token
                  </Label>

                  <Input type="password" placeholder="Magento Access Token" className="w-full min-w-0"/>
                </div>
              </div>

              <Button>
                <Save className="mr-2 h-4 w-4"/>
                Save Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* STATUS */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>
            Integration Status
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex items-center justify-between border rounded-lg p-4 flex-wrap gap-2">
            <div className="min-w-0">
              <h4 className="font-medium">
                Shopify
              </h4>
              <p className="text-sm text-muted-foreground">
                Connected & Ready
              </p>
            </div>

            <CheckCircle className="text-green-500 h-5 w-5 shrink-0"/>
          </div>


         

          {/* <div className="flex items-center justify-between border rounded-lg p-4 flex-wrap gap-2">
          <div className="min-w-0">
            <h4 className="font-medium">
              Magento
            </h4>
            <p className="text-sm text-muted-foreground">
              Not Configured
            </p>
          </div>
        </div> */}

         
        </CardContent>

         
      </Card>
    </div>);
}
