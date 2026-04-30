import { ArrowUpRight } from "lucide-react";

const leaves = [
  { label: "Annual Leave", value: "12 Days" },
  { label: "Monthly Leave", value: "2 Days" },
  { label: "Daily Leave", value: "8 Days" },
  { label: "Hourly Leave", value: "6 Days" },
  { label: "Sick Leave Used", value: "5 Days" },
];

export function LeaveCards() {
  return (
    <div className="flex gap-3">
      {leaves.map((leave) => (
        <div
          key={leave.label}
          className="flex-1 rounded-2xl p-3 border border-border/25 shadow-[var(--card-shadow)]"
          style={{ backgroundColor: 'hsl(45 30% 99%)' }}
        >
          <div className="text-[10px] text-muted-foreground mb-1">{leave.label}</div>
          <div className="text-lg font-bold text-foreground mb-2">{leave.value}</div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-primary font-medium">Request Leave</span>
            <ArrowUpRight className="w-3 h-3 text-primary" />
          </div>
        </div>
      ))}
    </div>
  );
}
