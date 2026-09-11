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

const tabClass =
  "rounded-lg border border-transparent bg-transparent px-4 py-2.5 gap-2 shadow-none text-slate-500 data-[state=active]:bg-[#E8F1FF] data-[state=active]:text-[#007BFF] data-[state=active]:border-[#007BFF]/30 data-[state=active]:shadow-none";

export default function WABAConnection() {
  const [activeTab, setActiveTab] = useState("channel");

  return (
    <div className="space-y-6 pb-8">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="h-auto w-full sm:w-auto justify-start bg-transparent p-0 gap-2 flex-wrap">
          <TabsTrigger value="channel" className={tabClass}>
            <LayoutGrid className="h-4 w-4" />
            Channel Settings
          </TabsTrigger>
          <TabsTrigger value="ai" className={tabClass}>
            <Brain className="h-4 w-4" />
            AI Settings
          </TabsTrigger>
        </TabsList>

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
