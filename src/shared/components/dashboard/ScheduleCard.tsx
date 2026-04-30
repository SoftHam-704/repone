import { MoreHorizontal, Video, ChevronDown } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const tabs = ["Meetings", "Tasks", "Events"];

const meetings = [
  {
    title: "Interview Candidate UI/UX Designer",
    subtitle: "Project Discussion",
    platform: "Google Meet",
    time: "13.00 - 13.30",
    avatars: ["A", "B"],
  },
  {
    title: "Retro Day Celebration - HR Department",
    subtitle: "Arrangement Plan",
    platform: "Google Meet",
    time: "15.00 - 16.00",
    avatars: ["C", "D"],
  },
];

export function ScheduleCard() {
  return (
    <div className="bg-card rounded-2xl p-4 border border-border/25 shadow-[var(--card-shadow)] flex-1">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">11 Nov 2024</span>
          <ChevronDown className="w-3 h-3" />
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-foreground">Schedule</span>
          <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        {tabs.map((tab, i) => (
          <button
            key={tab}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              i === 0
                ? "bg-foreground text-card"
                : "bg-muted text-muted-foreground hover:bg-accent"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Meetings */}
      <div className="space-y-3">
        {meetings.map((m) => (
          <div key={m.title} className="bg-accent/50 rounded-xl p-3">
            <div className="flex items-start justify-between mb-1">
              <h4 className="text-xs font-semibold text-foreground leading-tight">{m.title}</h4>
              <Video className="w-4 h-4 text-muted-foreground flex-shrink-0 ml-2" />
            </div>
            <p className="text-[10px] text-muted-foreground mb-2">{m.subtitle}</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground bg-card px-2 py-0.5 rounded">{m.platform}</span>
                <span className="text-[10px] text-muted-foreground">{m.time}</span>
              </div>
              <div className="flex -space-x-1.5">
                {m.avatars.map((a) => (
                  <Avatar key={a} className="w-5 h-5 border border-card">
                    <AvatarFallback className="bg-primary text-primary-foreground text-[8px]">{a}</AvatarFallback>
                  </Avatar>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
