import React from "react";
import { getInitials, getColorFromName } from "@/utils/profilePicture.js";

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
