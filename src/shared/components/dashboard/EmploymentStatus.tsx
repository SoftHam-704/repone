import { MoreHorizontal } from "lucide-react";

const statuses = [
  { label: "Permanent", value: 60, color: "bg-primary" },
  { label: "Contract", value: 25, color: "bg-foreground" },
  { label: "Probation", value: 15, color: "bg-muted-foreground" },
];

export function EmploymentStatus() {
  return (
    <div className="bg-card rounded-2xl p-4 border border-border/25 shadow-[var(--card-shadow)]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">Employment Status</h3>
        <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
      </div>

      <div className="flex items-center gap-4">
        {/* Mini bar chart */}
        <div className="flex items-end gap-1.5 h-[80px]">
          {[40, 55, 70, 85, 60].map((h, i) => (
            <div
              key={i}
              className="w-5 rounded-t bg-primary/30"
              style={{ height: `${h}%` }}
            >
              <div
                className="w-full rounded-t bg-primary"
                style={{ height: `${Math.min(h * 0.6, 100)}%` }}
              />
            </div>
          ))}
        </div>

        <div className="text-right">
          <div className="text-2xl font-bold text-foreground">450</div>
          <div className="text-[10px] text-muted-foreground">Active Employee</div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-2 mt-3">
        {statuses.map((s) => (
          <div
            key={s.label}
            className={`flex-1 py-2 rounded-lg text-center text-[10px] font-medium ${
              s.label === "Permanent"
                ? "bg-primary text-primary-foreground"
                : s.label === "Contract"
                ? "bg-foreground text-card"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {s.label}
          </div>
        ))}
      </div>
    </div>
  );
}
