import type { SectionKey } from "@/lib/types";
import { ChatIcon, LightbulbIcon, ChecklistIcon, CalendarIcon, DollarIcon, FlagIcon } from "@/components/icons";

export const SECTION_ICONS: Record<SectionKey, React.ReactNode> = {
  introduction: <ChatIcon className="w-4 h-4" />,
  proposed_solution: <LightbulbIcon className="w-4 h-4" />,
  deliverables: <ChecklistIcon className="w-4 h-4" />,
  timeline: <CalendarIcon className="w-4 h-4" />,
  pricing: <DollarIcon className="w-4 h-4" />,
  next_steps: <FlagIcon className="w-4 h-4" />,
};
