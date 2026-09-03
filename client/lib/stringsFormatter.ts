export function correctCapitalization(string: string): string {
   if (!string) return "";
   let lower = string.toLowerCase();
   if (lower.includes("_")) {
      lower = lower.replace("_", " ");
   }
   return lower.charAt(0).toUpperCase() + lower.slice(1);
}
