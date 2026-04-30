import { Users, CreditCard, TrendingDown, UserPlus } from "lucide-react";

const stats = [
  { icon: Users, value: "432", label: "Employees", color: "text-foreground" },
  { icon: CreditCard, value: "24", label: "Payrolls", color: "text-foreground" },
  { icon: TrendingDown, value: "8%", label: "Turnover Rate", color: "text-foreground" },
  { icon: UserPlus, value: "24", label: "Job Applicants", color: "text-foreground" },
];

export function StatsCards() {
  return (
    <div className="flex gap-6">
      {stats.map((stat) => (
        <div key={stat.label} className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
            <stat.icon className="w-4 h-4 text-foreground" />
          </div>
          <div>
            <div className="text-xl font-bold text-foreground">{stat.value}</div>
            <div className="text-[11px] text-muted-foreground">{stat.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
