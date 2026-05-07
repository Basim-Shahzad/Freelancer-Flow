export function getInitials(name: string): string {
   if (!name) return "";
   const words = name.trim().split(/\s+/);
   return words
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? "")
      .join("");
}

export function getColorFromName(name: string): string | undefined {
   if (!name) return "";
   const colors = ["#6366F1", "#8B5CF6", "#EC4899", "#EF4444", "#F59E0B", "#10B981", "#06B6D4", "#3B82F6"];
   const hash = name.trim().split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
   return colors[hash % colors.length];
}