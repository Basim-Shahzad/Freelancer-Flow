export const formatTime = (ms: number): string => {
   const total = Math.floor(ms / 1000);
   const h = Math.floor(total / 3600);
   const m = Math.floor((total % 3600) / 60);
   const s = total % 60;
   return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

export const formatDuration = (minutes: number): string => {
   if (minutes < 60) return `${minutes}m`;
   const hours = Math.floor(minutes / 60);
   const mins = minutes % 60;
   return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};