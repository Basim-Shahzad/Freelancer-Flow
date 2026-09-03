import React from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

function getInitials(name: string): string {
   if (!name) return "";
   const words = name.trim().split(/\s+/);
   return words
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? "")
      .join("");
}

const AVATAR_COLORS = [
   "#6366F1",
   "#8B5CF6",
   "#EC4899",
   "#EF4444",
   "#F59E0B",
   "#10B981",
   "#06B6D4",
   "#3B82F6",
];

function getColorFromName(name: string): string {
   if (!name) return AVATAR_COLORS[0];
   const hash = name
      .trim()
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
   return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

interface ProfilePictureFromNameProps {
   name: string;
   scale?: number;
   className?: string;
}

const ProfilePictureFromName: React.FC<ProfilePictureFromNameProps> = ({ name, scale = 1, className }) => {
   const initials = getInitials(name);
   const bgColor = getColorFromName(name);
   const sizePx = 32 * scale;

   return (
      <Avatar
         className={cn("shrink-0", className)}
         style={{ width: sizePx, height: sizePx }}
      >
         <AvatarFallback
            className="font-semibold text-white"
            style={{ backgroundColor: bgColor, fontSize: 13 * scale }}
         >
            {initials}
         </AvatarFallback>
      </Avatar>
   );
};

export default ProfilePictureFromName;
