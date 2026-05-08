import React from "react";

function getInitials(name: string): string {
   if (!name) return "";
   const words = name.trim().split(/\s+/);
   return words
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? "")
      .join("");
}

function getColorFromName(name: string): string | undefined {
   if (!name) return "";
   const colors = ["#6366F1", "#8B5CF6", "#EC4899", "#EF4444", "#F59E0B", "#10B981", "#06B6D4", "#3B82F6"];
   const hash = name
      .trim()
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
   return colors[hash % colors.length];
}

interface ProfilePictureFromNameProps {
   name: string;
   scale: number;
}

const ProfilePictureFromName: React.FC<ProfilePictureFromNameProps> = ({ name, scale = 1 }) => {
   const initials = getInitials(name);
   const bgColor = getColorFromName(name);

   return (
      <div
         style={{
            width: 40 * scale,
            height: 40 * scale,
            borderRadius: "50%",
            backgroundColor: bgColor,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontWeight: "bold",
            fontSize: 16 * scale,
            userSelect: "none",
         }}>
         {initials}
      </div>
   );
};

export default ProfilePictureFromName;
