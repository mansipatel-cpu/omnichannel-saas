import { Button } from "@wa/components/ui/button";
import { Input } from "@wa/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@wa/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@wa/components/ui/select";
import { Plus, Trash2, Bell } from "lucide-react";
import { Node } from "@xyflow/react";

interface Reminder {
  id: string;
  delay: number;
  unit: "minutes" | "hours" | "days";
  templateNodeId: string;
}

interface TriggerSettingsProps {
  triggerConfig: {
    reminders: Reminder[];
  };
  setTriggerConfig: React.Dispatch<React.SetStateAction<any>>;
  nodes: Node[];
}

export default function TriggerSettings({
  triggerConfig,
  setTriggerConfig,
  nodes,
}: TriggerSettingsProps) {
  const templateNodes = nodes.filter(
    (node) => node.type === "send_template"
  );

  const addReminder = () => {
    setTriggerConfig((prev: any) => ({
      ...prev,
      reminders: [
        ...(prev.reminders || []),
        {
          id: crypto.randomUUID(),
          delay: 30,
          unit: "minutes",
          templateNodeId: "",
        },
      ],
    }));
  };

  const removeReminder = (id: string) => {
    setTriggerConfig((prev: any) => ({
      ...prev,
      reminders: prev.reminders.filter(
        (r: Reminder) => r.id !== id
      ),
    }));
  };

  const updateReminder = (
    id: string,
    data: Partial<Reminder>
  ) => {
    setTriggerConfig((prev: any) => ({
      ...prev,
      reminders: prev.reminders.map((r: Reminder) =>
        r.id === id ? { ...r, ...data } : r
      ),
    }));
  };

  return (
    <Card className="mx-4 mt-4 border shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Bell className="w-4 h-4" />
          Cart Reminder Settings
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {triggerConfig.reminders?.map(
          (reminder: Reminder, index: number) => (
            <div
              key={reminder.id}
              className="rounded-lg border p-4 bg-gray-50"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="font-medium text-sm">
                  Reminder {index + 1}
                </div>

                {triggerConfig.reminders.length > 1 && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      removeReminder(reminder.id)
                    }
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                )}
              </div>

              {/* Stack vertically on small panels, row on larger ones.
                 Template Node gets its own row so the select never gets squeezed. */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {/* Delay */}
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">
                      Delay
                    </label>

                    <Input
                      type="number"
                      min={1}
                      value={reminder.delay}
                      onChange={(e) =>
                        updateReminder(reminder.id, {
                          delay: Number(e.target.value),
                        })
                      }
                    />
                  </div>

                  {/* Unit */}
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">
                      Unit
                    </label>

                    <Select
                      value={reminder.unit}
                      onValueChange={(value) =>
                        updateReminder(reminder.id, {
                          unit: value as Reminder["unit"],
                        })
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItem value="minutes">
                          Minutes
                        </SelectItem>

                        <SelectItem value="hours">
                          Hours
                        </SelectItem>

                        <SelectItem value="days">
                          Days
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Template - full width, own row */}
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">
                    Template Node
                  </label>

                  <Select
                    value={reminder.templateNodeId}
                    onValueChange={(value) =>
                      updateReminder(reminder.id, {
                        templateNodeId: value,
                      })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Template" />
                    </SelectTrigger>

                    <SelectContent>
                      {templateNodes.map((node, idx) => (
                        <SelectItem key={node.id} value={node.id}>
                          {node.data.templateName ||
                            node.data.template?.name ||
                            node.data.label ||
                            `Template ${idx + 1}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )
        )}

        <Button
          type="button"
          variant="outline"
          onClick={addReminder}
          className="w-full"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Reminder
        </Button>
      </CardContent>
    </Card>
  );
}