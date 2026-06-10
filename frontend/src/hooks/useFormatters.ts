import { useState, useEffect } from "react";
import { useApi } from "./useApi.tsx";
import type { Project } from "@/types/models.js";

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function useFormatters() {

   function formatDate(dateString) {
      const d = new Date(dateString);

      const day = String(d.getDate()).padStart(2, "0");
      const monthName = months[d.getMonth()];
      const year = d.getFullYear();

      return `Client since ${day} ${monthName} ${year}`;
   }

   function formatDueDate(date: string): string {
      const dateString = String(date);

      const year = dateString.slice(0, 4);
      const month = months[parseInt(dateString.slice(5, 7)) - 1];
      const day = dateString.slice(8, 10);

      return ` ${month} ${day}, ${year}`;
   }

   function formatDueDateForServer(dateValue) {
      if (!dateValue) return null;

      const year = dateValue.year;
      const month = String(dateValue.month).padStart(2, "0");
      const day = String(dateValue.day).padStart(2, "0");

      return `${year}-${month}-${day}`;
   }

   const formatDuration = (minutes: number): string => {
      if (minutes < 60) return `${minutes}m`;
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
   };

   function formatCreatedAtDate(input: string): string {
      const date = new Date(input);
      const now = new Date();

      // Check if the date is today
      if (
         date.getFullYear() === now.getFullYear() &&
         date.getMonth() === now.getMonth() &&
         date.getDate() === now.getDate()
      ) {
         return "Today";
      }

      // Convert month number to name
      const monthNames = [
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

      const month = monthNames[date.getMonth()];
      const day = date.getDate();

      return `${month} ${day}`;
   }

   return { formatDate, formatDueDate, formatDueDateForServer, formatCreatedAtDate, formatDuration };
}
