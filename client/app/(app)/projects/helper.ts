export function getInitials(name: string): string {
   if (!name) return "";
   const words = name.trim().split(/\s+/);
   return words
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? "")
      .join("");
}

export function formatToMonthDay(isoString: string): string {
   return new Date(isoString).toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

export function capitalizeFirstLetter(text: string): string {
   return text.charAt(0).toUpperCase() + text.slice(1);
}

export const statusChipColor: Record<string, string> = {
   active: "warning",
   completed: "success",
   archived: "default",
};

export function convertMinutesToHoursAndMinutes(totalMinutes: number): string {
   if (totalMinutes < 0) return "0h 0m";
   return `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;
}
