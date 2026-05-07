export function minutesToHoursString(totalMinutes: number): string {
   if (totalMinutes < 60) return `${totalMinutes}m`;
   const hours = Math.floor(totalMinutes / 60);
   const mins = totalMinutes % 60;

   return `${hours}h ${mins}m`;
}

export function createdAtToDateTimeString(createdAt: string): string {
   const date = new Date(createdAt);

   const datePart = date.toLocaleDateString("en-US", {
      month: "numeric",
      day: "numeric",
      year: "numeric",
   });

   const timePart = date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
   });

   return `${datePart} at ${timePart}`;
}


export function dateToWords(dateStr: string): string {
   const date = new Date(dateStr);

   const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
   ];

   const month = months[date.getMonth()];
   const day = date.getDate();
   const year = date.getFullYear();

   return `${month} ${day}, ${year}`;
}
