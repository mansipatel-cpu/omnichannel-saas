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
import { Brain, LayoutGrid } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@wa/components/ui/tabs";
import { ChannelSettings } from "@wa/components/settings/ChannelSettings";
import AISettings from "@wa/components/settings/AISettings";

export default function WABAConnection() {
  const [activeTab, setActiveTab] = useState("channel");

  return (
    <div className="space-y-6 pb-8">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="border-b border-slate-200">
          <TabsList className="h-auto w-full sm:w-auto justify-start bg-transparent p-0 gap-6 rounded-none">
            <TabsTrigger
              value="channel"
              className="rounded-none border-b-2 border-transparent bg-transparent px-0 pb-3 pt-1 gap-2 shadow-none data-[state=active]:border-[#007BFF] data-[state=active]:bg-transparent data-[state=active]:text-[#007BFF] data-[state=active]:shadow-none text-slate-500"
            >
              <LayoutGrid className="h-4 w-4" />
              Channel Settings
            </TabsTrigger>
            <TabsTrigger
              value="ai"
              className="rounded-none border-b-2 border-transparent bg-transparent px-0 pb-3 pt-1 gap-2 shadow-none data-[state=active]:border-[#007BFF] data-[state=active]:bg-transparent data-[state=active]:text-[#007BFF] data-[state=active]:shadow-none text-slate-500"
            >
              <Brain className="h-4 w-4" />
              AI Settings
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="channel" className="mt-6 focus-visible:outline-none">
          <ChannelSettings />
        </TabsContent>

        <TabsContent value="ai" className="mt-6 focus-visible:outline-none">
          <AISettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
