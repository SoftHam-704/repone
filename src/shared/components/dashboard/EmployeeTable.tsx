import { MoreHorizontal, Search } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const employees = [
  {
    name: "Marvin McKinney",
    id: "3564756746",
    role: "UI Mentor",
    email: "example@gmail.com",
    status: "Active",
    date: "11 Nov 2024",
    department: "Team Project",
    initials: "MM",
  },
  {
    name: "Ralph Edwards",
    id: "365467354",
    role: "UX Researcher",
    email: "example@gmail.com",
    status: "Active",
    date: "10 Nov 2024",
    department: "Public Project",
    initials: "RE",
  },
];

const columns = ["NAME", "EMPLOYEE ID", "ROLE", "EMAIL", "STATUS", "DATE", "DEPARTMENT", "ACTION"];

export function EmployeeTable() {
  return (
    <div className="bg-card rounded-2xl p-4 border border-border/25 shadow-[var(--card-shadow)]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">List Employee</h3>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs">
            <Search className="w-3 h-3" />
            <span>Search</span>
          </div>
          <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              {columns.map((col) => (
                <th key={col} className="py-2 px-2 text-left font-medium text-muted-foreground text-[10px] tracking-wider">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => (
              <tr key={emp.id} className="border-b border-border last:border-0">
                <td className="py-2.5 px-2">
                  <div className="flex items-center gap-2">
                    <Avatar className="w-6 h-6">
                      <AvatarFallback className="bg-accent text-accent-foreground text-[8px] font-semibold">
                        {emp.initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-foreground">{emp.name}</span>
                  </div>
                </td>
                <td className="py-2.5 px-2 text-muted-foreground">{emp.id}</td>
                <td className="py-2.5 px-2 text-muted-foreground">{emp.role}</td>
                <td className="py-2.5 px-2 text-muted-foreground">{emp.email}</td>
                <td className="py-2.5 px-2">
                  <span className="px-2 py-0.5 rounded-full bg-accent text-accent-foreground text-[10px] font-medium">
                    {emp.status}
                  </span>
                </td>
                <td className="py-2.5 px-2 text-muted-foreground">{emp.date}</td>
                <td className="py-2.5 px-2 text-muted-foreground">{emp.department}</td>
                <td className="py-2.5 px-2">
                  <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
